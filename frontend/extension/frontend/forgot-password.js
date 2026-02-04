document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = e.target.email.value;
    const messageDisplay = document.getElementById('message-display');
    const submitButton = e.target.querySelector('button[type="submit"]');

    messageDisplay.textContent = '';
    messageDisplay.className = 'text-center min-h-[20px]';
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
        const response = await fetch('http://localhost:3000/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        // Always show a success message to prevent email enumeration
        messageDisplay.textContent = data.message;
        messageDisplay.classList.add('text-green-400');

    } catch (error) {
        console.error('Forgot password error:', error);
        messageDisplay.textContent = 'An error occurred. Please try again.';
        messageDisplay.classList.add('text-red-400');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Reset Link';
    }
});