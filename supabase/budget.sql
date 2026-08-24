-- 4/7  reset → schema → settings_extras → budget → vendors → rsvp_people → demo_seed
-- Budżet: pozycje i raty.

CREATE TABLE budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'Inne',
  name TEXT NOT NULL,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  contracted_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budget_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Rata',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_payments_item ON budget_payments (budget_item_id);

GRANT ALL ON budget_items TO authenticated;
GRANT ALL ON budget_payments TO authenticated;

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all budget_items" ON budget_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all budget_payments" ON budget_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "No budget_items for anon" ON budget_items FOR SELECT TO anon USING (false);
CREATE POLICY "No budget_payments for anon" ON budget_payments FOR SELECT TO anon USING (false);
