// netlify/functions/get-accessible-tools.js

const { Pool } = require('pg');
const jwt = require('jsonwebtoken'); // Assuming you want to verify token for this function too
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

let pool;
function getDbPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        console.log("Function Startup (get-accessible-tools): Attempting to initialize DB pool.");
        if (!connectionString) {
            console.error('ERROR (get-accessible-tools): DATABASE_URL environment variable is NOT set. Function will fail.');
            throw new Error('Database connection string is missing from Netlify environment variables.');
        }
        pool = new Pool({ connectionString: connectionString });
        pool.on('error', (err, client) => {
            console.error('CRITICAL DB Pool Error (get-accessible-tools): Unexpected error on idle client or during acquisition.', err);
        });
        console.log("Function Startup (get-accessible-tools): PostgreSQL Pool initialized successfully.");
    }
    return pool;
}

exports.handler = async function(event) {
    console.log("Function Invocation (get-accessible-tools): Request received.");

    if (event.httpMethod !== 'GET') {
        console.warn(`Function Invocation (get-accessible-tools): Method Not Allowed. Received ${event.httpMethod}.`);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Method Not Allowed. Only GET is supported.' })
        };
    }

    // Optional: Verify JWT token for this function as well
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Function Invocation (get-accessible-tools): No or invalid Authorization header provided.');
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization token required.' }) };
    }
    const token = authHeader.split(' ')[1];

    let companyId;
    try {
        if (!JWT_SECRET) {
            console.error('Function Invocation (get-accessible-tools): JWT_SECRET is not set!');
            return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error.' }) };
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        companyId = decoded.companyId; // Get companyId from the decoded token
        console.log('Function Invocation (get-accessible-tools): Token verified. CompanyId from token:', companyId);
    } catch (error) {
        console.error('Function Invocation (get-accessible-tools): Token verification failed:', error.message);
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    // Ensure companyId is available from token
    if (!companyId) {
        console.error("Function Invocation (get-accessible-tools): ERROR: companyId could not be extracted from token.");
        return { statusCode: 400, body: JSON.stringify({ message: 'Company ID could not be determined from token.' }) };
    }

    let client;
    try {
        const dbPool = getDbPool();
        client = await dbPool.connect();
        console.log("Function Invocation (get-accessible-tools): Successfully obtained DB client.");

        // Query to get all tool identifiers for the given companyId
        const query = `
            SELECT t.identifier
            FROM company_tools ct
            JOIN tools t ON ct.tool_id = t.id
            WHERE ct.company_id = $1;
        `;
        console.log(`Function Invocation (get-accessible-tools): Executing SQL query for companyId: ${companyId}.`);
        const result = await client.query(query, [companyId]);
        console.log(`Function Invocation (get-accessible-tools): DB query returned ${result.rows.length} rows.`);

        const accessibleToolIdentifiers = result.rows.map(row => row.identifier);
        console.log("Function Invocation (get-accessible-tools): Accessible tool identifiers:", accessibleToolIdentifiers);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(accessibleToolIdentifiers)
        };

    } catch (error) {
        console.error('Function Invocation (get-accessible-tools): FATAL ERROR during execution:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                message: 'Internal Server Error: Failed to fetch accessible tools.',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    } finally {
        if (client) {
            client.release();
            console.log("Function Invocation (get-accessible-tools): Database client released back to pool.");
        }
    }
};
