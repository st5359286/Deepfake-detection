document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = e.target.username.value;
    const password = e.target.password.value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            // Store user info and redirect to dashboard
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/dashboard.html'; // Redirect to the new dashboard
        } else {
            // Show error message
            errorMessage.textContent = data.message || 'Login failed.';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'An error occurred. Please try again later.';
    }
});