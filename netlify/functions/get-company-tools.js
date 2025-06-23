const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async (event) => {
    const token = event.headers.authorization?.split(' ')[1]; // Extract Bearer token
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Unauthorized: No token provided' })
        };
    }

    const { companyId } = event.queryStringParameters || {};
    if (!companyId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Bad Request: companyId is required' })
        };
    }

    try {
        const client = await pool.connect();
        const result = await client.query(
            `SELECT t.identifier 
             FROM tools t 
             JOIN company_tools ct ON t.id = ct.tool_id 
             WHERE ct.company_id = $1`,
            [companyId]
        );
        client.release();

        const authorizedTools = result.rows.map(row => row.identifier);
        console.log("Database query result for companyId", companyId, ":", authorizedTools);
        return {
            statusCode: 200,
            body: JSON.stringify(authorizedTools)
        };
    } catch (error) {
        console.error('Database error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }
};
