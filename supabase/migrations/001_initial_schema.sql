-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number   text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_sub  text,
  photo_url     text,
  picker_name   text,
  created_at    timestamptz DEFAULT now()
);

-- Pending modifications table
CREATE TABLE IF NOT EXISTS pending_modifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number          text NOT NULL,
  customer_name        text NOT NULL,
  customer_sub         text,
  raw_statement        text NOT NULL,
  action_type          text CHECK (action_type IN ('ADD','REMOVE','REPLACE')),
  product_hint         text,
  quantity             numeric,
  picker_name          text,
  photo_url            text,
  photo_storage_path   text,
  resolved             boolean DEFAULT false,
  matched_product_id   text,
  matched_product_name text,
  matched_product_code text,
  matched_product_unit text,
  resolved_by          text,
  resolved_at          timestamptz,
  created_at           timestamptz DEFAULT now()
);

-- Product catalog table
CREATE TABLE IF NOT EXISTS product_catalog (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en   text NOT NULL,
  name_ml   text,
  code      text NOT NULL UNIQUE,
  unit      text NOT NULL,
  category  text,
  alt_names text
);

-- RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_bills" ON bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_mods" ON pending_modifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_read_catalog" ON product_catalog FOR SELECT USING (true);

-- Seed product catalog
INSERT INTO product_catalog (name_en, name_ml, code, unit, category) VALUES
  ('OPC Cement 50kg',   'സിമന്റ്',        'CEM-001', 'bag',  'Building'),
  ('Wall Tile 30x60cm', 'ടൈൽ',            'TIL-023', 'box',  'Tiles'),
  ('PVC Pipe 4"',       'PVC പൈപ്പ്',     'PVC-104', 'pcs',  'Plumbing'),
  ('Steel Rod 12mm',    'ഇരുമ്പ് ദണ്ഡ്',  'STL-012', 'kg',   'Steel'),
  ('River Sand',        'മണൽ',            'SND-001', 'load', 'Aggregate'),
  ('Wire Mesh 6x2m',    'വൈർ മെഷ്',      'MSH-002', 'roll', 'Steel'),
  ('Wall Putty 20kg',   'പ്ലാസ്റ്റർ',     'PTY-020', 'bag',  'Finishing'),
  ('Paint Primer 4L',   'പ്രൈമർ',         'PNT-P04', 'tin',  'Paints'),
  ('Hollow Block 8"',   'ഹോളോ ബ്ലോക്ക്',  'BLK-008', 'pcs',  'Building'),
  ('MS Angle 50x50',    'ആംഗിൾ',          'ANG-050', 'kg',   'Steel')
ON CONFLICT (code) DO NOTHING;
