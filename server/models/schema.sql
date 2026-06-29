-- ── Angel Trans HR Portal — Database Schema ─────────────────────────────────

-- Users (employees, hr_admins, owners all in one table — role differentiates)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('employee','hr_admin','owner')),
  status        VARCHAR(30) NOT NULL DEFAULT 'Onboarding'
                CHECK (status IN ('Onboarding','Active','Termination Pending','Terminated')),
  invite_token  VARCHAR(255),
  token_expires TIMESTAMPTZ,
  reset_token   VARCHAR(255),
  reset_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Employee details (HR-entered at onboarding send time)
CREATE TABLE IF NOT EXISTS employee_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  job_title       VARCHAR(255),
  employment_type VARCHAR(20) DEFAULT 'Full-Time',
  start_date      DATE,
  hourly_rate     NUMERIC(10,2),
  overtime_rate   NUMERIC(10,2),
  department      VARCHAR(100),
  manager         VARCHAR(255),
  date_sent       DATE DEFAULT CURRENT_DATE,
  last_activity   TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Orientation sections (28 sections — seeded once)
CREATE TABLE IF NOT EXISTS sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_number INTEGER UNIQUE NOT NULL,
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL,
  has_initials   BOOLEAN DEFAULT FALSE, -- true for S4 (33-item acknowledgement)
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Acknowledgement items for sections that require per-item initials (S4)
CREATE TABLE IF NOT EXISTS section_acknowledgements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  item_text  TEXT NOT NULL
);

-- Per-employee section signing progress
CREATE TABLE IF NOT EXISTS employee_sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  section_id     UUID REFERENCES sections(id) ON DELETE CASCADE,
  status         VARCHAR(20) DEFAULT 'Not Started'
                 CHECK (status IN ('Not Started','In Progress','Completed')),
  signature      VARCHAR(255),
  printed_name   VARCHAR(255),
  date_signed    DATE,
  ip_address     VARCHAR(45),
  signed_at      TIMESTAMPTZ,
  saved_at       TIMESTAMPTZ,
  UNIQUE(user_id, section_id)
);

-- Per-employee per-acknowledgement-item initials (for S4)
CREATE TABLE IF NOT EXISTS employee_initials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  ack_item_id    UUID REFERENCES section_acknowledgements(id) ON DELETE CASCADE,
  initialed      BOOLEAN DEFAULT FALSE,
  initialed_at   TIMESTAMPTZ,
  UNIQUE(user_id, ack_item_id)
);

-- Termination records
CREATE TABLE IF NOT EXISTS terminations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  initiated_by     UUID REFERENCES users(id),
  reason           VARCHAR(100),
  effective_date   DATE,
  final_pay_date   DATE,
  comments         TEXT,
  status           VARCHAR(20) DEFAULT 'Pending'
                   CHECK (status IN ('Pending','Signed','Complete')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Termination packet sections (3 docs)
CREATE TABLE IF NOT EXISTS termination_sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_order  INTEGER NOT NULL,
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL
);

-- Per-employee termination section signing
CREATE TABLE IF NOT EXISTS termination_signing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termination_id  UUID REFERENCES terminations(id) ON DELETE CASCADE,
  section_id      UUID REFERENCES termination_sections(id),
  signature       VARCHAR(255),
  printed_name    VARCHAR(255),
  date_signed     DATE,
  signed_at       TIMESTAMPTZ,
  UNIQUE(termination_id, section_id)
);

-- Signed PDFs storage references
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(30) CHECK (type IN ('Onboarding Packet','Termination Packet')),
  storage_path  VARCHAR(500),
  date_completed DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status       ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_emp_sections_user  ON employee_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user     ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type     ON documents(type);
CREATE INDEX IF NOT EXISTS idx_terminations_user  ON terminations(user_id);
