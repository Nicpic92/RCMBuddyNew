// public/js/dashboard.js

async function initDashboard(user) {
    console.log("Dashboard Initialization: Starting for user:", user);

    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        profileLink.textContent = `Hello, ${user.username || 'User'}!`;
    }

    const companyDisplay = document.getElementById('company-display');
    if (companyDisplay && user.company_name) {
        companyDisplay.textContent = `Company: ${user.company_name}`;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log("Dashboard Initialization: Logout button event listener attached.");
    } else {
        console.warn("Dashboard Initialization: Logout button not found (ID: logoutBtn).");
    }

    if (user.companyId) {
        console.log("Dashboard Initialization: Attempting to display authorized tools for companyId:", user.companyId);
        await displayAuthorizedTools(user.companyId);
    } else {
        console.warn("Dashboard Initialization: User has no companyId. Cannot fetch authorized tools.");
        document.querySelectorAll('.tool-card[data-tool-identifier]').forEach(card => card.classList.add('hidden'));
    }
    console.log("Dashboard Initialization: Completed.");
}

async function displayAuthorizedTools(companyId) {
    const toolCards = document.querySelectorAll('.tool-card[data-tool-identifier]');
    console.log("Display Tools: Starting. Found", toolCards.length, "initial tool cards.");

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Display Tools: No authentication token found. Redirecting to login.");
            alert("Session expired or no token. Please log in again.");
            window.location.href = '/index.html';
            return;
        }

        console.log("Display Tools: Fetching from API: /api/get-company-tools?companyId=" + companyId);
        const response = await fetch(`/api/get-company-tools?companyId=${companyId}`, {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
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
                card.classList.remove('hidden');
                toolsDisplayedCount++;
                console.log(`Display Tools: Showing tool: ${toolIdentifier}`);
            } else {
                card.classList.add('hidden');
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

function handleLogout() {
    console.log("Logout: Initiated.");
    localStorage.removeItem('token');
    console.log("Logout: Token removed. Redirecting to /index.html");
    window.location.href = '/index.html';
}
