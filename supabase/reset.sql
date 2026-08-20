-- Czyści tabele/funkcje aplikacji — potem: schema.sql → budget.sql
-- UWAGA: kasuje WSZYSTKIE dane (goście, RSVP, budżet, checklist…). Konta Auth zostają.

DROP TABLE IF EXISTS budget_payments CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS faq_items CASCADE;
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS wedding_settings CASCADE;

DROP FUNCTION IF EXISTS get_guest_by_code(TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, INT, TEXT[], TEXT, TEXT, TEXT);
