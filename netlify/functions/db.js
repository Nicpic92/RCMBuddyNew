// netlify/functions/db.js (or netlify/functions/utils/db.js if you put it in a utils folder)

const { Pool } = require('pg');

let pool; // Declare pool outside the function so it's initialized only once

function createDbClient() {
    // Initialize the pool only if it hasn't been initialized yet
    // This ensures only one connection pool is created per function instance (or cold start)
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            // Log an error if the environment variable is missing
            console.error('DATABASE_URL environment variable is not set. Database connection will fail.');
            throw new Error('Database connection string is missing. Please set DATABASE_URL in Netlify environment variables.');
        }

        pool = new Pool({
            connectionString: connectionString,
            // Neon's connection string often includes sslmode=require, which should handle SSL.
            // If you encounter SSL errors, you might need to uncomment and adjust the ssl option.
            // For most Neon setups, the connection string itself is sufficient.
            /*
            ssl: {
                rejectUnauthorized: false // Use with caution for production if you don't have CA certs
            }
            */
        });

        // Optional: Add an error listener for the pool itself
        pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client or during acquisition', err);
            // It's generally not recommended to exit the process in a serverless function
            // due to an idle client error, but rather to log and let the function retry or fail.
        });

        console.log("PostgreSQL Pool initialized."); // For debugging
    }

    // Return a client from the pool
    // IMPORTANT: When you are done with the client, you MUST call client.release()
    // This is handled in the `finally` block of register.js
    return pool.connect();
}

module.exports = {
    createDbClient
};
