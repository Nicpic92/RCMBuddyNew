// netlify/functions/get-company-tools.js

const { Pool } = require('pg'); // Ensure 'pg' is in your package.json dependencies

// Initialize the database pool only once per function instance (cold start)
let pool;
function getDbPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        console.log("Function Startup (get-company-tools): Attempting to initialize DB pool.");

        if (!connectionString) {
            console.error('ERROR (get-company-tools): DATABASE_URL environment variable is NOT set. Database connection will fail.');
            // Throwing an error here prevents the function from proceeding without credentials
            throw new Error('Database connection string is missing from Netlify environment variables.');
        }

        pool = new Pool({
            connectionString: connectionString,
            // Neon's connection string often includes sslmode=require, handling SSL automatically.
            // If you still encounter SSL errors (e.g., self-signed certificate errors in dev),
            // you might need to uncomment and adjust the ssl option. Use with caution for production.
            /*
            ssl: {
                rejectUnauthorized: false // WARNING: Disables certificate validation. Do not use in production without understanding risks.
            }
            */
        });

        // Add an error listener for the pool itself to catch unhandled pool errors
        pool.on('error', (err, client) => {
            console.error('CRITICAL DB Pool Error (get-company-tools): Unexpected error on idle client or during acquisition.', err);
            // In serverless, it's generally best to log and let the invocation fail,
            // rather than trying to gracefully recover a broken pool connection in a stateless environment.
        });
        console.log("Function Startup (get-company-tools): PostgreSQL Pool initialized successfully.");
    }
    return pool;
}


exports.handler = async function(event, context) {
    console.log("Function Invocation (get-company-tools): Request received.");

    // Ensure it's a GET request
    if (event.httpMethod !== 'GET') {
        console.warn(`Function Invocation (get-company-tools): Method Not Allowed. Received ${event.httpMethod}.`);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Method Not Allowed. Only GET is supported.' })
        };
    }

    // Extract companyId from query parameters
    const companyId = event.queryStringParameters.companyId;
    console.log(`Function Invocation (get-company-tools): Processing request for companyId: "${companyId}"`);

    if (!companyId) {
        console.error("Function Invocation (get-company-tools): ERROR: 'companyId' is missing from query parameters.");
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'companyId is required in query parameters.' })
        };
    }

    let client; // Declare client outside try to ensure it's accessible in finally for release
    try {
        const dbPool = getDbPool(); // Get the shared pool instance
        client = await dbPool.connect(); // Obtain a client from the pool
        console.log("Function Invocation (get-company-tools): Successfully obtained DB client.");

        // SQL Query to join company_tools and tools tables
        // Assumes 'company_tools' has 'company_id' and 'tool_id'
        // Assumes 'tools' has 'id' and 'identifier' (matching data-tool-identifier in HTML)
        const query = `
            SELECT t.identifier
            FROM company_tools ct
            JOIN tools t ON ct.tool_id = t.id
            WHERE ct.company_id = $1;
        `;
        console.log(`Function Invocation (get-company-tools): Executing SQL query for companyId: ${companyId}.`);
        const result = await client.query(query, [companyId]);
        console.log(`Function Invocation (get-company-tools): DB query returned ${result.rows.length} rows.`);

        // Map the result rows to an array of tool identifiers (strings)
        const authorizedToolIdentifiers = result.rows.map(row => row.identifier);

        console.log("Function Invocation (get-company-tools): Authorized tool identifiers:", authorizedToolIdentifiers);

        // Return a successful response with the list of tool identifiers
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // IMPORTANT: In production, change '*' to your specific frontend domain (e.g., 'https://rcmbuddy.com')
                'Access-Control-Allow-Methods': 'GET, OPTIONS', // Allow preflight OPTIONS requests from browser
                'Access-Control-Allow-Headers': 'Content-Type, Authorization' // Allow headers your frontend sends
            },
            body: JSON.stringify(authorizedToolIdentifiers)
        };

    } catch (error) {
        console.error('Function Invocation (get-company-tools): FATAL ERROR during execution:', error);
        // Return a 500 status code for internal server errors
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                message: 'Internal Server Error: Failed to fetch authorized tools.',
                error: error.message, // Include error message for debugging
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Optionally include stack in dev
            })
        };
    } finally {
        // Ensure the database client is released back to the pool
        if (client) {
            client.release();
            console.log("Function Invocation (get-company-tools): Database client released back to pool.");
        }
    }
};
