-- Po schema.sql. IF NOT EXISTS / DROP IF EXISTS — można odpalać ponownie.

ALTER TABLE wedding_settings ADD COLUMN IF NOT EXISTS gifts_bank_account TEXT DEFAULT '';
ALTER TABLE wedding_settings ADD COLUMN IF NOT EXISTS gifts_link TEXT DEFAULT '';
ALTER TABLE wedding_settings ADD COLUMN IF NOT EXISTS hero_image_url TEXT DEFAULT 'img/hero.jpg';
ALTER TABLE wedding_settings ADD COLUMN IF NOT EXISTS gallery_urls TEXT DEFAULT '';
ALTER TABLE wedding_settings ADD COLUMN IF NOT EXISTS site_mode TEXT DEFAULT 'preview';
ALTER TABLE wedding_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'classic';

DO $$
BEGIN
  ALTER TABLE wedding_settings
    ADD CONSTRAINT wedding_settings_site_mode_check
    CHECK (site_mode IN ('preview', 'live', 'locked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wedding_settings
    ADD CONSTRAINT wedding_settings_theme_check
    CHECK (theme IN ('classic', 'blush'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Blokada zmiany site_mode z ról anon/authenticated (zmiana tylko w SQL Editor / Table Editor).
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

DROP TRIGGER IF EXISTS trg_protect_site_mode ON wedding_settings;
CREATE TRIGGER trg_protect_site_mode
  BEFORE UPDATE ON wedding_settings
  FOR EACH ROW
  EXECUTE FUNCTION protect_site_mode();
