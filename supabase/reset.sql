-- 1/9  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel → [demo_seed | empty_client]
-- Kasuje obiekty aplikacji. Auth (auth.users) zostaje.

DROP TRIGGER IF EXISTS trg_protect_site_mode ON wedding_settings;
DROP FUNCTION IF EXISTS protect_site_mode();
DROP FUNCTION IF EXISTS get_guest_by_code(TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, INT, TEXT[], TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, JSON, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, BOOLEAN, JSON, TEXT);
DROP FUNCTION IF EXISTS get_gifts();
DROP FUNCTION IF EXISTS claim_gift(TEXT, UUID);
DROP FUNCTION IF EXISTS release_gift(TEXT, UUID);

DROP TABLE IF EXISTS budget_payments CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS gift_items CASCADE;
DROP TABLE IF EXISTS guest_people CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS faq_items CASCADE;
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS wedding_settings CASCADE;
