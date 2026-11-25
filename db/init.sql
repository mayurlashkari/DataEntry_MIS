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

CREATE TABLE IF NOT EXISTS genders (
  gender_id   SERIAL PRIMARY KEY,
  gender_code VARCHAR(10)  NOT NULL UNIQUE,
  gender_name VARCHAR(50)  NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,   -- display order in dropdowns
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

-- Employee details.
-- user_name is the primary key; id is an auto-generated unique number.
-- role_code / center_code / gender_code must exist in their master tables.
CREATE TABLE IF NOT EXISTS employee_details (
  id             SERIAL       NOT NULL UNIQUE,
  user_name      VARCHAR(50)  PRIMARY KEY,
  role_code      VARCHAR(30)  NOT NULL REFERENCES roles(role_code),
  center_code    VARCHAR(30)  NOT NULL REFERENCES centers(center_code),
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100),
  mobile_number  VARCHAR(15),
  gender_code    VARCHAR(10)  REFERENCES genders(gender_code),
  date_of_birth  DATE,
  joining_date   DATE,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  enroll_date    DATE         NOT NULL DEFAULT CURRENT_DATE
);

-- Date of birth and joining date are mandatory (SET NOT NULL is safe to re-run).
ALTER TABLE employee_details ALTER COLUMN date_of_birth SET NOT NULL;
ALTER TABLE employee_details ALTER COLUMN joining_date  SET NOT NULL;

-- Employee must be at least 18 years old on the joining date.
-- (Added with a DO block because ADD CONSTRAINT has no IF NOT EXISTS.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'employee_details_min_joining_age') THEN
    ALTER TABLE employee_details
      ADD CONSTRAINT employee_details_min_joining_age
      CHECK (joining_date IS NULL OR date_of_birth IS NULL
             OR joining_date >= date_of_birth + INTERVAL '18 years');
  END IF;
END $$;


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

INSERT INTO genders (gender_code, gender_name, sort_order) VALUES
  ('M', 'Male',   1),
  ('F', 'Female', 2),
  ('O', 'Other',  3)
ON CONFLICT (gender_code) DO NOTHING;

INSERT INTO users (name, email, role_id, center_id)
SELECT 'System Administrator', 'admin@dataentry-mis.local', r.role_id, c.center_id
FROM roles r, centers c
WHERE r.role_code = 'ADMIN' AND c.center_code = 'HO'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@dataentry-mis.local');
