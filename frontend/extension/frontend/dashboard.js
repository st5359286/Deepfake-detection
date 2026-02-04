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
            row.className = 'border-b border-gray-800 hover:bg-gray-700/50';
            row.innerHTML = `
                <td class="px-4 py-3">${user.username}</td>
                <td class="px-4 py-3">${user.analyses_today}</td>
                <td class="px-4 py-3">${user.total_analyses}</td>
                <td class="px-4 py-3">${new Date(user.last_active).toLocaleString()}</td>
            `;
            activityBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching admin activity:', error);
        const activityBody = document.getElementById('activity-log-body');
        activityBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-400">Could not load user activity.</td></tr>`;
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
            welcomeMessage.textContent = `Welcome, ${data.user.username}!`;

            // Show the correct dashboard based on the user's role
            showDashboard(user.role);

            if (user.role === 'admin') {
                await fetchAdminData();
            } else {
                // Populate user profile card for non-admins
                document.getElementById('user-id').textContent = data.user.id;
                document.getElementById('user-username').textContent = data.user.username;
                document.getElementById('user-email').textContent = data.user.email;
                await fetchUserActivity(user.id);
            }
        } else {
            // If user data is invalid, clear storage and redirect
            localStorage.removeItem('user');
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        welcomeMessage.textContent = 'Could not load dashboard data.';
    }
})();

// Logout functionality
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
});