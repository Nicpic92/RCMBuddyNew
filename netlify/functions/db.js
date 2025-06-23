// netlify/functions/db.js

const { Pool } = require('pg');

let pool;

function createDbClient() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.error('DB Utility: DATABASE_URL environment variable is not set. Database connection will fail.');
      throw new Error('Database connection string is missing.');
    }

    pool = new Pool({
      connectionString: connectionString,
      /*
      ssl: {
        rejectUnauthorized: false
      }
      */
    });

    pool.on('error', (err) => {
      console.error('DB Utility: Unexpected error on idle client', err);
    });
    console.log("DB Utility: PostgreSQL Pool initialized.");
  }
  return pool.connect();
}

module.exports = {
  createDbClient
};
