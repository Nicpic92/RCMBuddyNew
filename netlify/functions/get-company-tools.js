// netlify/functions/get-company-tools.js

const { Pool } = require('pg');

let pool;
function getDbPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        console.log("Function Startup (get-company-tools): Attempting to initialize DB pool.");

        if (!connectionString) {
            console.error('ERROR (get-company-tools): DATABASE_URL environment variable is NOT set. Function will fail.');
            throw new Error('Database connection string is missing from Netlify environment variables.');
        }

        pool = new Pool({
            connectionString: connectionString,
            /*
            ssl: {
                rejectUnauthorized: false
            }
            */
        });

        pool.on('error', (err, client) => {
            console.error('CRITICAL DB Pool Error (get-company-tools): Unexpected error on idle client or during acquisition.', err);
        });
        console.log("Function Startup (get-company-tools): PostgreSQL Pool initialized successfully.");
    }
    return pool;
}


exports.handler = async function(event, context) {
    console.log("Function Invocation (get-company-tools): Request received.");

    if (event.httpMethod !== 'GET') {
        console.warn(`Function Invocation (get-company-tools): Method Not Allowed. Received ${event.httpMethod}.`);
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const companyId = event.queryStringParameters.companyId;
    console.log(`Function Invocation (get-company-tools): Processing request for companyId: "${companyId}"`);

    if (!companyId) {
        console.error("Function Invocation (get-company-tools): ERROR: 'companyId' is missing from query parameters.");
        return { statusCode: 400, body: JSON.stringify({ message: 'companyId is required in query parameters.' }) };
    }

    let client;
    try {
        const dbPool = getDbPool();
        client = await dbPool.connect();
        console.log("Function Invocation (get-company-tools): Successfully obtained DB client.");

        const query = `
            SELECT t.identifier
            FROM company_tools ct
            JOIN tools t ON ct.tool_id = t.id
            WHERE ct.company_id = $1;
        `;
        console.log(`Function Invocation (get-company-tools): Executing SQL query for companyId: ${companyId}.`);
        const result = await client.query(query, [companyId]);
        console.log(`Function Invocation (get-company-tools): DB query returned ${result.rows.length} rows.`);

        const authorizedToolIdentifiers = result.rows.map(row => row.identifier);

        console.log("Function Invocation (get-company-tools): Authorized tool identifiers:", authorizedToolIdentifiers);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(authorizedToolIdentifiers)
        };

    } catch (error) {
        console.error('Function Invocation (get-company-tools): FATAL ERROR during execution:', error);
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
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    } finally {
        if (client) {
            client.release();
            console.log("Function Invocation (get-company-tools): Database client released back to pool.");
        }
    }
};
