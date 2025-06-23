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
    console.log("Display Tools: Checking DOM for tool cards");
    const toolCards = document.querySelectorAll('.tool-card[data-tool-identifier]');
    console.log("Display Tools: Found", toolCards.length, "initial tool cards:", Array.from(toolCards).map(card => card.getAttribute('data-tool-identifier')));

    if (toolCards.length === 0) {
        console.error("Display Tools: No tool cards found in DOM. Rendering may fail.");
        alert("Error: Tool cards not found. Check HTML structure.");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
