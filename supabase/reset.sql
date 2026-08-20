-- reset → schema → budget → settings_extras → vendors
-- Kasuje dane aplikacji. Auth zostaje.

DROP TABLE IF EXISTS budget_payments CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS faq_items CASCADE;
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS wedding_settings CASCADE;

DROP FUNCTION IF EXISTS get_guest_by_code(TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, INT, TEXT[], TEXT, TEXT, TEXT);
