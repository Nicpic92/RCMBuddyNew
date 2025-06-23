// netlify/functions/verify-token.js

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async function(event) {
    console.log("Backend Verify Token Function: Request received.");
    if (event.httpMethod !== 'POST') {
        console.warn('Backend Verify Token Function: Method Not Allowed. Expected POST.');
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    if (!JWT_SECRET) {
        console.error('Backend Verify Token Function: JWT_SECRET environment variable is NOT set!');
        return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error: JWT secret missing.' }) };
    }

    const authHeader = event.headers.authorization;
    console.log("Backend Verify Token Function: Authorization Header:", authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Backend Verify Token Function: No or invalid Authorization header provided.');
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization token required.' }) };
    }

    const token = authHeader.split(' ')[1];
    console.log("Backend Verify Token Function: Token extracted (first 10 chars):", token.substring(0,10) + "...");

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Backend Verify Token Function: Token verified. Decoded payload:', decoded);

        const user = {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role,
            companyId: decoded.companyId,
            company_name: decoded.company_name
        };

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Token is valid.', user: user }),
        };

    } catch (error) {
        console.error('Backend Verify Token Function: Token verification FAILED:', error.message);
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
};
