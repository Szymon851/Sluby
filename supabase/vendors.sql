-- 5/9  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel → [demo_seed | empty_client]
-- Dostawcy.

CREATE TABLE vendors (
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

CREATE POLICY "Admin all vendors" ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "No vendors for anon" ON vendors FOR SELECT TO anon USING (false);
