-- WarehouseOS Unified Schema
-- Single database for ERP + WhatsApp communication layer
-- Replaces: warehouse_users, pending_modifications, bills, product_catalog

-- ─────────────────────────────────────────────────────────────────
-- SHARED TABLES (ERP + WhatsApp)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE,
  wa_number   text UNIQUE,
  name        text NOT NULL,
  role        text NOT NULL
              CHECK (role IN ('admin','accountant','manager','staff','picker')),
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    text NOT NULL DEFAULT 'My Warehouse',
  address         text,
  phone           text,
  email           text,
  gstin           text,
  pan             text,
  trn             text,
  tax_regime      text DEFAULT 'GST'
                  CHECK (tax_regime IN ('GST','VAT','BOTH')),
  state_code      text,
  currency        text DEFAULT 'INR',
  logo_url        text,
  invoice_prefix  text DEFAULT 'INV',
  invoice_seq     integer DEFAULT 1,
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  icon       text DEFAULT 'box',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid REFERENCES product_groups(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  name_alt     text,
  group_id     uuid REFERENCES product_groups(id),
  category_id  uuid REFERENCES product_categories(id),
  unit         text DEFAULT 'pcs',
  hsn_code     text,
  tax_rate     numeric(5,2) DEFAULT 18,
  tax_type     text DEFAULT 'GST' CHECK (tax_type IN ('GST','VAT','EXEMPT')),
  purchase_rate numeric(12,2),
  selling_rate numeric(12,2),
  reorder_qty  integer DEFAULT 0,
  current_stock numeric(12,2) DEFAULT 0,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('customer','supplier','both')),
  name         text NOT NULL,
  phone        text,
  email        text,
  address      text,
  city         text,
  state        text,
  state_code   text,
  country      text DEFAULT 'India',
  gstin        text,
  trn          text,
  credit_days  integer DEFAULT 0,
  credit_limit numeric(12,2) DEFAULT 0,
  balance      numeric(12,2) DEFAULT 0,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- ERP TABLES
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('in','out','adjust')),
  ref_type     text CHECK (ref_type IN ('purchase','sale','adjustment','opening','whatsapp')),
  ref_id       uuid,
  ref_number   text,
  product_id   uuid NOT NULL REFERENCES products(id),
  product_name text,
  product_code text,
  quantity     numeric(12,2) NOT NULL,
  unit         text,
  rate         numeric(12,2),
  party_id     uuid REFERENCES parties(id),
  party_name   text,
  notes        text,
  moved_at     timestamptz DEFAULT now(),
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  type         text NOT NULL CHECK (type IN ('sale','purchase','sale_return','purchase_return')),
  pending_bill_id uuid,
  party_id     uuid NOT NULL REFERENCES parties(id),
  party_name   text,
  party_gstin  text,
  party_address text,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date     date,
  place_of_supply text,
  is_interstate boolean DEFAULT false,
  subtotal     numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  taxable_amount numeric(12,2) DEFAULT 0,
  cgst_amount  numeric(12,2) DEFAULT 0,
  sgst_amount  numeric(12,2) DEFAULT 0,
  igst_amount  numeric(12,2) DEFAULT 0,
  vat_amount   numeric(12,2) DEFAULT 0,
  total_tax    numeric(12,2) DEFAULT 0,
  grand_total  numeric(12,2) DEFAULT 0,
  paid_amount  numeric(12,2) DEFAULT 0,
  balance_due  numeric(12,2) DEFAULT 0,
  status       text DEFAULT 'draft' CHECK (status IN ('draft','confirmed','paid','cancelled')),
  notes        text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES products(id),
  product_name text,
  product_code text,
  hsn_code     text,
  quantity     numeric(12,2) NOT NULL,
  unit         text,
  rate         numeric(12,2) NOT NULL,
  discount_pct numeric(5,2) DEFAULT 0,
  taxable_amount numeric(12,2),
  tax_rate     numeric(5,2),
  cgst_rate    numeric(5,2) DEFAULT 0,
  cgst_amount  numeric(12,2) DEFAULT 0,
  sgst_rate    numeric(5,2) DEFAULT 0,
  sgst_amount  numeric(12,2) DEFAULT 0,
  igst_rate    numeric(5,2) DEFAULT 0,
  igst_amount  numeric(12,2) DEFAULT 0,
  vat_rate     numeric(5,2) DEFAULT 0,
  vat_amount   numeric(12,2) DEFAULT 0,
  line_total   numeric(12,2)
);

CREATE TABLE IF NOT EXISTS payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid REFERENCES invoices(id),
  party_id     uuid REFERENCES parties(id),
  amount       numeric(12,2) NOT NULL,
  method       text CHECK (method IN ('cash','bank','upi','cheque','card')),
  reference    text,
  paid_at      timestamptz DEFAULT now(),
  notes        text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- WHATSAPP TABLES
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_bills (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number        text NOT NULL UNIQUE,
  picker_wa         text NOT NULL,
  picker_name       text NOT NULL,
  picker_id         uuid REFERENCES users(id),
  photo_url         text NOT NULL,
  photo_storage_path text NOT NULL,
  state             text DEFAULT 'pending'
                    CHECK (state IN ('pending','claimed','stock_recorded','invoiced','done','skipped')),
  claimed_by_wa     text,
  claimed_by_name   text,
  claimed_at        timestamptz,
  stock_recorded_at timestamptz,
  invoice_id        uuid REFERENCES invoices(id),
  resolved_by_wa    text,
  resolved_by_name  text,
  resolved_at       timestamptz,
  stale_alerted_at  timestamptz,
  submitted_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wa_stock_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_bill_id uuid NOT NULL REFERENCES pending_bills(id),
  movement_id     uuid REFERENCES stock_movements(id),
  raw_command     text,
  product_code    text,
  product_name    text,
  movement_type   text CHECK (movement_type IN ('in','out')),
  quantity        numeric(12,2),
  unit            text,
  created_by_wa   text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_state (
  wa_number       text PRIMARY KEY,
  state           text DEFAULT 'IDLE',
  current_ref     text,
  last_activity   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction    text CHECK (direction IN ('in','out')),
  wa_number    text NOT NULL,
  message_type text,
  content      text,
  ref_number   text,
  ts           timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_group_id ON products(group_id);
CREATE INDEX IF NOT EXISTS idx_products_current_stock ON products(current_stock);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_moved_at ON stock_movements(moved_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_party_id ON invoices(party_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_pending_bills_state ON pending_bills(state);
CREATE INDEX IF NOT EXISTS idx_pending_bills_submitted_at ON pending_bills(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(type);

-- ─────────────────────────────────────────────────────────────────
-- RLS POLICIES (MVP: permissive for all operations)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_all_public ON users FOR ALL USING (true);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_all_public ON company_settings FOR ALL USING (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_all_public ON products FOR ALL USING (true);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY parties_all_public ON parties FOR ALL USING (true);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_all_public ON stock_movements FOR ALL USING (true);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_all_public ON invoices FOR ALL USING (true);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_items_all_public ON invoice_items FOR ALL USING (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_all_public ON payments FOR ALL USING (true);

ALTER TABLE pending_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_bills_all_public ON pending_bills FOR ALL USING (true);

ALTER TABLE wa_stock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_stock_all_public ON wa_stock_entries FOR ALL USING (true);

ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_all_public ON conversation_state FOR ALL USING (true);

ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_log_all_public ON message_log FOR ALL USING (true);

ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_groups_all_public ON product_groups FOR ALL USING (true);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_categories_all_public ON product_categories FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────────

INSERT INTO company_settings (company_name, address, phone, gstin, state_code, tax_regime, currency)
VALUES ('My Warehouse', '123 Main St', '+91-9876543210', '', '', 'GST', 'INR')
ON CONFLICT DO NOTHING;

INSERT INTO product_groups (name, icon, sort_order) VALUES
  ('Building Materials', 'package', 1),
  ('Paints & Finishing', 'palette', 2),
  ('Plumbing', 'droplet', 3),
  ('Steel & Metal', 'hammer', 4),
  ('Tiles & Flooring', 'square', 5),
  ('Electrical', 'zap', 6),
  ('Hardware', 'tool', 7),
  ('Other', 'box', 8)
ON CONFLICT DO NOTHING;
