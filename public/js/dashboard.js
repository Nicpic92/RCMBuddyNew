// js/dashboard.js

// This function will be called after a successful user verification
async function initDashboard(user) {
    console.log("Initializing dashboard for user:", user);

    // Update profile link/name
    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        // Assuming 'user' object has 'username' and 'company_name'
        profileLink.textContent = `Hello, ${user.username || 'User'}!`;
    }

    // Update company display
    const companyDisplay = document.getElementById('company-display');
    if (companyDisplay && user.company_name) {
        companyDisplay.textContent = `Company: ${user.company_name}`;
    }

    // Setup Logout Button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Fetch and display authorized tools
    await displayAuthorizedTools(user.company_id); // Assuming user object contains company_id
}

async function displayAuthorizedTools(companyId) {
    const toolCards = document.querySelectorAll('.tool-card[data-tool-identifier]');

    try {
        // --- IMPORTANT: Replace this with your actual API endpoint for tools ---
        // This endpoint should return an array of strings, e.g., ['file-manager', 'data-cleaner']
        const response = await fetch(`/api/get-company-tools?companyId=${companyId}`, {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 // Include authorization token if your API requires it
                 'Authorization': `Bearer ${localStorage.getItem('token')}`
             }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const authorizedTools = await response.json(); // Expects an array of tool identifiers

        console.log("Authorized tools:", authorizedTools);

        toolCards.forEach(card => {
            const toolIdentifier = card.getAttribute('data-tool-identifier');
            if (authorizedTools.includes(toolIdentifier)) {
                card.classList.remove('hidden'); // Show the tool card
            } else {
                card.classList.add('hidden'); // Ensure it's hidden if not authorized (redundant if all start hidden)
            }
        });

    } catch (error) {
        console.error("Error fetching authorized tools:", error);
        // Optionally, display an error message to the user
        // alert("Failed to load tools. Please try again later.");
        // As a fallback, you might hide all tools or show a generic message
        toolCards.forEach(card => card.classList.add('hidden'));
    }
}

// Assuming auth.js provides verifyAndSetupUser and handleLogout
// If not, you'll need to define verifyAndSetupUser and handleLogout here
/*
async function verifyAndSetupUser() {
    // Implement your token verification and user data fetching here
    // Example (replace with your actual auth logic):
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html'; // Redirect to login if no token
        return null;
    }
    try {
        const response = await fetch('/.netlify/functions/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Token verification failed');
        }
        const userData = await response.json();
        return userData.user; // Assuming your verify-token function returns { user: { id, username, company_name, company_id, ... }}
    } catch (error) {
        console.error("Authentication failed:", error);
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return null;
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}
*/
