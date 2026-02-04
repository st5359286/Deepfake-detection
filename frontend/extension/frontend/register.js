document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = e.target.username.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const messageDisplay = document.getElementById('message-display');

    // Clear previous messages
    messageDisplay.textContent = '';
    messageDisplay.className = 'text-center min-h-[20px]';

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            messageDisplay.textContent = data.message;
            messageDisplay.classList.add('text-green-400');
            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
        } else {
            messageDisplay.textContent = data.message || 'Registration failed.';
            messageDisplay.classList.add('text-red-400');
        }
    } catch (error) {
        console.error('Registration error:', error);
        messageDisplay.textContent = 'An error occurred. Please try again later.';
        messageDisplay.classList.add('text-red-400');
    }
});