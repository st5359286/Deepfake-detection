const API_URL = window.config.API_URL;

let selectedSessionId = null;
let candidateSessions = [];

async function loadCandidateReport() {
  const body = document.getElementById('candidate-report-body');
  if (!body) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/assessment-report`);
    if (!response.ok) throw new Error('Failed to fetch assessment report');

    const sessions = await response.json();
    candidateSessions = sessions;

    if (!sessions.length) {
      body.innerHTML = '<tr><td colspan="10" style="padding: 24px; color: #94a3b8; text-align: center;">No candidate assessment data available.</td></tr>';
      return;
    }

    body.innerHTML = sessions.map((session) => {
      const riskColor = session.riskLevel === 'High' ? '#f87171' : session.riskLevel === 'Medium' ? '#fbbf24' : '#34d399';
      return `
        <tr>
          <td>${session.candidate_name || 'Unknown'}</td>
          <td>${session.username || 'Unknown'}</td>
          <td>${session.status || 'active'}</td>
          <td>${session.violation_count || 0}</td>
          <td>${session.event_count || 0}</td>
          <td><span class="risk-badge" style="background: rgba(15, 118, 110, 0.15); color: ${riskColor};">${session.riskScore || 0}</span></td>
          <td><span class="risk-badge" style="background: rgba(148, 163, 184, 0.08); color: ${riskColor};">${session.riskLevel || 'Low'}</span></td>
          <td>${session.recommendation || 'Review as needed'}</td>
          <td>${session.started_at ? new Date(session.started_at).toLocaleString() : '—'}</td>
          <td>
            <button class="btn decision-trigger" data-session-id="${session.id}" type="button">Review</button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.decision-trigger').forEach((button) => {
      button.addEventListener('click', () => {
        selectedSessionId = Number(button.dataset.sessionId);
        openDecisionPanel(selectedSessionId);
      });
    });
  } catch (error) {
    console.error('Candidate report error:', error);
    body.innerHTML = '<tr><td colspan="10" style="padding: 24px; color: #f87171; text-align: center;">Failed to load candidate report.</td></tr>';
  }
}

async function openDecisionPanel(sessionId) {
  const panel = document.getElementById('decision-panel');
  const title = document.getElementById('decision-title');
  const meta = document.getElementById('decision-meta');
  const summary = document.getElementById('decision-summary');

  const session = candidateSessions.find((item) => Number(item.id) === Number(sessionId));
  if (!session) return;

  const riskColor = session.riskLevel === 'High' ? '#f87171' : session.riskLevel === 'Medium' ? '#fbbf24' : '#34d399';

  if (title) title.textContent = `${session.candidate_name || 'Candidate'} • Session ${sessionId}`;
  if (meta) {
    meta.innerHTML = `User: ${session.username || 'Unknown'} • Status: ${session.status || 'active'} • Started: ${session.started_at ? new Date(session.started_at).toLocaleString() : '—'}`;
  }

  if (summary) {
    summary.innerHTML = `
      <div class="decision-card">
        <div class="decision-label">Risk score</div>
        <div class="decision-value" style="color: ${riskColor};">${session.riskScore || 0}</div>
      </div>
      <div class="decision-card">
        <div class="decision-label">Risk level</div>
        <div class="decision-value" style="color: ${riskColor};">${session.riskLevel || 'Low'}</div>
      </div>
      <div class="decision-card">
        <div class="decision-label">Violations</div>
        <div class="decision-value">${session.violation_count || 0}</div>
      </div>
      <div class="decision-card">
        <div class="decision-label">Recommendation</div>
        <div class="decision-value" style="font-size: 1rem; line-height: 1.5;">${session.recommendation || 'Review as needed'}</div>
      </div>
    `;
  }

  selectedSessionId = Number(sessionId);
  panel.style.display = 'block';
  document.querySelectorAll('[data-decision]').forEach((button) => {
    button.dataset.sessionId = String(sessionId);
  });
}

function renderPrintableSummary(session) {
  const printContainer = document.getElementById('print-summary-body');
  if (!printContainer || !session) return;

  const riskColor = session.riskLevel === 'High' ? '#ef4444' : session.riskLevel === 'Medium' ? '#f59e0b' : '#22c55e';
  const title = document.getElementById('print-summary-subtitle');
  if (title) {
    title.textContent = `${session.candidate_name || 'Candidate'} • ${session.username || 'Unknown user'} • Session ${session.id}`;
  }

  printContainer.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Candidate</div>
        <div style="font-size: 1.4rem; font-weight: 700; margin-top: 8px;">${session.candidate_name || 'Unknown'}</div>
      </div>
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">User</div>
        <div style="font-size: 1.2rem; font-weight: 700; margin-top: 8px;">${session.username || 'Unknown'}</div>
      </div>
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Status</div>
        <div style="font-size: 1.2rem; font-weight: 700; margin-top: 8px; text-transform: capitalize;">${session.status || 'active'}</div>
      </div>
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Risk score</div>
        <div style="font-size: 2rem; font-weight: 800; color: ${riskColor}; margin-top: 8px;">${session.riskScore || 0}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Risk level</div>
        <div style="font-size: 1.2rem; font-weight: 700; color: ${riskColor}; margin-top: 8px;">${session.riskLevel || 'Low'}</div>
      </div>
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Violations</div>
        <div style="font-size: 1.2rem; font-weight: 700; margin-top: 8px;">${session.violation_count || 0}</div>
      </div>
      <div style="padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f8fafc;">
        <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Event count</div>
        <div style="font-size: 1.2rem; font-weight: 700; margin-top: 8px;">${session.event_count || 0}</div>
      </div>
    </div>

    <div style="padding: 18px; border: 1px solid #d1d5db; border-radius: 12px; background: #ffffff;">
      <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 8px;">Recommendation</div>
      <div style="font-size: 1.05rem; line-height: 1.6;">${session.recommendation || 'Review as needed.'}</div>
    </div>

    <div style="padding: 18px; border: 1px solid #d1d5db; border-radius: 12px; background: #ffffff;">
      <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 8px;">Assessment timeline</div>
      <div style="font-size: 0.95rem; line-height: 1.8; color: #334155;">
        Started: ${session.started_at ? new Date(session.started_at).toLocaleString() : '—'}<br>
        Last event: ${session.last_event || 'No events recorded'}<br>
        Status: ${session.status || 'active'}
      </div>
    </div>
  `;
}

function showPrintableSummary(sessionId) {
  const session = candidateSessions.find((item) => Number(item.id) === Number(sessionId));
  if (!session) return;

  renderPrintableSummary(session);
  const card = document.getElementById('printable-summary-card');
  if (card) card.style.display = 'block';
}

async function updateAssessmentDecision(decision) {
  if (!selectedSessionId) return;

  try {
    const response = await fetch(`${API_URL}/api/assessment/sessions/${selectedSessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: decision }),
    });

    if (!response.ok) throw new Error('Decision update failed');

    const panel = document.getElementById('decision-panel');
    if (panel) panel.style.display = 'none';

    await loadCandidateReport();
    alert(`Assessment marked as ${decision}.`);
  } catch (error) {
    console.error('Assessment decision update error:', error);
    alert('Failed to update the assessment decision.');
  }
}

async function exportCandidateReport() {
  try {
    const response = await fetch(`${API_URL}/api/admin/assessment-report/export`);
    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate-risk-report.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('CSV export error:', error);
    alert('Failed to export the candidate risk report.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCandidateReport();

  const exportBtn = document.getElementById('export-report-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportCandidateReport);

  document.getElementById('close-decision-panel')?.addEventListener('click', () => {
    const panel = document.getElementById('decision-panel');
    if (panel) panel.style.display = 'none';
  });

  document.getElementById('hide-summary-card')?.addEventListener('click', () => {
    const card = document.getElementById('printable-summary-card');
    if (card) card.style.display = 'none';
  });

  document.getElementById('print-summary-btn')?.addEventListener('click', () => {
    if (selectedSessionId) {
      showPrintableSummary(selectedSessionId);
      window.print();
    }
  });

  document.querySelectorAll('[data-decision]').forEach((button) => {
    button.addEventListener('click', () => updateAssessmentDecision(button.dataset.decision));
  });
});
