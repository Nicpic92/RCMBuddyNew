// public/js/dashboard.js

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
        logoutBtn.addEventListener('click', handleLogout); // This now correctly calls handleLogout
    }

    // Fetch and display authorized tools
    // Make sure user.company_id actually contains a value here (check console log above)
    if (user.companyId) {
        await displayAuthorizedTools(user.companyId);
    } else {
        console.warn("User has no companyId. Cannot fetch authorized tools.");
        // Optionally hide all tools if companyId is missing
        document.querySelectorAll('.tool-card[data-tool-identifier]').forEach(card => card.classList.add('hidden'));
    }
}

async function displayAuthorizedTools(companyId) {
    const toolCards = document.querySelectorAll('.tool-card[data-tool-identifier]');
    console.log("Starting displayAuthorizedTools for companyId:", companyId);
    console.log("Initial tool cards found:", toolCards.length);

    try {
        const token = localStorage.getItem('token'); // Ensure token is retrieved from localStorage

        // --- IMPORTANT: Replace this with your actual API endpoint for tools ---
        // This endpoint should return an array of strings, e.g., ['file-manager', 'data-cleaner']
        const response = await fetch(`/api/get-company-tools?companyId=${companyId}`, {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 // Include authorization token if your API requires it
                 'Authorization': `Bearer ${token}` // Make sure this is correctly passed
             }
        });

        console.log("API Response Status:", response.status);

        if (!response.ok) {
            const errorText = await response.text(); // Get more detailed error message
            console.error("API Error Response Text:", errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const authorizedTools = await response.json();
        console.log("Authorized tools received from API:", authorizedTools); // Crucial log

        if (!Array.isArray(authorizedTools)) {
            console.error("API response is not an array:", authorizedTools);
            throw new Error("Invalid format for authorized tools from API. Expected an array.");
        }

        let toolsDisplayedCount = 0;
        toolCards.forEach(card => {
            const toolIdentifier = card.getAttribute('data-tool-identifier');
            if (authorizedTools.includes(toolIdentifier)) {
                card.classList.remove('hidden'); // Show the tool card
                toolsDisplayedCount++;
                console.log(`Showing tool: ${toolIdentifier}`);
            } else {
                card.classList.add('hidden'); // Ensure it's hidden if not authorized
                console.log(`Hiding tool: ${toolIdentifier}`);
            }
        });
        console.log(`Finished displaying tools. Total shown: ${toolsDisplayedCount}`);

    } catch (error) {
        console.error("Error fetching or displaying authorized tools:", error);
        // Hide all tools in case of an error to avoid showing unauthorized content
        toolCards.forEach(card => card.classList.add('hidden'));
        alert("Failed to load tools. Please check console for details."); // This is the alert you're seeing
    }
}

// --- DEFINE handleLogout HERE to fix ReferenceError ---
function handleLogout() {
    console.log("Logging out...");
    localStorage.removeItem('token'); // Remove the JWT token
    // You might also want to clear any other user-related local storage items
    window.location.href = '/login.html'; // Redirect to your login page
}

// Note: The verifyAndSetupUser function is assumed to be in auth.js.
// It should be made globally accessible by auth.js (e.g., window.verifyAndSetupUser = verifyAndSetupUser;)
// or your build process should handle module imports correctly.
