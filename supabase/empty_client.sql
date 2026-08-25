-- 9b/9  Po checklist_panel — zamiast demo_seed przy nowym kliencie.
-- Kolejność instalacji:
--   reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel
--   potem: demo_seed (strona demo)  ALBO  empty_client (żywy klient)
--
-- Czyści dane aplikacji, zostawia tabele, RLS i Auth.
-- Nie zmienia site_mode — ustaw preview / live / locked w Table Editorze (Supabase).

DELETE FROM budget_payments;
DELETE FROM budget_items;
DELETE FROM vendors;
DELETE FROM gift_items;
DELETE FROM guest_people;
DELETE FROM guests;
DELETE FROM checklist_items;
DELETE FROM faq_items;
DELETE FROM schedule_items;

UPDATE wedding_settings SET
  bride_name = 'Pani Młoda',
  groom_name = 'Pan Młody',
  wedding_date = '2027-06-15T15:00:00+00',
  venue = '',
  venue_address = '',
  venue_map_url = '',
  dress_code = '',
  rsvp_deadline = NULL,
  contact_email = '',
  contact_phone = '',
  story = '',
  accommodation = '',
  gifts = 'Wasza obecność to dla nas największy prezent. Jeśli chcecie coś nam sprawić — poniżej jest luźna lista inspiracji. Nic nie musicie zajmować.',
  gifts_bank_account = '',
  gifts_link = '',
  hero_image_url = 'img/hero.jpg',
  gallery_urls = '',
  site_url = '',
  theme = 'classic',
  updated_at = NOW()
WHERE id = 1;

-- site_mode bez zmian (nie nadpisujemy)

INSERT INTO checklist_items (text, done, sort_order, link_panel) VALUES
  ('Uzupełnić imiona, datę i miejsce w Ustawieniach', false, 1, 'settings'),
  ('Dodać gości i wysłać zaproszenia', false, 2, 'guests'),
  ('Uzupełnić harmonogram dnia', false, 3, 'schedule'),
  ('Dodać pytania FAQ', false, 4, 'faq'),
  ('Uzupełnić listę prezentów', false, 5, 'gifts'),
  ('Dodać dostawców i budżet', false, 6, 'budget');
