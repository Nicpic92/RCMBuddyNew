// netlify/functions/get-company-tools.js

const { Pool } = require('pg'); // Ensure 'pg' is in your package.json dependencies

// Initialize the database pool (similar to your db.js)
// This will get the DATABASE_URL from Netlify environment variables
let pool;
function getDbPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            console.error('DATABASE_URL environment variable is not set for get-company-tools.');
            throw new Error('Database connection string is missing.');
        }
        pool = new Pool({
            connectionString: connectionString,
            // ssl: { rejectUnauthorized: false } // Uncomment if you face SSL issues and confirmed your setup allows it (use with caution)
        });
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client for get-company-tools', err);
        });
        console.log("PostgreSQL Pool initialized for get-company-tools.");
    }
    return pool;
}


exports.handler = async function(event) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const companyId = event.queryStringParameters.companyId;

    if (!companyId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'companyId is required.' })
        };
    }

    let client;
    try {
        const dbPool = getDbPool(); // Get the shared pool
        client = await dbPool.connect(); // Get a client from the pool

        // Query to get tool identifiers for the given companyId
        // We join company_tools with tools to get the 'identifier' string
        const query = `
            SELECT t.identifier
            FROM company_tools ct
            JOIN tools t ON ct.tool_id = t.id
            WHERE ct.company_id = $1;
        `;
        const result = await client.query(query, [companyId]);

        // Extract identifiers into an array
        const authorizedToolIdentifiers = result.rows.map(row => row.identifier);

        console.log(`Fetched authorized tools for company ${companyId}:`, authorizedToolIdentifiers);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // CORS for local development; narrow in production
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(authorizedToolIdentifiers)
        };

    } catch (error) {
        console.error('Database query error in get-company-tools:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*', // CORS
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({ message: 'Failed to fetch authorized tools.', error: error.message })
        };
    } finally {
        if (client) {
            client.release(); // Release the client back to the pool
        }
    }
};
