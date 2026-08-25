-- Patch: rozszerzone motywy kolorystyczne (dla baz, które już mają settings_extras).
-- Bezpieczne do ponownego uruchomienia.

ALTER TABLE wedding_settings DROP CONSTRAINT IF EXISTS wedding_settings_theme_check;

ALTER TABLE wedding_settings
  ADD CONSTRAINT wedding_settings_theme_check
  CHECK (theme IN (
    'classic', 'blush', 'champagne', 'forest',
    'ocean', 'sunset', 'midnight', 'noir'
  ));
