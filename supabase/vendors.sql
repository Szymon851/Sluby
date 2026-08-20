-- Dostawcy. Wymaga schema.sql.

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  phone TEXT,
  email TEXT,
  notes TEXT DEFAULT '',
  contract_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON vendors TO authenticated;

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin all vendors" ON vendors;
DROP POLICY IF EXISTS "No vendors for anon" ON vendors;

CREATE POLICY "Admin all vendors" ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "No vendors for anon" ON vendors FOR SELECT TO anon USING (false);
