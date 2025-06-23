// netlify/functions/get-company-tools.js

const { Pool } = require('pg'); // Ensure 'pg' is in your package.json dependencies

// Initialize the database pool (similar to your db.js)
// This will get the DATABASE_URL from Netlify environment variables
let pool;
function getDbPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        console.log("Attempting to get DB pool..."); // Log when trying to initialize pool

        if (!connectionString) {
            console.error('ERROR: DATABASE_URL environment variable is NOT set for get-company-tools. Function will fail.');
            throw new Error('Database connection string is missing.');
        }

        pool = new Pool({
            connectionString: connectionString,
            // Neon's connection string usually includes sslmode=require, handling SSL automatically.
            // If you still encounter SSL errors, uncomment and use with caution for production.
            /*
            ssl: {
                rejectUnauthorized: false
            }
            */
        });

        pool.on('error', (err, client) => {
            console.error('DB Pool Error in get-company-tools:', err, 'Client:', client ? 'present' : 'null');
            // In a serverless environment, errors on idle clients are less critical to crash for.
            // Log them, but let the function finish if possible.
        });
        console.log("SUCCESS: PostgreSQL Pool initialized for get-company-tools.");
    }
    return pool;
}


exports.handler = async function(event, context) { // Added 'context' parameter though not used here
    console.log("Function get-company-tools received a request.");

    if (event.httpMethod !== 'GET') {
        console.warn(`WARN: Method Not Allowed. Received ${event.httpMethod} for get-company-tools.`);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const companyId = event.queryStringParameters.companyId;
    console.log("Received companyId:", companyId);

    if (!companyId) {
        console.error("ERROR: companyId is missing from query parameters.");
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'companyId is required.' })
        };
    }

    let client; // Declare client outside try to ensure it's accessible in finally
    try {
        const dbPool = getDbPool(); // Get the shared pool
        client = await dbPool.connect(); // Get a client from the pool
        console.log("SUCCESS: Database client obtained from pool.");

        // Query to get tool identifiers for the given companyId
        // This query joins company_tools with tools to get the 'identifier' string
        // The 'identifier' column in 'tools' should match your HTML data-tool-identifier attributes
        const query = `
            SELECT t.identifier
            FROM company_tools ct
            JOIN tools t ON ct.tool_id = t.id
            WHERE ct.company_id = $1;
        `;
        console.log("Executing DB query for companyId:", companyId);
        const result = await client.query(query, [companyId]);
        console.log("DB Query Result Rows:", result.rows.length);

        // Extract identifiers into an array
        const authorizedToolIdentifiers = result.rows.map(row => row.identifier);

        console.log(`SUCCESS: Fetched authorized tools for company ${companyId}:`, authorizedToolIdentifiers);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // IMPORTANT: For production, narrow this to your actual frontend domain(s)
                'Access-Control-Allow-Methods': 'GET, OPTIONS', // Only GET is strictly needed for this function
                'Access-Control-Allow-Headers': 'Content-Type, Authorization' // Allow Authorization header if you add token validation later
            },
            body: JSON.stringify(authorizedToolIdentifiers)
        };

    } catch (error) {
        console.error('FATAL ERROR in get-company-tools:', error); // More prominent error logging
        return {
            statusCode: 500, // Now returning 500 for actual function errors
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({ message: 'Failed to fetch authorized tools due to server error.', error: error.message })
        };
    } finally {
        if (client) {
            client.release(); // Ensure client is released back to the pool
            console.log("Database client released.");
        }
    }
};
