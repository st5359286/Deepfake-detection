
// DOM Elements
const verdictText = document.getElementById('verdictText');
const confidenceScore = document.getElementById('confidenceScore');
const mediaPreview = document.getElementById('media-preview');
const forensicList = document.getElementById('forensicList');
const chiefJudgment = document.getElementById('chiefJudgment');
const visualList = document.getElementById('visualList');
const metadataList = document.getElementById('metadataList');
const summaryPanel = document.getElementById('summary-panel');
const summaryText = document.getElementById('summaryText');
const generateSummaryBtn = document.getElementById('generate-summary-btn');
const downloadReportBtn = document.getElementById('download-report-btn');

// State
let analysisResult = null;
let filePreviewData = null; // Base64 string
let fileMetadata = null; // { name, type }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});

function loadResults() {
  try {
    const storedResult = localStorage.getItem('analysisResult');
    const storedPreview = localStorage.getItem('filePreview');
    const storedMeta = localStorage.getItem('fileMetadata');

    if (!storedResult) {
      window.location.href = '/vastav.html'; // Redirect back if no result
      return;
    }

    analysisResult = JSON.parse(storedResult);
    filePreviewData = storedPreview;
    fileMetadata = storedMeta ? JSON.parse(storedMeta) : { type: 'unknown', name: 'unknown' };

    displayResults(analysisResult);

  } catch (e) {
    console.error("Failed to load results:", e);
    alert("Error loading results. Returning to upload page.");
    window.location.href = '/vastav.html';
  }
}

function displayResults(data) {
  // Verdict
  verdictText.textContent = data.is_deepfake ? 'MANIPULATED' : 'AUTHENTIC';
  verdictText.className = `text-3xl font-bold mb-1 ${data.is_deepfake ? 'text-red-500' : 'text-green-500'}`;

  confidenceScore.textContent = `${data.confidence}%`;
  confidenceScore.style.color = data.is_deepfake ? '#f87171' : '#4ade80';

  // Preview
  const placeholder = document.getElementById('preview-placeholder');
  if (placeholder) placeholder.remove();

  if (filePreviewData && fileMetadata.type) {
    if (fileMetadata.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = filePreviewData;
      img.className = 'max-w-full max-h-[400px] rounded-md';
      mediaPreview.appendChild(img);
    } else if (fileMetadata.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = filePreviewData;
      video.controls = true;
      video.className = 'max-w-full max-h-[400px] rounded-md';
      mediaPreview.appendChild(video);
    } else if (fileMetadata.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = filePreviewData;
      audio.controls = true;
      audio.className = 'w-full';
      mediaPreview.appendChild(audio);
    }
  } else {
    mediaPreview.innerHTML = '<div class="text-gray-500">Preview not available (File too large or missing)</div>';
  }

  // Forensics
  renderList(forensicList, data.forensics);
  renderList(visualList, data.visual_analysis);
  renderList(metadataList, data.metadata_analysis);

  // Chief Judgment
  if (data.chief_judgment) {
    chiefJudgment.innerHTML = `
            <div>
                <h4 class="font-bold text-cyan mb-1">${data.chief_judgment.title}</h4>
                <p class="text-sm">${data.chief_judgment.description}</p>
            </div>
        `;
  }

  // Auto-expand if fake
  if (data.is_deepfake) {
    const firstDetail = document.querySelector('details.group');
    if (firstDetail) firstDetail.open = true;
  }

  downloadReportBtn.classList.remove('hidden');

  // Render Feature Graphs
  if (data.feature_scores) {
    renderFeatureGraph(document.getElementById('feature-graph'), data.feature_scores);
  }

  // Render Timeline (if available)
  const timelineSection = document.getElementById('timeline-section');
  if (data.timeline && data.timeline.length > 0) {
    timelineSection.classList.remove('hidden');
    renderTimeline(document.getElementById('timeline-container'), data.timeline);
  } else {
    timelineSection.classList.add('hidden');
  }

  // Auto-generate summary
  handleGenerateSummary();
}

function renderFeatureGraph(container, scores) {
  container.innerHTML = '';
  Object.entries(scores).forEach(([key, value]) => {
    const colorClass = value > 70 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
      value > 40 ? 'bg-yellow-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';

    const html = `
            <div class="group">
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-400 font-mono">${key.toUpperCase()}</span>
                    <span class="font-bold text-white">${value}%</span>
                </div>
                <div class="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
                    <div class="h-full ${colorClass} transition-all duration-1000 ease-out" style="width: 0%" onload="this.style.width='${value}%'"></div>
                </div>
            </div>
        `;
    container.insertAdjacentHTML('beforeend', html);

    // Trigger animation
    setTimeout(() => {
      const bar = container.lastElementChild.querySelector('.h-full');
      if (bar) bar.style.width = `${value}%`;
    }, 100);
  });
}

function renderTimeline(container, segments) {
  container.innerHTML = '';
  const totalDuration = segments[segments.length - 1].end;

  segments.forEach(segment => {
    const duration = segment.end - segment.start;
    const widthPercent = (duration / totalDuration) * 100;
    const colorClass = segment.status === 'authentic' ? 'bg-emerald-500/80 hover:bg-emerald-400' : 'bg-red-500/80 hover:bg-red-400';

    const div = document.createElement('div');
    div.className = `h-full ${colorClass} relative group border-r border-black/20 last:border-0 transition-opacity`;
    div.style.width = `${widthPercent}%`;

    // Tooltip
    div.innerHTML = `
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black border border-gray-700 p-2 rounded text-[10px] whitespace-nowrap z-20 shadow-xl">
                <div class="font-bold mb-1 uppercase ${segment.status === 'authentic' ? 'text-emerald-400' : 'text-red-400'}">${segment.status}</div>
                <div>Confidence: ${segment.score}%</div>
                <div>${segment.start}s - ${segment.end}s</div>
            </div>
        `;

    container.appendChild(div);
  });
}

function renderList(container, items) {
  container.innerHTML = '';
  if (items) {
    items.forEach(detail => {
      const item = document.createElement('div');
      item.className = 'p-2 border-l-2 mb-2 bg-white/5';
      item.style.borderColor = detail.level === 'High' ? '#ef4444' : detail.level === 'Medium' ? '#f59e0b' : '#22c55e';
      item.innerHTML = `
                <div class="text-xs">
                    <h4 class="font-bold text-gray-300 inline mr-2">${detail.title}:</h4>
                    <span class="text-gray-400">${detail.description}</span>
                </div>
            `;
      container.appendChild(item);
    });
  }
}

async function handleGenerateSummary() {
  generateSummaryBtn.disabled = true;
  generateSummaryBtn.innerHTML = `<span>Generating...</span>`;
  summaryPanel.classList.add('hidden');

  try {
    const response = await fetch('http://localhost:3000/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisResult })
    });

    if (!response.ok) throw new Error('Summary generation failed');

    const data = await response.json();
    summaryText.textContent = data.summary;
    summaryPanel.classList.remove('hidden');

  } catch (error) {
    console.error('Summary error:', error);
    summaryText.textContent = 'Could not generate summary.';
    summaryPanel.classList.remove('hidden');
  } finally {
    generateSummaryBtn.disabled = false;
    generateSummaryBtn.innerHTML = '>> RECOMPILE_MISSION_REPORT';
  }
}

async function handleDownloadReport() {
  if (!analysisResult) return;

  const btn = downloadReportBtn;
  const originalText = btn.innerHTML;
  btn.textContent = 'Generating PDF...';
  btn.disabled = true;

  try {
    const response = await fetch('http://localhost:3000/api/report/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisResult,
        fileName: fileMetadata ? fileMetadata.name : 'Analyzed File'
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
    alert("Failed to download PDF report.");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

generateSummaryBtn.addEventListener('click', handleGenerateSummary);
downloadReportBtn.addEventListener('click', handleDownloadReport);
