// public/js/auth.js

/**
 * Verifies the user's token and sets up user data if valid.
 * Redirects to index.html if no token or token is invalid/expired.
 * @returns {Promise<Object|null>} A promise that resolves to the user object or null.
 */
async function verifyAndSetupUser() {
    console.log("Auth: verifyAndSetupUser starting.");
    const token = localStorage.getItem('token');
    console.log("Auth: Retrieved token:", token ? "Token found (length: " + token.length + ")" : "No token found in localStorage.");

    if (!token) {
        console.warn("Auth: No token found. Redirecting to /index.html.");
        alert("Your session has expired or you are not logged in. Please log in again.");
        window.location.href = '/index.html'; // Redirect to index/login page
        return null;
    }

    try {
        // Call your backend Netlify function to verify the token
        console.log("Auth: Sending token to verify-token Netlify function.");
        const response = await fetch('/.netlify/functions/verify-token', {
            method: 'POST', // Assuming POST for token verification
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Send the token in the Authorization header
            }
        });

        console.log("Auth: Verify-token API Response Status:", response.status);

        if (!response.ok) {
            const errorData = await response.json(); // Attempt to parse error details
            console.error("Auth: Token verification failed. API error:", response.status, errorData);
            throw new Error(errorData.message || 'Token verification failed.');
        }

        const userData = await response.json();
        console.log("Auth: Token verified. User data received:", userData);
        // Assuming your verify-token function returns { user: { id, username, email, role, company_id, company_name } }
        return userData.user;

    } catch (error) {
        console.error("Auth: Error during token verification:", error);
        localStorage.removeItem('token'); // Clear the invalid or expired token
        alert("Session invalid or expired. Please log in again.");
        window.location.href = '/index.html'; // Redirect on verification failure
        return null;
    }
}

// Make verifyAndSetupUser globally accessible for onload in HTML
window.verifyAndSetupUser = verifyAndSetupUser;
