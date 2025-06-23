// netlify/functions/db.js
const { Client } = require('pg');

async function createDbClient() {
    const client = new Client({
        //connectionString: process.env.NEON_DATABASE_URL,
        connectionString: 'postgresql://neondb_owner:npg_GDeTcy0xCKd1@ep-autumn-night-a5acrhgw-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
        ssl: {
            rejectUnauthorized: false
        }
    });
    await client.connect();
    return client;
}

// Export createDbClient for use in other files
module.exports.createDbClient = createDbClient;

// Netlify function handler
exports.handler = async function (event, context) {
    try {
        const client = await createDbClient();

        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Method Not Allowed' })
            };
        }

        const body = JSON.parse(event.body || '{}');
        const { rows } = await client.query('SELECT NOW() as current_time');

        await client.end();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Database query successful',
                data: rows[0]
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
        };
    }
};