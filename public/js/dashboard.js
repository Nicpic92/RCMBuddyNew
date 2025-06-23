// public/js/dashboard.js

// This function will be called after a successful user verification (from auth.js)
async function initDashboard(user) {
    console.log("Dashboard Initialization: Starting for user:", user);

    // Update profile link/name display
    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
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
        console.log("Dashboard Initialization: Logout button event listener attached.");
    } else {
        console.warn("Dashboard Initialization: Logout button not found (ID: logoutBtn).");
    }

    // Fetch and display authorized tools
    if (user.companyId) {
        console.log("Dashboard Initialization: Attempting to display authorized tools for companyId:", user.companyId);
        await displayAuthorizedTools(user.companyId);
    } else {
        console.warn("Dashboard Initialization: User has no companyId. Cannot fetch authorized tools.");
        document.querySelectorAll('.tool-card[data-tool-identifier]').forEach(card => card.classList.add('hidden'));
    }
    console.log("Dashboard Initialization: Completed.");
}

/**
 * Fetches authorized tools from the backend and displays them on the dashboard.
 * @param {string} companyId - The ID of the company to fetch tools for.
 */
async function displayAuthorizedTools(companyId) {
    const toolCards = document.querySelectorAll('.tool-card[data-tool-identifier]');
    console.log("Display Tools: Starting. Found", toolCards.length, "initial tool cards.");

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Display Tools: No authentication token found. Redirecting to login.");
            alert("Session expired or no token. Please log in again.");
            window.location.href = '/index.html'; // Redirect to index/login
            return;
        }

        console.log("Display Tools: Fetching from API: /api/get-company-tools?companyId=" + companyId);
        const response = await fetch(`/api/get-company-tools?companyId=${companyId}`, {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}` // Ensure token is passed
             }
        });

        console.log("Display Tools: API Response Status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Display Tools: API HTTP Error:", response.status, errorText);
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const authorizedTools = await response.json();
        console.log("Display Tools: Authorized tools received from API:", authorizedTools);

        if (!Array.isArray(authorizedTools)) {
            console.error("Display Tools: API response is not an array:", authorizedTools);
            throw new Error("Invalid format for authorized tools from API. Expected an array.");
        }

        let toolsDisplayedCount = 0;
        toolCards.forEach(card => {
            const toolIdentifier = card.getAttribute('data-tool-identifier');
            if (authorizedTools.includes(toolIdentifier)) {
                card.classList.remove('hidden'); // Show the tool card
                toolsDisplayedCount++;
                console.log(`Display Tools: Showing tool: ${toolIdentifier}`);
            } else {
                card.classList.add('hidden'); // Ensure it's hidden if not authorized
                console.log(`Display Tools: Hiding tool: ${toolIdentifier}`);
            }
        });
        console.log(`Display Tools: Finished displaying tools. Total shown: ${toolsDisplayedCount}`);

    } catch (error) {
        console.error("Display Tools: Error fetching or displaying authorized tools:", error);
        toolCards.forEach(card => card.classList.add('hidden'));
        alert("Failed to load tools. Please check console for details.");
    }
}

/**
 * Handles user logout: clears token and redirects to the landing page.
 */
function handleLogout() {
    console.log("Logout: Initiated.");
    localStorage.removeItem('token'); // Remove the JWT token
    console.log("Logout: Token removed. Redirecting to /index.html");
    window.location.href = '/index.html'; // Redirect to your main landing/login page
}
