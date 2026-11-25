const express = require('express');
const pool = require('../db');

// Error with an HTTP status, so the route can return 400/409 instead of 500.
class CenterError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Add a new center.
 * @param {object} data
 * @param {string} data.center_code  required, unique (stored upper-case), max 30 chars
 * @param {string} data.center_name  required, max 150 chars
 * @param {string} [data.city]       optional, max 100 chars
 * @returns {Promise<object>} the inserted center row
 */
async function addCenter({ center_code, center_name, city } = {}) {
  const code = typeof center_code === 'string' ? center_code.trim().toUpperCase() : '';
  const name = typeof center_name === 'string' ? center_name.trim() : '';
  const cityVal = typeof city === 'string' && city.trim() ? city.trim() : null;

  if (!code) throw new CenterError(400, 'center_code is required');
  if (!name) throw new CenterError(400, 'center_name is required');
  if (code.length > 30) throw new CenterError(400, 'center_code must be at most 30 characters');
  if (name.length > 150) throw new CenterError(400, 'center_name must be at most 150 characters');
  if (cityVal && cityVal.length > 100) throw new CenterError(400, 'city must be at most 100 characters');

  try {
    const { rows } = await pool.query(
      `INSERT INTO centers (center_code, center_name, city)
       VALUES ($1, $2, $3)
       RETURNING center_id, center_code, center_name, city, is_active, created_at`,
      [code, name, cityVal]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on center_code
      throw new CenterError(409, `center_code '${code}' already exists`);
    }
    throw err;
  }
}

const CENTER_COLUMNS = 'center_id, center_code, center_name, city, is_active, created_at';

// Builds the WHERE clause for a center id (number) or center code (text).
function centerKey(idOrCode) {
  const key = String(idOrCode ?? '').trim();
  if (!key) throw new CenterError(400, 'center id or code is required');
  if (/^\d+$/.test(key)) return { where: 'center_id = $1', value: Number(key) };
  return { where: 'center_code = $1', value: key.toUpperCase() };
}

/** All centers (active and disabled). */
async function getAllCenters() {
  const { rows } = await pool.query(
    `SELECT ${CENTER_COLUMNS} FROM centers ORDER BY center_name`
  );
  return rows;
}

/** Only active centers. */
async function getActiveCenters() {
  const { rows } = await pool.query(
    `SELECT ${CENTER_COLUMNS} FROM centers WHERE is_active = TRUE ORDER BY center_name`
  );
  return rows;
}

/**
 * One center by id (e.g. 3) or code (e.g. "PUN").
 * @returns {Promise<object>} the center row; throws 404 if not found
 */
async function getCenter(idOrCode) {
  const { where, value } = centerKey(idOrCode);
  const { rows } = await pool.query(
    `SELECT ${CENTER_COLUMNS} FROM centers WHERE ${where}`,
    [value]
  );
  if (!rows.length) throw new CenterError(404, `center '${idOrCode}' not found`);
  return rows[0];
}

/**
 * Disable a center by id or code (sets is_active = FALSE; the row is kept
 * because users reference it).
 * @returns {Promise<object>} the updated center row; throws 404 if not found
 */
async function disableCenter(idOrCode) {
  const { where, value } = centerKey(idOrCode);
  const { rows } = await pool.query(
    `UPDATE centers SET is_active = FALSE WHERE ${where} RETURNING ${CENTER_COLUMNS}`,
    [value]
  );
  if (!rows.length) throw new CenterError(404, `center '${idOrCode}' not found`);
  return rows[0];
}

// Sends CenterError as its status (400/404/409), anything else as 500.
function sendError(res, err, action) {
  if (err instanceof CenterError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`Error ${action}:`, err);
  res.status(500).json({ error: 'Internal Server Error' });
}

// ---------------------------------------------------------------------
// Routes (mounted at /centers in index.js)
// ---------------------------------------------------------------------
const router = express.Router();

// POST /centers   body: { "center_code": "PUN", "center_name": "Pune Center", "city": "Pune" }
router.post('/', async (req, res) => {
  try {
    const center = await addCenter(req.body);
    res.status(201).json(center);
  } catch (err) {
    sendError(res, err, 'adding center');
  }
});

// GET /centers            -> all centers
router.get('/', async (req, res) => {
  try {
    res.json(await getAllCenters());
  } catch (err) {
    sendError(res, err, 'reading centers');
  }
});

// GET /centers/active     -> active centers only
// (must be declared before /:idOrCode, otherwise "active" is treated as a code)
router.get('/active', async (req, res) => {
  try {
    res.json(await getActiveCenters());
  } catch (err) {
    sendError(res, err, 'reading active centers');
  }
});

// GET /centers/3  or  /centers/PUN   -> one center
router.get('/:idOrCode', async (req, res) => {
  try {
    res.json(await getCenter(req.params.idOrCode));
  } catch (err) {
    sendError(res, err, 'reading center');
  }
});

// PATCH /centers/3/disable  or  /centers/PUN/disable
router.patch('/:idOrCode/disable', async (req, res) => {
  try {
    res.json(await disableCenter(req.params.idOrCode));
  } catch (err) {
    sendError(res, err, 'disabling center');
  }
});

module.exports = {
  addCenter,
  getAllCenters,
  getActiveCenters,
  getCenter,
  disableCenter,
  router,
};
