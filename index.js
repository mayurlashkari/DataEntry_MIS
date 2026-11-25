const express = require('express')
 
const app = express();
app.use(express.json());
const pool = require('./db');
const initDb = require('./db/initDb');
const centerOpt = require('./modules/center_opt');
const masterData = require('./modules/master_data');
const employeeOpt = require('./modules/employee_opt');
const _app_Port = 5025;

app.use('/centers', centerOpt.router);
app.use('/master', masterData.router);
app.use('/employees', employeeOpt.router);

app.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function getUsers() {
  const { rows } = await pool.query('SELECT * FROM users;');
  console.log('Retrieved users:', rows);
  return rows;
}



// Create tables / insert master data first, then start accepting requests.
initDb()
  .then(() => {
    app.listen(_app_Port, () => {
      console.log("listening on " + _app_Port + " ");
    });
  })
  .catch((err) => {
    // Log the whole error: some (e.g. ECONNREFUSED AggregateError) have an empty message.
    console.error(
      `Database initialisation failed (host=${process.env.PGHOST || '<not set>'}, ` +
        `port=${process.env.PGPORT || '<not set>'}, db=${process.env.PGDATABASE || '<not set>'}):`,
      err
    );
    process.exit(1);
  });