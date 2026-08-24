-- 2/9  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel → demo_seed
-- Rdzeń: ustawienia, plan dnia, FAQ, checklista, zaproszenia (gość = jeden rekord).

CREATE TABLE wedding_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bride_name TEXT NOT NULL DEFAULT 'Anna',
  groom_name TEXT NOT NULL DEFAULT 'Michał',
  wedding_date TIMESTAMPTZ NOT NULL DEFAULT '2026-09-12T15:00:00+00',
  venue TEXT,
  venue_address TEXT,
  venue_map_url TEXT,
  dress_code TEXT,
  rsvp_deadline DATE,
  contact_email TEXT,
  contact_phone TEXT,
  story TEXT,
  accommodation TEXT,
  gifts TEXT,
  site_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO wedding_settings (id) VALUES (1);

CREATE TABLE schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  link_panel TEXT DEFAULT ''
);

CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  group_name TEXT,
  max_guests INT NOT NULL DEFAULT 1 CHECK (max_guests >= 1 AND max_guests <= 20),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  confirmed_guests INT NOT NULL DEFAULT 0,
  diet TEXT[] DEFAULT '{}',
  allergies TEXT DEFAULT '',
  message TEXT DEFAULT '',
  song_request TEXT DEFAULT '',
  responded_at TIMESTAMPTZ,
  invitation_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guests_invite_code ON guests (UPPER(invite_code));

CREATE OR REPLACE FUNCTION get_guest_by_code(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g guests%ROWTYPE;
BEGIN
  SELECT * INTO g FROM guests WHERE UPPER(invite_code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'id', g.id,
    'name', g.name,
    'code', g.invite_code,
    'maxGuests', g.max_guests,
    'status', g.status,
    'confirmedGuests', g.confirmed_guests,
    'diet', COALESCE(g.diet, '{}'),
    'allergies', COALESCE(g.allergies, ''),
    'message', COALESCE(g.message, ''),
    'songRequest', COALESCE(g.song_request, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION submit_rsvp(
  p_code TEXT,
  p_attending BOOLEAN,
  p_guest_count INT,
  p_diet TEXT[],
  p_allergies TEXT,
  p_message TEXT,
  p_song_request TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g guests%ROWTYPE;
BEGIN
  SELECT * INTO g FROM guests WHERE UPPER(invite_code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nieprawidłowy kod zaproszenia.');
  END IF;

  IF p_attending AND (p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > g.max_guests) THEN
    RETURN json_build_object('success', false, 'error', 'Nieprawidłowa liczba osób.');
  END IF;

  UPDATE guests SET
    status = CASE WHEN p_attending THEN 'confirmed' ELSE 'declined' END,
    confirmed_guests = CASE WHEN p_attending THEN p_guest_count ELSE 0 END,
    diet = COALESCE(p_diet, '{}'),
    allergies = COALESCE(p_allergies, ''),
    message = COALESCE(p_message, ''),
    song_request = COALESCE(p_song_request, ''),
    responded_at = NOW()
  WHERE id = g.id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON wedding_settings TO anon, authenticated;
GRANT SELECT ON schedule_items TO anon, authenticated;
GRANT SELECT ON faq_items TO anon, authenticated;

GRANT ALL ON wedding_settings TO authenticated;
GRANT ALL ON schedule_items TO authenticated;
GRANT ALL ON faq_items TO authenticated;
GRANT ALL ON checklist_items TO authenticated;
GRANT ALL ON guests TO authenticated;

GRANT EXECUTE ON FUNCTION get_guest_by_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_rsvp(TEXT, BOOLEAN, INT, TEXT[], TEXT, TEXT, TEXT) TO anon, authenticated;

ALTER TABLE wedding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings" ON wedding_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read schedule" ON schedule_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read faq" ON faq_items FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "No direct guest read" ON guests FOR SELECT TO anon USING (false);
CREATE POLICY "No direct guest write" ON guests FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "No direct guest update" ON guests FOR UPDATE TO anon USING (false);
CREATE POLICY "No direct guest delete" ON guests FOR DELETE TO anon USING (false);

CREATE POLICY "Admin all settings" ON wedding_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all schedule" ON schedule_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all faq" ON faq_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all checklist" ON checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin all guests" ON guests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "No checklist for anon" ON checklist_items FOR SELECT TO anon USING (false);
