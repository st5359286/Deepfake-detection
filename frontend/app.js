// --- DOM Element Selection ---
const screens = {
    upload: document.getElementById('upload-screen'),
    analyzing: document.getElementById('analyzing-screen'),
    results: document.getElementById('results-screen'),
};

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('fileName');
const verdictText = document.getElementById('verdictText');
const mediaPreview = document.getElementById('media-preview');
const confidenceScore = document.getElementById('confidenceScore');
const forensicList = document.getElementById('forensicList');
const chiefJudgment = document.getElementById('chiefJudgment');
const visualList = document.getElementById('visualList');
const metadataList = document.getElementById('metadataList');
const summaryPanel = document.getElementById('summary-panel');
const summaryText = document.getElementById('summaryText');
const generateSummaryBtn = document.getElementById('generate-summary-btn');
const resetBtn = document.getElementById('reset-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tabs = document.querySelectorAll('.tab');
const uploadIconContainer = document.getElementById('upload-icon-container');
const uploadText = document.getElementById('upload-text');
const uploadFormats = document.getElementById('upload-formats');
const errorDisplay = document.getElementById('error-display');

const analyzingTitle = document.getElementById('analyzing-title');
const progressWrapper = document.getElementById('progress-wrapper');
const progressBar = document.getElementById('progress-bar');
const analyzingLoader = document.getElementById('analyzing-loader');
const analyzingText = document.getElementById('analyzing-text');
// --- State Management ---
let currentFile = null;
let analysisResult = null;
let currentXhr = null;
let activeTab = 'image'; // 'image', 'video', or 'audio'

const tabConfig = {
    image: {
        accept: 'image/jpeg,image/png,image/webp',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`,
        formats: 'JPG, PNG, WEBP'
    },
    video: {
        accept: 'video/mp4,video/quicktime,video/webm',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`,
        formats: 'MP4, MOV, WEBM'
    },
    audio: {
        accept: 'audio/mpeg,audio/wav,audio/ogg',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 6l12-3" /></svg>`,
        formats: 'MP3, WAV, OGG'
    }
};


// --- Functions ---

function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    screens[screenId].classList.add('active');
    screens[screenId].classList.remove('hidden');
}

function updateTabUI() {
    const config = tabConfig[activeTab];
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === activeTab);
    });
    fileInput.accept = config.accept;
    uploadIconContainer.innerHTML = config.icon;
    uploadText.textContent = `Drag & Drop Your ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} File Here`;
    uploadFormats.textContent = `Supported formats: ${config.formats}`;
}

function toggleButtonLoading(isLoading) {
    tabs.forEach(tab => {
        const marker = tab.querySelector('.loading-marker');
        tab.disabled = isLoading;

        if (tab.dataset.tab === activeTab && isLoading) {
            if (marker) marker.classList.remove('hidden');
            tab.classList.add('cursor-not-allowed', 'opacity-75');
        } else {
            if (marker) marker.classList.add('hidden');
            tab.classList.remove('cursor-not-allowed', 'opacity-75');
        }
    });
}

function resetProgress() {
    analyzingTitle.textContent = 'Uploading...';
    progressWrapper.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    analyzingLoader.classList.add('hidden');
    analyzingText.classList.add('hidden');
}

async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    // Hash only first 4KB, last 4KB, and size for speed (consistent with backend logic)
    // NOTE: If using strict cryptographic security, hash entire file. For UX speed, this is sufficient.
    const size = file.size;
    let dataToHash;

    if (size > 5 * 1024 * 1024) {
        const start = buffer.slice(0, 4096);
        const end = buffer.slice(buffer.byteLength - 4096);
        // Combine into one buffer for hashing
        const combined = new Uint8Array(start.byteLength + end.byteLength + 8);
        combined.set(new Uint8Array(start), 0);
        combined.set(new Uint8Array(end), start.byteLength);
        // Simple approximation of the size buffer logic from backend (optional, but keeps entropy)
        // We will just hash the combined chunks. The random result assumes consistency.
        dataToHash = combined;
    } else {
        dataToHash = buffer;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function startAnalysis(file) {
    toggleButtonLoading(true);
    showScreen('analyzing');
    fileNameDisplay.textContent = file.name;
    errorDisplay.classList.add('hidden');
    currentFile = file;

    resetProgress();

    // Progress Animation
    let progress = 0;
    const progressText = document.getElementById('analyzing-text'); // Make sure this element exists or use the title

    // Reset
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    if (analyzingTitle) analyzingTitle.textContent = 'Analyzing Media Signature...';

    const progressInterval = setInterval(() => {
        // Increment progress (slow down as it gets higher to simulate realistic processing)
        if (progress < 60) {
            progress += 5;
        } else if (progress < 90) {
            progress += 2;
        }

        // Update UI
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${progress}%`;

    }, 200);

    try {
        if (!crypto || !crypto.subtle) {
            throw new Error("Secure Context required for analysis (HTTPS or localhost).");
        }
        const fileHash = await calculateFileHash(file);

        // Add userId to the request
        const userString = localStorage.getItem('user');
        const userId = userString ? JSON.parse(userString).id : null;

        const response = await fetch('http://localhost:3000/api/analyze-fast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: fileHash,
                name: file.name,
                type: file.type,
                size: file.size,
                userId: userId
            })
        });

        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';

        if (!response.ok) {
            throw new Error(`Server status: ${response.status}`);
        }

        analysisResult = await response.json();

        // 3. Save result and file preview to Storage
        localStorage.setItem('analysisResult', JSON.stringify(analysisResult));
        localStorage.setItem('fileMetadata', JSON.stringify({
            name: file.name,
            type: file.type
        }));

        // Convert file to Data URL for preview (if size permits)
        if (file.size < 5 * 1024 * 1024) { // Limit to 5MB for localStorage safety
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    localStorage.setItem('filePreview', e.target.result);
                    window.location.href = '/result.html';
                } catch (storageError) {
                    console.error("Storage Quota Exceeded for Preview", storageError);
                    // Still redirect, just without preview
                    localStorage.removeItem('filePreview');
                    window.location.href = '/result.html';
                }
            };
            reader.readAsDataURL(file);
        } else {
            console.log("File too large for local preview storage, skipping preview.");
            localStorage.removeItem('filePreview'); // Clear previous
            window.location.href = '/result.html';
        }

    } catch (error) {
        clearInterval(progressInterval);
        console.error('Analysis failed:', error);
        showError('Analysis failed. Check your connection.');
        toggleButtonLoading(false);
    }
}

function handleCancel() {
    if (currentXhr) {
        currentXhr.abort();
    }
    resetApp();
}

// NOTE: displayResults function removed as we now redirect to result.html


async function handleGenerateSummary() {
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Generating...</span>
    `;
    summaryPanel.classList.add('hidden');

    try {
        const response = await fetch('http://localhost:3000/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysisResult })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.summary || `Failed to generate summary.`);
        }

        const data = await response.json();
        summaryText.textContent = data.summary;
        summaryPanel.classList.remove('hidden');

    } catch (error) {
        console.error('Summary generation failed:', error);
        summaryText.textContent = error.message || 'Apologies, the summary could not be generated at this time.';
        summaryPanel.classList.remove('hidden');
    } finally {
        generateSummaryBtn.disabled = false;
        generateSummaryBtn.innerHTML = '✨ Generate Report Summary';
    }
}

async function handleDownloadReport() {
    if (!analysisResult) return;

    const btn = document.getElementById('download-report-btn');
    const originalText = btn.innerHTML;
    btn.textContent = 'Generating PDF...';
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:3000/api/report/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analysisResult,
                fileName: currentFile ? currentFile.name : 'unknown'
            })
        });

        if (!response.ok) throw new Error('Failed to generate PDF');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Analysis_Report_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (e) {
        console.error("PDF Download failed", e);
        showError("Failed to download PDF report.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.classList.remove('hidden');
    showScreen('upload');
    toggleButtonLoading(false);
}

function resetApp() {
    currentFile = null;
    currentXhr = null;
    analysisResult = null;
    summaryPanel.classList.add('hidden');
    toggleButtonLoading(false);
    errorDisplay.classList.add('hidden');
    showScreen('upload');
}

// --- Event Listeners ---

// dropZone click listener removed to prevent double-opening file dialog
// because fileInput is absolutely positioned over it.

fileInput.addEventListener('click', (e) => {
    e.stopPropagation(); // Stop bubbling to any parents
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        startAnalysis(e.target.files[0]);
        fileInput.value = ''; // Reset so the same file can be selected again
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragging');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    if (e.dataTransfer.files.length) {
        startAnalysis(e.dataTransfer.files[0]);
    }
});

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        updateTabUI();
    });
});

resetBtn.addEventListener('click', resetApp);
cancelBtn.addEventListener('click', handleCancel);
generateSummaryBtn.addEventListener('click', handleGenerateSummary);
document.getElementById('download-report-btn').addEventListener('click', handleDownloadReport);



// --- Initial Setup ---
updateTabUI();

// Check for URL params to set the initial tab (for admin links)
const urlParams = new URLSearchParams(window.location.search);
const typeParam = urlParams.get('type');
if (typeParam && tabConfig[typeParam]) {
    activeTab = typeParam;
    updateTabUI();
}

showScreen('upload');
