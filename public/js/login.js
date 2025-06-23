// public/js/login.js

// Declare these variables globally within this script file
// They will be assigned values once the DOM is loaded via DOMContentLoaded
let loginForm;
let messageElement;

document.addEventListener('DOMContentLoaded', () => {
    loginForm = document.getElementById('loginForm');
    messageElement = document.getElementById('message');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
        console.log("Frontend Login: Form event listener attached.");
    } else {
        console.error("Frontend Login: Login form (ID: loginForm) not found.");
    }

    // Optional: Check for existing token and redirect if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        console.log("Frontend Login: Token found in localStorage. Attempting redirect to dashboard.");
        window.location.href = '/dashboard.html';
    }
});

async function handleLoginSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (messageElement) { // Safely clear message if element exists
        messageElement.textContent = '';
    }
    console.log("Frontend Login: Attempting login for username:", username); // Log the username

    if (!username || !password) {
        if (messageElement) {
            messageElement.textContent = 'Please enter both username and password.';
        }
        console.warn("Frontend Login: Username or password fields are empty.");
        return;
    }

    try {
        // Prepare the body as a JavaScript object
        const requestBody = { username: username, password: password };
        console.log("Frontend Login: Request body being sent:", JSON.stringify(requestBody)); // Log the JSON string

        const response = await fetch('/.netlify/functions/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody) // Stringify the JS object
        });

        const data = await response.json();
        console.log("Frontend Login: Backend response data:", data);

        if (!response.ok) {
            throw new Error(data.message || 'Login failed due to server error.');
        }

        const token = data.token;
        if (token) {
            localStorage.setItem('token', token);
            console.log("Frontend Login: Token successfully saved to localStorage. Redirecting to dashboard.");
            window.location.href = '/dashboard.html';
        } else {
            console.error("Frontend Login Error: Token was NOT received in backend response.");
            if (messageElement) {
                messageElement.textContent = 'Login successful, but no session token received. Please try again.';
            }
        }

    } catch (error) {
        console.error("Frontend Login Failed:", error);
        if (messageElement) {
            messageElement.textContent = error.message || "An unexpected error occurred during login.";
        }
    }
}
