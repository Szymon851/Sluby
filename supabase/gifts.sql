-- 7/9  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel → [demo_seed | empty_client]
-- Lista prezentów: zajęcie tylko z osobistego kodu zaproszenia.

CREATE TABLE gift_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  claimed_by_guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gift_items_sort ON gift_items (sort_order);

CREATE OR REPLACE FUNCTION get_gifts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', g.id,
      'name', g.name,
      'url', COALESCE(g.url, ''),
      'notes', COALESCE(g.notes, ''),
      'sortOrder', g.sort_order,
      'claimedByGuestId', g.claimed_by_guest_id,
      'claimerName', gu.name,
      'claimedAt', g.claimed_at
    ) ORDER BY g.sort_order, g.name)
    FROM gift_items g
    LEFT JOIN guests gu ON gu.id = g.claimed_by_guest_id
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION claim_gift(p_code TEXT, p_gift_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guest_row guests%ROWTYPE;
  gift_row gift_items%ROWTYPE;
BEGIN
  SELECT * INTO guest_row FROM guests WHERE UPPER(invite_code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nieprawidłowy kod zaproszenia.');
  END IF;

  SELECT * INTO gift_row FROM gift_items WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nie znaleziono prezentu.');
  END IF;

  IF gift_row.claimed_by_guest_id IS NOT NULL THEN
    IF gift_row.claimed_by_guest_id = guest_row.id THEN
      RETURN json_build_object('success', true);
    END IF;
    RETURN json_build_object('success', false, 'error', 'Ten prezent jest już zajęty.');
  END IF;

  UPDATE gift_items SET
    claimed_by_guest_id = guest_row.id,
    claimed_at = NOW()
  WHERE id = p_gift_id;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION release_gift(p_code TEXT, p_gift_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guest_row guests%ROWTYPE;
  gift_row gift_items%ROWTYPE;
BEGIN
  SELECT * INTO guest_row FROM guests WHERE UPPER(invite_code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nieprawidłowy kod zaproszenia.');
  END IF;

  SELECT * INTO gift_row FROM gift_items WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nie znaleziono prezentu.');
  END IF;

  IF gift_row.claimed_by_guest_id IS NULL THEN
    RETURN json_build_object('success', true);
  END IF;

  IF gift_row.claimed_by_guest_id <> guest_row.id THEN
    RETURN json_build_object('success', false, 'error', 'Możesz zwolnić tylko swój prezent.');
  END IF;

  UPDATE gift_items SET
    claimed_by_guest_id = NULL,
    claimed_at = NULL
  WHERE id = p_gift_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION get_gifts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_gift(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION release_gift(TEXT, UUID) TO anon, authenticated;

GRANT ALL ON gift_items TO authenticated;

ALTER TABLE gift_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all gift_items" ON gift_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "No gift_items for anon" ON gift_items FOR SELECT TO anon USING (false);
