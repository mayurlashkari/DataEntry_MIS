const express = require('express');
const pool = require('../db');

// Error with an HTTP status, so routes can return 400/404/409 instead of 500.
class EmployeeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Employee columns plus the readable names from the master tables.
const SELECT_EMPLOYEE = `
  SELECT e.id, e.user_name,
         e.role_code,   r.role_name,
         e.center_code, c.center_name,
         e.first_name, e.last_name, e.mobile_number,
         e.gender_code, g.gender_name,
         e.date_of_birth, e.joining_date, e.is_active, e.enroll_date
  FROM employee_details e
  LEFT JOIN roles   r ON r.role_code   = e.role_code
  LEFT JOIN centers c ON c.center_code = e.center_code
  LEFT JOIN genders g ON g.gender_code = e.gender_code`;

// ---------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function required(value, field, max) {
  const v = text(value);
  if (!v) throw new EmployeeError(400, `${field} is required`);
  return optional(v, field, max);
}

function optional(value, field, max) {
  const v = text(value);
  if (v && v.length > max) throw new EmployeeError(400, `${field} must be at most ${max} characters`);
  return v;
}

// Required date. Accepts 'YYYY-MM-DD' only, and rejects impossible dates like 2025-02-30.
function requiredDate(value, field) {
  const v = text(value);
  if (!v) throw new EmployeeError(400, `${field} is required`);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new EmployeeError(400, `${field} must be a valid date in YYYY-MM-DD format`);
  }
  return v;
}

const MIN_JOINING_AGE = 18;

// Date the person turns `years` old, as 'YYYY-MM-DD'. A 29 Feb birthday falls
// on 28 Feb in non-leap years (same as PostgreSQL's date + INTERVAL 'n years').
function dateAtAge(dob, years) {
  const [y, m, d] = dob.split('-').map(Number);
  const year = y + years;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === 2 && d === 29 && !isLeap ? 28 : d;
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// user_name is stored lower-case so 'Ravi' and 'ravi' are the same user.
function userNameKey(value) {
  return required(value, 'user_name', 50).toLowerCase();
}

// ---------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------

/**
 * Insert a new employee. id, is_active (true) and enroll_date (today) are set
 * automatically.
 * @param {object} data  required: user_name, role_code, center_code, first_name,
 *                       date_of_birth, joining_date (dates as 'YYYY-MM-DD');
 *                       optional: last_name, mobile_number, gender_code.
 *                       The employee must be at least 18 on joining_date.
 * @returns {Promise<object>} the new employee (with role/center/gender names)
 */
async function addEmployee(data = {}) {
  const userName = userNameKey(data.user_name);
  if (!/^[a-z0-9._-]+$/.test(userName)) {
    throw new EmployeeError(400, 'user_name may only contain letters, numbers, dot, underscore and hyphen');
  }

  const mobile = optional(data.mobile_number, 'mobile_number', 15);
  if (mobile && !/^\+?\d{10,14}$/.test(mobile)) {
    throw new EmployeeError(400, 'mobile_number must be 10-14 digits, optionally starting with +');
  }

  const dob = requiredDate(data.date_of_birth, 'date_of_birth');
  const joining = requiredDate(data.joining_date, 'joining_date');

  // Employee must be at least 18 on the joining date.
  const eligibleFrom = dateAtAge(dob, MIN_JOINING_AGE);
  if (joining < eligibleFrom) {
    throw new EmployeeError(
      400,
      `employee must be at least ${MIN_JOINING_AGE} years old on the joining date ` +
        `(born ${dob}, so earliest joining date is ${eligibleFrom})`
    );
  }

  const values = [
    userName,
    required(data.role_code, 'role_code', 30).toUpperCase(),
    required(data.center_code, 'center_code', 30).toUpperCase(),
    required(data.first_name, 'first_name', 100),
    optional(data.last_name, 'last_name', 100),
    mobile,
    (optional(data.gender_code, 'gender_code', 10) || '').toUpperCase() || null,
    dob,
    joining,
  ];

  try {
    await pool.query(
      `INSERT INTO employee_details
         (user_name, role_code, center_code, first_name, last_name,
          mobile_number, gender_code, date_of_birth, joining_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      values
    );
  } catch (err) {
    if (err.code === '23505') {
      throw new EmployeeError(409, `user_name '${userName}' already exists`);
    }
    if (err.code === '23503') {
      // Foreign key: which master code was wrong?
      const col = (/\((\w+)\)/.exec(err.detail || '') || [])[1] || 'code';
      throw new EmployeeError(400, `${col} does not exist in the master table`);
    }
    throw err;
  }
  return getEmployee(userName);
}

/**
 * All employees.
 * @param {object}  [opts]
 * @param {boolean} [opts.activeOnly] true = only active employees
 * @param {string}  [opts.search]     partial match on user_name, first or last name
 */
async function getAllEmployees({ activeOnly = false, search } = {}) {
  const where = [];
  const params = [];
  if (activeOnly) where.push('e.is_active = TRUE');
  const s = text(search);
  if (s) {
    params.push(`%${s}%`);
    where.push(`(e.user_name ILIKE $1 OR e.first_name ILIKE $1 OR e.last_name ILIKE $1)`);
  }
  const { rows } = await pool.query(
    `${SELECT_EMPLOYEE}
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY e.first_name, e.last_name`,
    params
  );
  return rows;
}

/** One employee by user_name (case-insensitive); throws 404 if not found. */
async function getEmployee(userName) {
  const key = userNameKey(userName);
  const { rows } = await pool.query(`${SELECT_EMPLOYEE} WHERE e.user_name = $1`, [key]);
  if (!rows.length) throw new EmployeeError(404, `employee '${key}' not found`);
  return rows[0];
}

/** Disable an employee (is_active = FALSE; the row is kept). Throws 404 if not found. */
async function disableEmployee(userName) {
  const key = userNameKey(userName);
  const { rowCount } = await pool.query(
    'UPDATE employee_details SET is_active = FALSE WHERE user_name = $1',
    [key]
  );
  if (!rowCount) throw new EmployeeError(404, `employee '${key}' not found`);
  return getEmployee(key);
}

// ---------------------------------------------------------------------
// Routes (mounted at /employees in index.js)
// ---------------------------------------------------------------------
const router = express.Router();

function sendError(res, err, action) {
  if (err instanceof EmployeeError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`Error ${action}:`, err);
  res.status(500).json({ error: 'Internal Server Error' });
}

// POST /employees   body: { user_name, role_code, center_code, first_name, ... }
router.post('/', async (req, res) => {
  try {
    res.status(201).json(await addEmployee(req.body));
  } catch (err) {
    sendError(res, err, 'adding employee');
  }
});

// GET /employees                 -> all employees
// GET /employees?active=true     -> active only
// GET /employees?search=ravi     -> partial match on user_name / first / last name
router.get('/', async (req, res) => {
  try {
    res.json(await getAllEmployees({
      activeOnly: String(req.query.active).toLowerCase() === 'true',
      search: req.query.search,
    }));
  } catch (err) {
    sendError(res, err, 'reading employees');
  }
});

// GET /employees/ravi.k   -> one employee by user_name
router.get('/:userName', async (req, res) => {
  try {
    res.json(await getEmployee(req.params.userName));
  } catch (err) {
    sendError(res, err, 'reading employee');
  }
});

// PATCH /employees/ravi.k/disable
router.patch('/:userName/disable', async (req, res) => {
  try {
    res.json(await disableEmployee(req.params.userName));
  } catch (err) {
    sendError(res, err, 'disabling employee');
  }
});

module.exports = {
  addEmployee,
  getAllEmployees,
  getEmployee,
  disableEmployee,
  router,
};
