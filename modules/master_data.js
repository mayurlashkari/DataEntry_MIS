const express = require('express');
const pool = require('../db');

// ---------------------------------------------------------------------
// Master tables that can be fetched.
// To add a new master: create the table + data in db/init.sql, then add
// one entry here. Only names listed here can be queried (the URL value is
// never put into SQL directly).
// ---------------------------------------------------------------------
const MASTERS = {
  roles: {
    table: 'roles',
    columns: 'role_id, role_code, role_name, is_active',
    orderBy: 'role_name',
  },
  centers: {
    table: 'centers',
    columns: 'center_id, center_code, center_name, city, is_active',
    orderBy: 'center_name',
  },
  genders: {
    table: 'genders',
    columns: 'gender_id, gender_code, gender_name, sort_order, is_active',
    orderBy: 'sort_order, gender_name',
  },
};

class MasterError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Names of all available masters, e.g. ['roles', 'centers']. */
function listMasters() {
  return Object.keys(MASTERS);
}

/**
 * Fetch one master table.
 * @param {string} name                    master name, e.g. 'roles'
 * @param {object} [opts]
 * @param {boolean} [opts.includeInactive] true = also return disabled rows
 * @returns {Promise<object[]>}
 */
async function getMaster(name, { includeInactive = false } = {}) {
  const key = String(name || '').trim().toLowerCase();
  const def = Object.prototype.hasOwnProperty.call(MASTERS, key) ? MASTERS[key] : null;
  if (!def) {
    throw new MasterError(404, `unknown master '${name}'. Available: ${listMasters().join(', ')}`);
  }

  const where = includeInactive ? '' : 'WHERE is_active = TRUE';
  const { rows } = await pool.query(
    `SELECT ${def.columns} FROM ${def.table} ${where} ORDER BY ${def.orderBy}`
  );
  return rows;
}

/**
 * Fetch every master in one call, e.g. to fill all dropdowns on app load.
 * @returns {Promise<{roles: object[], centers: object[]}>}
 */
async function getAllMasters(opts = {}) {
  const names = listMasters();
  const results = await Promise.all(names.map((n) => getMaster(n, opts)));
  return Object.fromEntries(names.map((n, i) => [n, results[i]]));
}

// ---------------------------------------------------------------------
// Routes (mounted at /master in index.js)
// Add ?all=true to include inactive rows.
// ---------------------------------------------------------------------
const router = express.Router();

const wantsAll = (req) => String(req.query.all).toLowerCase() === 'true';

function sendError(res, err, action) {
  if (err instanceof MasterError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`Error ${action}:`, err);
  res.status(500).json({ error: 'Internal Server Error' });
}

// GET /master            -> { roles: [...], centers: [...] }
router.get('/', async (req, res) => {
  try {
    res.json(await getAllMasters({ includeInactive: wantsAll(req) }));
  } catch (err) {
    sendError(res, err, 'reading master data');
  }
});

// GET /master/roles  or  /master/centers
router.get('/:name', async (req, res) => {
  try {
    res.json(await getMaster(req.params.name, { includeInactive: wantsAll(req) }));
  } catch (err) {
    sendError(res, err, `reading master '${req.params.name}'`);
  }
});

module.exports = { listMasters, getMaster, getAllMasters, router };
