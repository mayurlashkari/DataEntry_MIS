const express = require('express')
 
const app = express();
app.use(express.json());
const pool = require('./db');
const _app_Port = 5025;
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



app.listen(_app_Port,async ()=>{
   
    console.log("listening on "+ _app_Port +" ");

});