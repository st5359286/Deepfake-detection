import config from "./config.js";

// --- Helper: Get Authorization Header ---
function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Helper: Validate Token ---
function validateToken() {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  if (!token || !user) {
    return false;
  }
  return true;
}

// --- Helper Functions ---
function showDashboard(role) {
  if (role === "admin") {
    document.getElementById("admin-dashboard").classList.remove("hidden");
    document.getElementById("user-dashboard").classList.add("hidden");
  } else {
    document.getElementById("user-dashboard").classList.remove("hidden");
    document.getElementById("admin-dashboard").classList.add("hidden");
  }
}

async function fetchAdminData() {
  try {
    const response = await fetch(`${config.API_URL}/api/admin/activity`);
    if (!response.ok) throw new Error("Failed to fetch admin data");

    const activity = await response.json();
    const activityBody = document.getElementById("activity-log-body");
    activityBody.innerHTML = ""; // Clear previous data

    activity.forEach((user) => {
      const row = document.createElement("tr");
      row.className = "hover:bg-cyan/5 transition-colors group";
      row.innerHTML = `
                <td class="px-6 py-4 font-bold text-white group-hover:text-cyan">${user.username}</td>
                <td class="px-6 py-4">${user.analyses_today}</td>
                <td class="px-6 py-4">${user.total_analyses}</td>
                <td class="px-6 py-4 text-xs text-gray-500">${user.last_active ? new Date(user.last_active).toLocaleString() : "OFFLINE"}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="deleteUser(${user.id}, '${user.username}')" 
                        class="btn-cyber-red py-1 px-3 text-xs border border-alertRed text-alertRed hover:bg-alertRed hover:text-black transition uppercase font-bold">
                        [ DELETE ]
                    </button>
                </td>
            `;
      activityBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching admin activity:", error);
    const activityBody = document.getElementById("activity-log-body");
    activityBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-400">Could not load user activity.</td></tr>`;
  }
}

async function fetchAdminStats() {
  try {
    const response = await fetch(`${config.API_URL}/api/admin/stats`);
    if (!response.ok) throw new Error("Failed to fetch stats");

    const stats = await response.json();
    document.getElementById("admin-total-users").textContent = stats.totalUsers;
    document.getElementById("admin-total-scans").textContent =
      stats.totalAnalyses;
    document.getElementById("admin-total-fakes").textContent =
      stats.deepfakesDetected;
  } catch (error) {
    console.error("Error fetching admin stats:", error);
  }
}

// Global scope for onclick access
window.deleteUser = async function (userId, username) {
  if (
    !confirm(
      `Are you sure you want to delete user "${username}"? This cannot be undone.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${config.API_URL}/api/admin/user/${userId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      alert("User deleted successfully.");
      fetchAdminData(); // Refresh the table
      fetchAdminStats(); // Refresh stats
    } else {
      alert("Failed to delete user.");
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    alert("An error occurred.");
  }
};

async function handleExport() {
  try {
    const response = await fetch(`${config.API_URL}/api/admin/export-activity`);
    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Activity_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Export error:", error);
    alert("Failed to export data.");
  }
}

async function fetchUserActivity(userId) {
  try {
    const response = await fetch(
      `${config.API_URL}/api/user-activity/${userId}`,
    );
    if (!response.ok) throw new Error("Failed to fetch user activity");

    const stats = await response.json();

    // Update the DOM with the fetched stats
    document.getElementById("stat-analyses-today").textContent =
      stats.analysesToday;
    document.getElementById("stat-total-analyses").textContent =
      stats.totalAnalyses;
    document.getElementById("stat-avg-confidence").textContent =
      `${stats.avgConfidence}%`;
  } catch (error) {
    console.error("Error fetching user activity:", error);
    // You could show an error state for the stats here if desired
  }
}

async function fetchAssessmentSummary(userId) {
  try {
    const response = await fetch(`${config.API_URL}/api/assessment/summary/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch assessment summary");

    const summary = await response.json();
    const sessionCount = document.getElementById("assessmentSessionCount");
    const violationCount = document.getElementById("assessmentViolationCount");

    if (sessionCount) sessionCount.textContent = summary.totalSessions || 0;
    if (violationCount) violationCount.textContent = summary.totalViolations || 0;
  } catch (error) {
    console.error("Error fetching assessment summary:", error);
  }
}

let assessmentOverviewSessions = [];

async function fetchAssessmentOverview() {
  try {
    const response = await fetch(`${config.API_URL}/api/admin/assessment-overview`);
    if (!response.ok) throw new Error("Failed to fetch assessment overview");

    const sessions = await response.json();
    assessmentOverviewSessions = sessions;
    const body = document.getElementById("assessment-session-body");
    if (!body) return;

    if (!sessions.length) {
      body.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No assessment sessions recorded yet.</td></tr>';
      return;
    }

    body.innerHTML = sessions
      .map((session) => {
        const statusColor = session.status === "flagged" ? "#f87171" : session.status === "active" ? "#22c55e" : "#94a3b8";
        return `
          <tr>
            <td style="padding: 12px; font-weight: 600;">${session.username || "Unknown"}</td>
            <td style="padding: 12px; color: ${statusColor}; text-transform: capitalize;">${session.status || "active"}</td>
            <td style="padding: 12px;">${session.violation_count || 0}</td>
            <td style="padding: 12px;">${session.last_event || "No violations"}</td>
            <td style="padding: 12px;">${session.started_at ? new Date(session.started_at).toLocaleString() : "—"}</td>
            <td style="padding: 12px;">
              <button class="assessment-detail-trigger btn btn-sm btn-secondary" data-session-id="${session.id}" style="background: transparent; border: 1px solid var(--border); color: var(--text-primary);">View</button>
            </td>
          </tr>
        `;
      })
      .join("");

    document.querySelectorAll(".assessment-detail-trigger").forEach((button) => {
      button.addEventListener("click", async () => {
        const sessionId = Number(button.dataset.sessionId);
        await openAssessmentDetail(sessionId);
      });
    });
  } catch (error) {
    console.error("Error fetching assessment overview:", error);
    const body = document.getElementById("assessment-session-body");
    if (body) {
      body.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #f87171;">Could not load assessment monitoring data.</td></tr>';
    }
  }
}

async function openAssessmentDetail(sessionId) {
  const panel = document.getElementById("assessment-detail-panel");
  const meta = document.getElementById("assessment-detail-meta");
  const list = document.getElementById("assessment-event-list");
  const riskSummary = document.getElementById("assessment-risk-summary");

  if (!panel || !meta || !list || !riskSummary) return;

  const session = assessmentOverviewSessions.find((item) => Number(item.id) === Number(sessionId));
  if (!session) return;

  try {
    const response = await fetch(`${config.API_URL}/api/assessment/session/${sessionId}/summary`);
    if (!response.ok) throw new Error("Failed to load session summary");

    const summary = await response.json();
    const riskColor = summary.riskLevel === "High" ? "#f87171" : summary.riskLevel === "Medium" ? "#fbbf24" : "#34d399";

    riskSummary.innerHTML = `
      <div style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(15, 23, 42, 0.8);">
        <div style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">Risk Score</div>
        <div style="font-size: 2rem; font-weight: 800; color: ${riskColor};">${summary.riskScore}</div>
      </div>
      <div style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(15, 23, 42, 0.8);">
        <div style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">Risk Level</div>
        <div style="font-size: 1.2rem; font-weight: 700; color: ${riskColor};">${summary.riskLevel}</div>
      </div>
      <div style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(15, 23, 42, 0.8);">
        <div style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">Violations</div>
        <div style="font-size: 1.3rem; font-weight: 700;">${summary.violationCount}</div>
      </div>
      <div style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(15, 23, 42, 0.8);">
        <div style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">Events</div>
        <div style="font-size: 1.3rem; font-weight: 700;">${summary.eventCount}</div>
      </div>
    `;

    meta.innerHTML = `
      <span><strong>User:</strong> ${session.username || "Unknown"}</span>
      <span><strong>Candidate:</strong> ${session.candidate_name || summary.candidateName || "—"}</span>
      <span><strong>Status:</strong> ${summary.status || "active"}</span>
      <span><strong>Started:</strong> ${summary.startedAt ? new Date(summary.startedAt).toLocaleString() : "—"}</span>
      <span><strong>Recommendation:</strong> ${summary.recommendation}</span>
    `;

    const eventResponse = await fetch(`${config.API_URL}/api/assessment/events/${sessionId}`);
    if (!eventResponse.ok) throw new Error("Failed to load events");
    const events = await eventResponse.json();

    if (!events.length) {
      list.innerHTML = '<li style="padding: 16px; border: 1px solid var(--border); border-radius: 10px; color: var(--text-muted);">No events recorded for this assessment session yet.</li>';
      panel.classList.remove("hidden");
      return;
    }

    list.innerHTML = events
      .map((event) => {
        const payload = (() => {
          try { return JSON.parse(event.payload || "{}"); } catch { return {}; }
        })();
        const details = event.details || "No additional detail";
        const extra = payload && Object.keys(payload).length ? ` <span style="color: var(--text-secondary);">(${JSON.stringify(payload)})</span>` : "";
        return `
          <li style="padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: rgba(15, 118, 110, 0.08);">
            <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 6px;">
              <strong>${event.event_type}</strong>
              <span style="color: ${event.severity === "high" ? "#f87171" : event.severity === "medium" ? "#fbbf24" : "#34d399"}; text-transform: capitalize;">${event.severity}</span>
            </div>
            <div style="color: var(--text-secondary);">${details}${extra}</div>
            <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 6px;">${new Date(event.timestamp).toLocaleString()}</div>
          </li>
        `;
      })
      .join("");

    panel.classList.remove("hidden");
  } catch (error) {
    console.error("Error opening assessment detail:", error);
    list.innerHTML = '<li style="padding: 16px; border: 1px solid var(--border); border-radius: 10px; color: #f87171;">Unable to load the assessment event timeline.</li>';
    panel.classList.remove("hidden");
  }
}

// --- Main Logic ---
(async () => {
  const userString = localStorage.getItem("user");
  if (!userString) {
    // If no user data, redirect to login
    window.location.href = "/index.html";
    return;
  }

  const user = JSON.parse(userString);
  const welcomeMessage = document.getElementById("welcome-message");

  try {
    // Fetch protected data from the dashboard endpoint
    const response = await fetch(
      `${config.API_URL}/dashboard?username=${user.username}`,
    );
    const data = await response.json();

    if (response.ok && data.user) {
      welcomeMessage.textContent = `Welcome, ${data.user.username} (${data.user.role})!`;

      // Show the correct dashboard based on the user's role
      showDashboard(user.role);

      if (user.role === "admin") {
        await fetchAdminData();
        await fetchAdminStats();
        await fetchAssessmentOverview();
        const exportBtn = document.getElementById("export-btn");
        if (exportBtn) exportBtn.addEventListener("click", handleExport);

        const closeAssessmentDetailBtn = document.getElementById("close-assessment-detail");
        if (closeAssessmentDetailBtn) {
          closeAssessmentDetailBtn.addEventListener("click", () => {
            const panel = document.getElementById("assessment-detail-panel");
            if (panel) panel.classList.add("hidden");
          });
        }
      } else {
        // Populate user profile card for non-admins
        document.getElementById("user-id").textContent = data.user.id;
        document.getElementById("user-username").textContent =
          data.user.username;
        document.getElementById("user-email").textContent = data.user.email;
        document.getElementById("user-role").textContent = data.user.role;
        await fetchUserActivity(user.id);
        await fetchAssessmentSummary(user.id);
      }
    } else {
      // Check for explicit unauthorized status (401)
      if (response.status === 401) {
        console.warn("Session expired or unauthorized. Logging out.");
        localStorage.removeItem("user");
        window.location.href = "/index.html";
        return;
      }

      // For other errors (404, 500, etc.), DO NOT LOG OUT.
      // Just show an error message but keep the session alive.
      console.warn(
        "Dashboard data fetch failed, but keeping session active.",
        data ? data.message : "Unknown error",
      );
      welcomeMessage.textContent = `Welcome, ${user.username}! (Offline/Sync Issue)`;

      // Still try to show the dashboard UI based on local role
      showDashboard(user.role);

      // Fill user details from local storage if available
      if (user.role !== "admin") {
        document.getElementById("user-id").textContent = user.id || "-";
        document.getElementById("user-username").textContent =
          user.username || "-";
        document.getElementById("user-email").textContent = user.email || "-";
      }
    }
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    welcomeMessage.textContent =
      "Could not load dashboard data. (Offline Mode)";
    showDashboard(user.role); // Show UI anyway
  }
})();

// Logout functionality
document.getElementById("logout-button").addEventListener("click", () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  window.location.href = "/index.html";
});
