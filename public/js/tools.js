// public/js/tools.js

/**
 * Initializes the tools page after user authentication.
 * @param {Object} user - The authenticated user object.
 */
async function initToolsPage(user) {
    console.log("Tools Page Initialization: Starting for user:", user);

    // Update profile link/name in the navbar
    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        profileLink.textContent = `Hello, ${user.username || 'User'}!`;
        console.log("Tools Page: Profile link updated to:", profileLink.textContent);
    } else {
        console.warn("Tools Page: Profile link element (ID: profileLink) not found in navbar.");
    }

    // Setup Logout Button (similar to dashboard.js if it's on this page too)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log("Tools Page: Logout button event listener attached.");
    } else {
        console.warn("Tools Page: Logout button not found (ID: logoutBtn).");
    }

    // Call function to fetch and display accessible tools
    if (user.companyId) {
        console.log("Tools Page: Attempting to display accessible tools for companyId:", user.companyId);
        await displayAccessibleTools(user.companyId);
    } else {
        console.warn("Tools Page: User has no companyId. Cannot fetch accessible tools.");
        // Fallback: show all tools if permissions can't be fetched
        document.querySelectorAll('.tool-card[data-tool-identifier]').forEach(card => card.classList.remove('hidden'));
    }

    console.log("Tools Page Initialization: Completed.");
}

/**
 * Handles user logout: clears token and redirects to the landing page.
 * Defined here for tools.js, as well as in dashboard.js. Could be moved to auth.js globally.
 */
function handleLogout() {
    console.log("Logout: Initiated from Tools Page.");
    localStorage.removeItem('token');
    console.log("Logout: Token removed. Redirecting to /index.html");
    window.location.href = '/index.html';
}

/**
 * Fetches accessible tools from the backend and displays them on the /tools.html page.
 * @param {string} companyId - The company ID to fetch tools for.
 */
async function displayAccessibleTools(companyId) {
    const toolCards = document.querySelectorAll('.tool-card[data-tool-identifier]');
    console.log("Display Accessible Tools: Starting. Found", toolCards.length, "initial tool cards.");

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Display Accessible Tools: No authentication token found. Redirecting to login.");
            alert("Session expired or no token. Please log in again.");
            window.location.href = '/index.html';
            return;
        }

        // CORRECTED URL: Make sure this matches your Netlify Function's actual path
        // If your function is at netlify/functions/get-accessible-tools.js
        console.log("Display Accessible Tools: Fetching from API: /.netlify/functions/get-accessible-tools");
        const response = await fetch(`/.netlify/functions/get-accessible-tools?companyId=${companyId}`, { // Pass companyId as query param
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
             }
        });

        console.log("Display Accessible Tools: API Response Status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Display Accessible Tools: API HTTP Error:", response.status, errorText);
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const accessibleTools = await response.json();
        console.log("Display Accessible Tools: Accessible tools received from API:", accessibleTools);

        if (!Array.isArray(accessibleTools)) {
            console.error("Display Accessible Tools: API response is not an array:", accessibleTools);
            throw new Error("Invalid format for accessible tools from API. Expected an array.");
        }

        let toolsDisplayedCount = 0;
        toolCards.forEach(card => {
            const toolIdentifier = card.getAttribute('data-tool-identifier');
            if (accessibleTools.includes(toolIdentifier)) {
                card.classList.remove('hidden');
                toolsDisplayedCount++;
                console.log(`Display Accessible Tools: Showing tool: ${toolIdentifier}`);
            } else {
                card.classList.add('hidden');
                console.log(`Display Accessible Tools: Hiding tool: ${toolIdentifier}`);
            }
        });
        console.log(`Display Accessible Tools: Finished displaying tools. Total shown: ${toolsDisplayedCount}`);

    } catch (error) {
        console.error("Display Accessible Tools: Error fetching or displaying tools:", error);
        alert("An error occurred loading tool permissions. Displaying all tools (fallback).");
        // Fallback: If there's an error, just show all.
        toolCards.forEach(card => card.classList.remove('hidden'));
    }
}
