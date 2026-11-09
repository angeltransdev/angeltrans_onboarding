CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('Vehicle', 'Mobile Device', 'Ambulance Equipment', 'Other')),
  identifier VARCHAR(255),
  location VARCHAR(255),
  status VARCHAR(30) NOT NULL CHECK (status IN ('Available', 'In Use', 'Maintenance', 'Retired')),
  vin VARCHAR(100),
  license_plate VARCHAR(100),
  serial_number VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('Registration', 'Insurance', 'Permit', 'Inspection', 'Certification', 'Maintenance', 'Other')),
  due_date DATE NOT NULL,
  document_url TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_records_due ON asset_records (due_date) WHERE status = 'Open';
CREATE INDEX IF NOT EXISTS idx_asset_records_asset ON asset_records (asset_id);

CREATE TABLE IF NOT EXISTS asset_reminder_deliveries (
  record_id UUID NOT NULL REFERENCES asset_records(id),
  due_date DATE NOT NULL,
  reminder_days INTEGER NOT NULL CHECK (reminder_days IN (30, 14, 7, 0)),
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (record_id, due_date, reminder_days, recipient)
);