const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const useSsl = typeof connectionString === 'string' &&
  !connectionString.includes('localhost') &&
  !connectionString.includes('127.0.0.1') &&
  !connectionString.includes('sslmode=disable');

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};