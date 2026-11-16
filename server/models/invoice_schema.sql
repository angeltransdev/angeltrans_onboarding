CREATE TABLE IF NOT EXISTS invoice_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone VARCHAR(100) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number BIGSERIAL UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES invoice_customers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  items JSONB NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  payment_instructions TEXT NOT NULL DEFAULT '',
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  status VARCHAR(10) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid')),
  customer_snapshot JSONB,
  company_snapshot JSONB,
  view_token_hash TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_date >= invoice_date)
);

CREATE TABLE IF NOT EXISTS invoice_activity (
  id BIGSERIAL PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  event VARCHAR(20) NOT NULL CHECK (event IN ('Sent', 'Viewed', 'Paid')),
  actor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice ON invoice_activity (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices (customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_token ON invoices (view_token_hash) WHERE view_token_hash IS NOT NULL;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_number VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subject VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_conditions TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS adjustment_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('Draft', 'Approved', 'Sent', 'Paid'));
ALTER TABLE invoice_activity DROP CONSTRAINT IF EXISTS invoice_activity_event_check;
ALTER TABLE invoice_activity ADD CONSTRAINT invoice_activity_event_check CHECK (event IN ('Approved', 'Returned to draft', 'Sent', 'Viewed', 'Paid'));
