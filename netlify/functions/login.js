// netlify/functions/login.js

const { createDbClient } = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

exports.handler = async function(event) {
    console.log("Backend Login Function: Request received.");
    console.log("Backend Login Function: HTTP Method:", event.httpMethod);

    if (event.httpMethod !== 'POST') {
        console.warn('Backend Login Function: Method Not Allowed. Expected POST.');
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    console.log("Backend Login Function: Raw event.body:", event.body);

    let parsedBody;
    try {
        parsedBody = JSON.parse(event.body);
        console.log("Backend Login Function: Successfully parsed event.body.");
    } catch (e) {
        console.error("Backend Login Function: ERROR parsing JSON body:", e.message, "Raw body was:", event.body);
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body. Check request format.' }) };
    }

    const { username, password } = parsedBody;
    console.log("Backend Login Function: Parsed username:", username);
    console.log("Backend Login Function: Parsed password status:", password ? 'Present' : 'Missing');

    if (!username || !password) {
        console.warn("Backend Login Function: Missing username or password after parsing.");
        return { statusCode: 400, body: JSON.stringify({ message: 'Username and password are required.' }) };
    }

    if (!JWT_SECRET) {
        console.error('Backend Login Function: JWT_SECRET environment variable is NOT set!');
        return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error: JWT secret missing.' }) };
    }

    let client;
    try {
        client = await createDbClient();
        console.log("Backend Login Function: Database client obtained.");
        
        const userQuery = `
            SELECT u.id, u.username, u.email, u.password_hash, u.role, u.company_id, c.name as company_name
            FROM users u
            JOIN companies c ON u.company_id = c.id
            WHERE u.username = $1;
        `;
        console.log("Backend Login Function: Querying user for username:", username);
        const userResult = await client.query(userQuery, [username]);
        console.log("Backend Login Function: User query rows returned:", userResult.rows.length);

        if (userResult.rows.length === 0) {
            console.warn("Backend Login Function: User not found for username:", username);
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }

        const user = userResult.rows[0];
        console.log("Backend Login Function: User found. Comparing passwords.");

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.warn("Backend Login Function: Password mismatch for user:", username);
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }

        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            companyId: user.company_id,
            company_name: user.company_name
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        console.log("Backend Login Function: JWT token generated successfully.");

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Login successful!',
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    companyId: user.company_id,
                    company_name: user.company_name
                }
            }),
        };

    } catch (error) {
        console.error('Backend Login Function: FATAL ERROR:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'An internal server error occurred.', error: error.message }) };
    } finally {
        if (client) {
            client.release();
            console.log("Backend Login Function: Database client released.");
        }
    }
};
