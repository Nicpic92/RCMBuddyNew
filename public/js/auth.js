// public/js/auth.js

async function verifyAndSetupUser() {
    console.log("Auth (Frontend): verifyAndSetupUser starting.");
    const token = localStorage.getItem('token');
    console.log("Auth (Frontend): Retrieved token:", token ? "Token found (length: " + token.length + ")" : "No token found in localStorage.");

    if (!token) {
        console.warn("Auth (Frontend): No token found. Redirecting to /index.html.");
        alert("Your session has expired or you are not logged in. Please log in again.");
        window.location.href = '/index.html';
        return null;
    }

    try {
        console.log("Auth (Frontend): Sending token to verify-token Netlify function for validation.");
        const response = await fetch('/.netlify/functions/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log("Auth (Frontend): Verify-token API Response Status:", response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Auth (Frontend): Token verification failed. API error:", response.status, errorData);
            throw new Error(errorData.message || 'Token verification failed.');
        }

        const userData = await response.json();
        console.log("Auth (Frontend): Token verified. User data received:", userData);
        return userData.user;

    } catch (error) {
        console.error("Auth (Frontend): Error during token verification:", error);
        localStorage.removeItem('token');
        alert("Session invalid or expired. Please log in again.");
        window.location.href = '/index.html';
        return null;
    }
}

window.verifyAndSetupUser = verifyAndSetupUser;
