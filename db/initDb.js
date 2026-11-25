const fs = require('fs');
const path = require('path');
const pool = require('../db');

const INIT_SQL = path.join(__dirname, 'init.sql');

// Reads db/init.sql and runs it in one transaction.
// If any statement fails, everything is rolled back and the error is thrown.
async function initDb() {
  const sql = fs.readFileSync(INIT_SQL, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Database initialised from', path.basename(INIT_SQL));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = initDb;
