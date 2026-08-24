-- 3/8  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → demo_seed
-- Dodatkowe pola strony: prezenty, zdjęcia, motyw, tryb publikacji.

ALTER TABLE wedding_settings ADD COLUMN gifts_bank_account TEXT DEFAULT '';
ALTER TABLE wedding_settings ADD COLUMN gifts_link TEXT DEFAULT '';
ALTER TABLE wedding_settings ADD COLUMN hero_image_url TEXT DEFAULT 'img/hero.jpg';
ALTER TABLE wedding_settings ADD COLUMN gallery_urls TEXT DEFAULT '';
ALTER TABLE wedding_settings ADD COLUMN site_mode TEXT DEFAULT 'preview';
ALTER TABLE wedding_settings ADD COLUMN theme TEXT DEFAULT 'classic';

ALTER TABLE wedding_settings
  ADD CONSTRAINT wedding_settings_site_mode_check
  CHECK (site_mode IN ('preview', 'live', 'locked'));

ALTER TABLE wedding_settings
  ADD CONSTRAINT wedding_settings_theme_check
  CHECK (theme IN ('classic', 'blush'));

CREATE OR REPLACE FUNCTION protect_site_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.site_mode IS DISTINCT FROM OLD.site_mode THEN
    IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION 'site_mode można zmienić tylko w panelu Supabase (agencja).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_site_mode
  BEFORE UPDATE ON wedding_settings
  FOR EACH ROW
  EXECUTE FUNCTION protect_site_mode();
