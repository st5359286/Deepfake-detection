// --- Helper Functions ---
function showDashboard(role) {
    if (role === 'admin') {
        document.getElementById('admin-dashboard').classList.remove('hidden');
        document.getElementById('user-dashboard').classList.add('hidden');
    } else {
        document.getElementById('user-dashboard').classList.remove('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
    }
}

async function fetchAdminData() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/activity');
        if (!response.ok) throw new Error('Failed to fetch admin data');

        const activity = await response.json();
        const activityBody = document.getElementById('activity-log-body');
        activityBody.innerHTML = ''; // Clear previous data

        activity.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-cyan/5 transition-colors group';
            row.innerHTML = `
                <td class="px-6 py-4 font-bold text-white group-hover:text-cyan">${user.username}</td>
                <td class="px-6 py-4">${user.analyses_today}</td>
                <td class="px-6 py-4">${user.total_analyses}</td>
                <td class="px-6 py-4 text-xs text-gray-500">${user.last_active ? new Date(user.last_active).toLocaleString() : 'OFFLINE'}</td>
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
        console.error('Error fetching admin activity:', error);
        const activityBody = document.getElementById('activity-log-body');
        activityBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-400">Could not load user activity.</td></tr>`;
    }
}

async function fetchAdminStats() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');

        const stats = await response.json();
        document.getElementById('admin-total-users').textContent = stats.totalUsers;
        document.getElementById('admin-total-scans').textContent = stats.totalAnalyses;
        document.getElementById('admin-total-fakes').textContent = stats.deepfakesDetected;
    } catch (error) {
        console.error('Error fetching admin stats:', error);
    }
}

// Global scope for onclick access
window.deleteUser = async function (userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/admin/user/${userId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('User deleted successfully.');
            fetchAdminData(); // Refresh the table
            fetchAdminStats(); // Refresh stats
        } else {
            alert('Failed to delete user.');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('An error occurred.');
    }
}



async function handleExport() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/export-activity');
        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Activity_Log_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data.');
    }
}

async function fetchUserActivity(userId) {
    try {
        const response = await fetch(`http://localhost:3000/api/user-activity/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user activity');

        const stats = await response.json();

        // Update the DOM with the fetched stats
        document.getElementById('stat-analyses-today').textContent = stats.analysesToday;
        document.getElementById('stat-total-analyses').textContent = stats.totalAnalyses;
        document.getElementById('stat-avg-confidence').textContent = `${stats.avgConfidence}%`;

    } catch (error) {
        console.error('Error fetching user activity:', error);
        // You could show an error state for the stats here if desired
    }
}


// --- Main Logic ---
(async () => {
    const userString = localStorage.getItem('user');
    if (!userString) {
        // If no user data, redirect to login
        window.location.href = '/index.html';
        return;
    }

    const user = JSON.parse(userString);
    const welcomeMessage = document.getElementById('welcome-message');

    try {
        // Fetch protected data from the dashboard endpoint
        const response = await fetch(`http://localhost:3000/dashboard?username=${user.username}`);
        const data = await response.json();

        if (response.ok && data.user) {
            welcomeMessage.textContent = `Welcome, ${data.user.username} (${data.user.role})!`;

            // Show the correct dashboard based on the user's role
            showDashboard(user.role);

            if (user.role === 'admin') {
                await fetchAdminData();
                await fetchAdminStats(); // New stats call
                const exportBtn = document.getElementById('export-btn');
                if (exportBtn) exportBtn.addEventListener('click', handleExport);
            } else {
                // Populate user profile card for non-admins
                document.getElementById('user-id').textContent = data.user.id;
                document.getElementById('user-username').textContent = data.user.username;
                document.getElementById('user-email').textContent = data.user.email;
                document.getElementById('user-role').textContent = data.user.role;
                await fetchUserActivity(user.id);
            }
        } else {
            // Check for explicit unauthorized status (401)
            if (response.status === 401) {
                console.warn('Session expired or unauthorized. Logging out.');
                localStorage.removeItem('user');
                window.location.href = '/index.html';
                return;
            }

            // For other errors (404, 500, etc.), DO NOT LOG OUT.
            // Just show an error message but keep the session alive.
            console.warn('Dashboard data fetch failed, but keeping session active.', data ? data.message : 'Unknown error');
            welcomeMessage.textContent = `Welcome, ${user.username}! (Offline/Sync Issue)`;

            // Still try to show the dashboard UI based on local role
            showDashboard(user.role);

            // Fill user details from local storage if available
            if (user.role !== 'admin') {
                document.getElementById('user-id').textContent = user.id || '-';
                document.getElementById('user-username').textContent = user.username || '-';
                document.getElementById('user-email').textContent = user.email || '-';
            }
        }
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        welcomeMessage.textContent = 'Could not load dashboard data. (Offline Mode)';
        showDashboard(user.role); // Show UI anyway
    }
})();

// Logout functionality
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
});