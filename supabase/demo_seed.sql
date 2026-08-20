-- Dane demonstracyjne. Wymaga: schema + budget + settings_extras + vendors.
-- Nadpisuje ustawienia (id=1) i czyści gości / budżet / dostawców / checklist /
-- harmonogram / FAQ, potem wstawia przykłady.
-- Stałe kody gości do testów: DEMO-AAAA, DEMO-PARA, DEMO-BABCIA, DEMO-KUBA, DEMO-OLA

UPDATE wedding_settings SET
  bride_name = 'Anna',
  groom_name = 'Michał',
  wedding_date = '2026-09-12T15:00:00+00',
  venue = 'Pałac w Wilanowie',
  venue_address = 'ul. Stanisława Kostki Potockiego 10/16, 02-958 Warszawa',
  venue_map_url = 'https://maps.google.com/?q=Pałac+w+Wilanowie',
  dress_code = 'Elegancki strój wieczorowy. Panowie — garnitur, panie — suknia koktajlowa. Prosimy unikać bieli.',
  rsvp_deadline = '2026-08-15',
  contact_email = 'anna.imichal@example.com',
  contact_phone = '+48 600 123 456',
  story = 'Poznaliśmy się w 2019 roku na koncercie jazzowym. Od pierwszej rozmowy wiedzieliśmy, że to coś wyjątkowego. Po sześciu wspaniałych latach razem Michał poprosił Annę o rękę w Bieszczadach. Nie możemy się doczekać, by świętować ten dzień z Wami!',
  accommodation = 'Dla gości z daleka: Hotel Bellotto (5 min spacerem) oraz Apartamenty Królewskie. Zniżkę kodem SLUB2026.',
  gifts = 'Wasza obecność to największy prezent. Jeśli chcecie nas obdarować — datek na podróż poślubną.',
  gifts_bank_account = 'PL61 1090 1014 0000 0712 1981 2874',
  gifts_link = 'https://example.com/lista-prezentow',
  hero_image_url = 'img/hero.jpg',
  gallery_urls = E'https://images.unsplash.com/photo-1519741497674-611481863552?w=800\nhttps://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800\nhttps://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800\nhttps://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800',
  site_url = '',
  site_mode = 'preview',
  theme = 'classic',
  updated_at = NOW()
WHERE id = 1;

DELETE FROM budget_payments;
DELETE FROM budget_items;
DELETE FROM vendors;
DELETE FROM guests;
DELETE FROM checklist_items;
DELETE FROM faq_items;
DELETE FROM schedule_items;

INSERT INTO schedule_items (time, title, description, sort_order) VALUES
  ('14:30', 'Przyjazd gości', 'Powitanie przy bramie pałacu', 1),
  ('15:00', 'Ceremonia', 'Ślub kościelny w kaplicy pałacowej', 2),
  ('16:30', 'Sesja zdjęciowa', 'Ogród i taras — goście mile widziani', 3),
  ('17:30', 'Koktajl', 'Napoje i przekąski w ogrodzie zimowym', 4),
  ('19:00', 'Obiad', 'Uroczysta kolacja w sali balowej', 5),
  ('21:00', 'Pierwszy taniec', 'Otwarcie parkietu', 6),
  ('22:00', 'Tort', 'Krojenie tortu weselnego', 7),
  ('22:30', 'Zabawa', 'Do białego rana!', 8);

INSERT INTO faq_items (question, answer, sort_order) VALUES
  ('Czy mogę przyjść z dzieckiem?', 'Tak — zaznacz to w RSVP, przygotujemy menu dla dzieci.', 1),
  ('Gdzie mogę zaparkować?', 'Bezpłatny parking na terenie pałacu, wejście od ul. Potockiego.', 2),
  ('Do kiedy muszę potwierdzić obecność?', 'Prosimy o RSVP do terminu podanego na stronie.', 3),
  ('Czy będzie opcja wegetariańska / wegańska?', 'Tak — zaznacz preferencje w formularzu RSVP.', 4),
  ('Jaki jest dress code?', 'Elegancki strój wieczorowy. Unikaj bieli i bardzo intensywnej czerwieni.', 5),
  ('Czy mogę wziąć plus one?', 'Liczba miejsc wynika z zaproszenia — sprawdź w RSVP po wpisaniu kodu.', 6);

INSERT INTO checklist_items (text, done, sort_order) VALUES
  ('Zarezerwować salę weselną', true, 1),
  ('Wybrać fotografa i kamerzystę', true, 2),
  ('Zamówić suknię i garnitur', true, 3),
  ('Wysłać zaproszenia', false, 4),
  ('Ustalić menu z cateringiem', false, 5),
  ('Zamówić tort', false, 6),
  ('Zarezerwować zespół / DJ', false, 7),
  ('Przygotować plan stołów', false, 8);

INSERT INTO guests (
  name, email, phone, invite_code, group_name, max_guests,
  status, confirmed_guests, diet, allergies, message, song_request,
  responded_at, invitation_sent_at
) VALUES
  (
    'Kasia Nowak', 'kasia.nowak@example.com', '+48 501 111 222', 'DEMO-AAAA', 'Przyjaciele',
    1, 'confirmed', 1, ARRAY['vegetarian']::TEXT[], '', 'Nie możemy się doczekać!', 'Dancing Queen',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '10 days'
  ),
  (
    'Piotr i Magda Kowalscy', 'kowalscy@example.com', '+48 502 333 444', 'DEMO-PARA', 'Rodzina',
    2, 'confirmed', 2, ARRAY['glutenFree']::TEXT[], 'Magda — orzechy', 'Będziemy we dwoje.', 'Thinking Out Loud',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days'
  ),
  (
    'Babcia Halina', 'halina@example.com', NULL, 'DEMO-BABCIA', 'Rodzina',
    1, 'confirmed', 1, '{}'::TEXT[], '', 'Całuję mocno', NULL,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '12 days'
  ),
  (
    'Kuba Wiśniewski', 'kuba.w@example.com', '+48 503 555 666', 'DEMO-KUBA', 'Przyjaciele',
    1, 'declined', 0, '{}'::TEXT[], '', 'Niestety jestem za granicą — trzymajcie się!', NULL,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '9 days'
  ),
  (
    'Ola Zielińska', 'ola.z@example.com', '+48 504 777 888', 'DEMO-OLA', 'Praca',
    2, 'pending', 0, '{}'::TEXT[], '', '', NULL,
    NULL, NOW() - INTERVAL '4 days'
  ),
  (
    'Tomek i Asia', NULL, '+48 505 999 000', 'DEMO-TOME', 'Studia',
    2, 'pending', 0, '{}'::TEXT[], '', '', NULL,
    NULL, NULL
  ),
  (
    'Wujek Marek', 'marek@example.com', '+48 506 121 212', 'DEMO-MARE', 'Rodzina',
    1, 'confirmed', 1, ARRAY['kids']::TEXT[], '', '', 'September',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '11 days'
  ),
  (
    'Natalia B.', 'natalia@example.com', NULL, 'DEMO-NATA', 'Przyjaciele',
    1, 'pending', 0, '{}'::TEXT[], '', '', NULL,
    NULL, NOW() - INTERVAL '3 days'
  );

INSERT INTO vendors (name, role, phone, email, notes, contract_date) VALUES
  ('Studio Frame', 'Fotograf', '+48 600 100 200', 'hello@studioframe.example', 'Pakiet foto + 2 albumy', '2025-11-02'),
  ('Lens & Light', 'Video', '+48 600 100 201', 'video@lens.example', 'Teaser + film pełny', '2025-11-15'),
  ('DJ Sunset', 'DJ / Muzyka', '+48 600 100 202', 'dj@sunset.example', 'Do 2:00, własny sprzęt', '2026-01-10'),
  ('Smaki Wesela', 'Catering', '+48 600 100 203', 'biuro@smaki.example', 'Menu degustacja w kwietniu', '2025-12-01'),
  ('Pałac Wilanów Events', 'Sala', '+48 600 100 204', 'events@wilanow.example', 'Zaliczka wpłacona', '2025-09-20'),
  ('Kwiatowa Manufaktura', 'Kwiaty', '+48 600 100 205', 'kontakt@kwiatowa.example', 'Bukiet + dekoracje stołów', '2026-02-14'),
  ('Słodki Kąt', 'Tort', '+48 600 100 206', 'torty@slodki.example', '3-piętrowy, degustacja VII', NULL);

WITH items AS (
  INSERT INTO budget_items (category, name, estimated_cost, contracted_cost, notes, sort_order)
  VALUES
    ('Sala', 'Wynajem pałacu + serwis', 18000, 17500, 'Umowa podpisana', 1),
    ('Catering', 'Menu weselne (80 os.)', 28000, 26500, 'W tym wege / kids', 2),
    ('Fotograf', 'Pakiet foto Studio Frame', 8000, 7500, '', 3),
    ('Video', 'Film + teaser', 6000, 6000, '', 4),
    ('Muzyka', 'DJ Sunset', 4500, 4500, '', 5),
    ('Dekoracje', 'Kwiaty i świece', 5000, 0, 'Wycena w toku', 6),
    ('Tort', 'Słodki Kąt', 1800, 0, '', 7),
    ('Ubrania', 'Suknia + garnitur', 9000, 8500, '', 8)
  RETURNING id, name, sort_order
)
INSERT INTO budget_payments (budget_item_id, label, amount, due_date, is_paid, paid_at, notes)
SELECT i.id, p.label, p.amount, p.due_date::DATE, p.is_paid, p.paid_at::DATE, p.notes
FROM items i
JOIN (VALUES
  (1, 'Zaliczka', 5000, '2025-10-01', true, '2025-10-01', 'Przelew'),
  (1, 'Saldo', 12500, '2026-08-20', false, NULL, ''),
  (2, 'Zaliczka', 8000, '2026-01-15', true, '2026-01-14', ''),
  (2, 'II rata', 8000, '2026-06-01', false, NULL, ''),
  (2, 'Saldo', 10500, '2026-09-01', false, NULL, ''),
  (3, 'Zaliczka', 2500, '2025-11-05', true, '2025-11-05', ''),
  (3, 'II rata', 2500, '2026-05-01', false, NULL, ''),
  (3, 'Saldo', 2500, '2026-09-10', false, NULL, ''),
  (4, 'Zaliczka', 2000, '2025-11-20', true, '2025-11-20', ''),
  (4, 'Saldo', 4000, '2026-08-01', false, NULL, ''),
  (5, 'Zaliczka', 1500, '2026-01-20', true, '2026-01-21', ''),
  (5, 'Saldo', 3000, '2026-08-15', false, NULL, ''),
  (8, 'Suknia — zaliczka', 3000, '2025-12-10', true, '2025-12-10', ''),
  (8, 'Saldo ubrania', 5500, '2026-07-01', false, NULL, '')
) AS p(sort_order, label, amount, due_date, is_paid, paid_at, notes)
  ON i.sort_order = p.sort_order;
