-- 8/9  reset → schema → settings_extras → budget → vendors → rsvp_people → gifts → checklist_panel → demo_seed
-- Skok checklisty do zakładki panelu (goście, budżet…).

ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS link_panel TEXT DEFAULT '';
