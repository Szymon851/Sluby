-- 6/9  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel → [demo_seed | empty_client]
-- Osoby na zaproszeniu, piosenka per osoba, nowe RPC.

CREATE TABLE guest_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  attending BOOLEAN NOT NULL DEFAULT TRUE,
  diet TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  song_artist TEXT DEFAULT '',
  song_title TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_guest_people_guest ON guest_people (guest_id);

INSERT INTO guest_people (guest_id, display_name, attending, diet, allergies, song_artist, song_title, sort_order)
SELECT g.id, g.name, TRUE,
  COALESCE(g.diet[1], ''),
  COALESCE(g.allergies, ''),
  '',
  COALESCE(g.song_request, ''),
  1
FROM guests g
WHERE g.status = 'confirmed';

CREATE OR REPLACE FUNCTION get_guest_by_code(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g guests%ROWTYPE;
  people JSON;
BEGIN
  SELECT * INTO g FROM guests WHERE UPPER(invite_code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id,
    'name', p.display_name,
    'attending', p.attending,
    'diet', COALESCE(p.diet, ''),
    'allergies', COALESCE(p.allergies, ''),
    'songArtist', COALESCE(p.song_artist, ''),
    'songTitle', COALESCE(p.song_title, ''),
    'sortOrder', p.sort_order
  ) ORDER BY p.sort_order), '[]'::json)
  INTO people
  FROM guest_people p WHERE p.guest_id = g.id;

  RETURN json_build_object(
    'id', g.id,
    'name', g.name,
    'code', g.invite_code,
    'maxGuests', g.max_guests,
    'status', g.status,
    'confirmedGuests', g.confirmed_guests,
    'message', COALESCE(g.message, ''),
    'people', people
  );
END;
$$;

DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, INT, TEXT[], TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, JSON, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION submit_rsvp(
  p_code TEXT,
  p_attending BOOLEAN,
  p_people JSON,
  p_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g guests%ROWTYPE;
  n INT;
BEGIN
  SELECT * INTO g FROM guests WHERE UPPER(invite_code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nieprawidłowy kod zaproszenia.');
  END IF;

  n := COALESCE(json_array_length(COALESCE(p_people::json, '[]'::json)), 0);
  IF p_attending AND (n < 1 OR n > g.max_guests) THEN
    RETURN json_build_object('success', false, 'error', 'Nieprawidłowa liczba osób.');
  END IF;

  UPDATE guests SET
    status = CASE WHEN p_attending THEN 'confirmed' ELSE 'declined' END,
    confirmed_guests = CASE WHEN p_attending THEN n ELSE 0 END,
    message = COALESCE(p_message, ''),
    responded_at = NOW()
  WHERE id = g.id;

  DELETE FROM guest_people WHERE guest_id = g.id;

  IF p_attending THEN
    INSERT INTO guest_people (guest_id, display_name, attending, diet, allergies, song_artist, song_title, sort_order)
    SELECT g.id,
      COALESCE(elem->>'name', ''),
      TRUE,
      COALESCE(elem->>'diet', ''),
      COALESCE(elem->>'allergies', ''),
      COALESCE(elem->>'songArtist', ''),
      COALESCE(elem->>'songTitle', ''),
      (ord::INT)
    FROM json_array_elements(COALESCE(p_people::json, '[]'::json)) WITH ORDINALITY AS t(elem, ord);
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT ALL ON guest_people TO authenticated;
GRANT EXECUTE ON FUNCTION get_guest_by_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_rsvp(TEXT, BOOLEAN, JSON, TEXT) TO anon, authenticated;

ALTER TABLE guest_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all guest_people" ON guest_people FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "No guest_people for anon" ON guest_people FOR SELECT TO anon USING (false);
