require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,          // e.g. 203.0.113.10
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false }, // only if the server requires SSL
  max: 10,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;