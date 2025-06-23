// public/js/login.js

// Declare these variables in a scope accessible to handleLoginSubmit
const loginForm = document.getElementById('loginForm');
const messageElement = document.getElementById('message'); // <-- MOVED HERE

document.addEventListener('DOMContentLoaded', () => {
    // These elements are now assigned to the globally-scoped variables
    // No need to redeclare with const/let here, just ensure they are assigned
    // if the DOM might not be ready instantly. However, for `DOMContentLoaded`
    // this pattern ensures they are found once the DOM is parsed.
    // If you prefer, you can still assign them inside here:
    // const loginForm = document.getElementById('loginForm');
    // const messageElement = document.getElementById('message');
    // BUT then handleLoginSubmit MUST be nested inside this DOMContentLoaded callback

    // The current structure where handleLoginSubmit is separate,
    // requires the elements to be retrieved globally or passed.
    // The most common approach for this is to retrieve them once DOM is ready.
    // So, we'll keep the retrieval within DOMContentLoaded, but make them
    // accessible to handleLoginSubmit via passing or by making handleLoginSubmit
    // a nested function. Let's make handleLoginSubmit nested for clarity on scope.

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Optional: Check for existing token and redirect if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        console.log("Login page: Token found in localStorage. Redirecting to dashboard.");
        window.location.href = '/dashboard.html';
    }
});

// handleLoginSubmit now has access to messageElement and loginForm
// because they are declared in the same global scope.
async function handleLoginSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // messageElement is now defined because it's in the global scope
    messageElement.textContent = ''; // Clear previous messages

    if (!username || !password) {
        messageElement.textContent = 'Please enter both username and password.';
        return;
    }

    try {
        console.log("Login: Sending credentials to backend login function.");
        const response = await fetch('/.netlify/functions/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log("Login: Backend response data:", data);

        if (!response.ok) {
            throw new Error(data.message || 'Login failed due to server error.');
        }

        const token = data.token;
        if (token) {
            localStorage.setItem('token', token);
            console.log("Login: Token successfully saved to localStorage. Redirecting to dashboard.");
            window.location.href = '/dashboard.html';
        } else {
            console.error("Login Error: Token was NOT received in backend response.");
            messageElement.textContent = 'Login successful, but no session token received. Please try again.';
        }

    } catch (error) {
        console.error("Login Failed:", error);
        messageElement.textContent = error.message || "An unexpected error occurred during login.";
    }
}
