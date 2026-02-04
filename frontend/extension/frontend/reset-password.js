document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const messageDisplay = document.getElementById('message-display');
    const loginLink = document.getElementById('login-link');

    // Get the token from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        messageDisplay.textContent = 'Invalid or missing password reset token.';
        messageDisplay.classList.add('text-red-400');
        form.hidden = true;
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = e.target.password.value;
        const submitButton = e.target.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.textContent = 'Resetting...';

        try {
            const response = await fetch('http://localhost:3000/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (response.ok) {
                messageDisplay.textContent = data.message;
                messageDisplay.className = 'text-center min-h-[20px] text-green-400';
                form.hidden = true;
                loginLink.classList.remove('hidden');
            } else {
                messageDisplay.textContent = data.message || 'Failed to reset password.';
                messageDisplay.className = 'text-center min-h-[20px] text-red-400';
                submitButton.disabled = false;
                submitButton.textContent = 'Reset Password';
            }
        } catch (error) {
            console.error('Reset password error:', error);
            messageDisplay.textContent = 'An error occurred. Please try again.';
            messageDisplay.className = 'text-center min-h-[20px] text-red-400';
            submitButton.disabled = false;
            submitButton.textContent = 'Reset Password';
        }
    });
});