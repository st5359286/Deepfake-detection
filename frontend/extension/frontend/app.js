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
    });
    screens[screenId].classList.add('active');
    screens[screenId].classList.remove('hidden'); // In case it was hidden before
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
        const spinner = tab.querySelector('svg');
        const text = tab.querySelector('span');
        tab.disabled = isLoading;

        if (tab.dataset.tab === activeTab && isLoading) {
            spinner.classList.remove('hidden');
            text.textContent = 'Analyzing...';
            tab.classList.add('cursor-not-allowed', 'opacity-75');
        } else {
            spinner.classList.add('hidden');
            text.textContent = `Analyze ${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`;
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

async function startAnalysis(file) {
    toggleButtonLoading(true);
    showScreen('analyzing');
    fileNameDisplay.textContent = file.name;
    errorDisplay.classList.add('hidden');
    currentFile = file;

    resetProgress();
    const formData = new FormData();
    formData.append('media', file);

    // Add userId to the request so the backend can log the activity
    const userString = localStorage.getItem('user');
    if (userString) {
        formData.append('userId', JSON.parse(userString).id);
    }

    const xhr = currentXhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:3000/api/analyze', true);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressBar.textContent = percentComplete + '%';
        }
    };

    xhr.onload = function() {
        currentXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                analysisResult = JSON.parse(xhr.responseText);
                displayResults(analysisResult);
            } catch (e) {
                console.error('Error parsing analysis response:', e);
                showError('Failed to parse analysis result.');
            }
        } else {
            try {
                const errorData = JSON.parse(xhr.responseText);
                showError(errorData.error || `Server responded with status: ${xhr.status}`);
            } catch (e) {
                showError(`Server responded with status: ${xhr.status}`);
            }
        }
    };

    xhr.onerror = function() {
        currentXhr = null;
        console.error('Analysis failed: Network error.');
        showError('Analysis failed. Check your network connection or if the server is running.');
    };

    xhr.upload.onload = function() {
        analyzingTitle.textContent = 'Analyzing...';
        progressWrapper.classList.add('hidden');
        analyzingLoader.classList.remove('hidden');
        analyzingText.classList.remove('hidden');
    };

    xhr.send(formData);
}

function handleCancel() {
    if (currentXhr) {
        currentXhr.abort();
    }
    resetApp();
}

function displayResults(data) {
    verdictText.textContent = data.is_deepfake ? 'MANIPULATED' : 'AUTHENTIC';
    verdictText.className = `result-verdict ${data.is_deepfake ? 'manipulated' : 'authentic'}`;
    confidenceScore.textContent = `${data.confidence}%`;
    confidenceScore.style.color = data.is_deepfake ? '#f87171' : '#4ade80';

    mediaPreview.innerHTML = '';
    if (currentFile.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(currentFile);
        img.onload = () => URL.revokeObjectURL(img.src); // Clean up memory
        img.className = 'max-w-full max-h-[400px] rounded-md';
        mediaPreview.appendChild(img);
    } else if (currentFile.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(currentFile);
        video.controls = true;
        video.className = 'max-w-full max-h-[400px] rounded-md';
        mediaPreview.appendChild(video);
    } else if (currentFile.type.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(currentFile);
        audio.controls = true;
        audio.className = 'w-full';
        mediaPreview.appendChild(audio);
    }

    forensicList.innerHTML = '';
    data.forensics.forEach(detail => {
        const item = document.createElement('div');
        item.className = 'forensic-item';
        item.style.borderColor = detail.level === 'High' ? '#ef4444' : detail.level === 'Medium' ? '#f59e0b' : '#22c55e';
        item.innerHTML = `
            <div>
                <h4>${detail.title}</h4>
                <p>${detail.description}</p>
            </div>
        `;
        forensicList.appendChild(item);
    });

    // Chief Judgment (single item)
    chiefJudgment.innerHTML = `
        <div>
            <h4>${data.chief_judgment.title}</h4>
            <p>${data.chief_judgment.description}</p>
        </div>
    `;

    // Visual Analysis (list)
    visualList.innerHTML = '';
    data.visual_analysis.forEach(detail => {
        const item = document.createElement('div');
        item.className = 'forensic-item';
        item.style.borderColor = detail.level === 'High' ? '#ef4444' : detail.level === 'Medium' ? '#f59e0b' : '#22c55e';
        item.innerHTML = `<div><h4>${detail.title}</h4><p>${detail.description}</p></div>`;
        visualList.appendChild(item);
    });
    // Metadata (list)
    metadataList.innerHTML = '';
    data.metadata_analysis.forEach(detail => {
        const item = document.createElement('div');
        item.className = 'forensic-item';
        item.style.borderColor = detail.level === 'High' ? '#ef4444' : detail.level === 'Medium' ? '#f59e0b' : '#22c55e';
        item.innerHTML = `<div><h4>${detail.title}</h4><p>${detail.description}</p></div>`;
        metadataList.appendChild(item);
    });

    showScreen('results');
    toggleButtonLoading(false); // Reset buttons on success
}

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

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        startAnalysis(e.target.files[0]);
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
