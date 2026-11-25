require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default pg converts
// them to a JS Date at local midnight, which in IST (+05:30) serialises to
// the previous day, e.g. 2026-11-26 -> "2026-11-25T18:30:00.000Z".
types.setTypeParser(types.builtins.DATE, (value) => value);

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