-- =====================================================================
-- DataEntry_MIS - database schema and master data
-- Runs automatically every time the service starts (see db/initDb.js).
-- Every statement MUST be safe to re-run:
--   * tables:      CREATE TABLE IF NOT EXISTS
--   * columns:     ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   * master data: INSERT ... ON CONFLICT DO NOTHING
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  role_id     SERIAL PRIMARY KEY,
  role_code   VARCHAR(30)  NOT NULL UNIQUE,
  role_name   VARCHAR(100) NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS centers (
  center_id   SERIAL PRIMARY KEY,
  center_code VARCHAR(30)  NOT NULL UNIQUE,
  center_name VARCHAR(150) NOT NULL,
  city        VARCHAR(100),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Columns added after the table was first created.
-- Add new columns here (never edit the CREATE above for an existing table).
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id   INT REFERENCES roles(role_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS center_id INT REFERENCES centers(center_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;


-- ---------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------

INSERT INTO roles (role_code, role_name) VALUES
  ('ADMIN',    'Administrator'),
  ('OPERATOR', 'Data Entry Operator'),
  ('VIEWER',   'Report Viewer')
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO centers (center_code, center_name, city) VALUES
  ('HO', 'Head Office', NULL)
ON CONFLICT (center_code) DO NOTHING;

INSERT INTO users (name, email, role_id, center_id)
SELECT 'System Administrator', 'admin@dataentry-mis.local', r.role_id, c.center_id
FROM roles r, centers c
WHERE r.role_code = 'ADMIN' AND c.center_code = 'HO'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@dataentry-mis.local');
