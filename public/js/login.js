// public/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const messageElement = document.getElementById('message');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Optional: Check for existing token and redirect if already logged in
    // This is typically handled by auth.js on dashboard.html, but can be here too.
    const token = localStorage.getItem('token');
    if (token) {
        // You might want to call a quick verification here if token could be stale
        // For simplicity, we just redirect. Dashboard's auth.js will verify.
        console.log("Login page: Token found in localStorage. Redirecting to dashboard.");
        window.location.href = '/dashboard.html';
    }
});

async function handleLoginSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    messageElement.textContent = ''; // Clear previous messages

    if (!username || !password) {
        messageElement.textContent = 'Please enter both username and password.';
        return;
    }

    try {
        console.log("Login: Sending credentials to backend login function.");
        const response = await fetch('/.netlify/functions/login', { // Call your backend Netlify Function
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json(); // Always try to parse JSON for errors too
        console.log("Login: Backend response data:", data);

        if (!response.ok) {
            // If backend returns a non-200 status, it's an error
            throw new Error(data.message || 'Login failed due to server error.');
        }

        const token = data.token; // CRITICAL: Assuming your backend login function returns a 'token' property
        if (token) {
            localStorage.setItem('token', token); // CRITICAL: Save the token to local storage
            console.log("Login: Token successfully saved to localStorage. Redirecting to dashboard.");
            window.location.href = '/dashboard.html'; // Redirect to dashboard on success
        } else {
            console.error("Login Error: Token was NOT received in backend response.");
            messageElement.textContent = 'Login successful, but no token received. Please try again.';
        }

    } catch (error) {
        console.error("Login Failed:", error);
        messageElement.textContent = error.message || "An unexpected error occurred during login.";
    }
}
