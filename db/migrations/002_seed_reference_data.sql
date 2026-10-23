-- ============================================================
-- LUMORA — reference/seed data (idempotent)
-- No fabricated business claims: no prices, no reviews, no
-- customer counts. Only structural data (categories, roles).
-- ============================================================

INSERT INTO roles (id, name_en, name_ar) VALUES
  ('super_admin','Super Admin','مدير النظام'),
  ('operations','Operations Manager','مسؤول العمليات'),
  ('support','Customer Support','دعم العملاء'),
  ('provider','Service Provider','مقدم الخدمة')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission) VALUES
  ('super_admin','booking.create'),
  ('super_admin','booking.confirm'),
  ('super_admin','booking.reject'),
  ('super_admin','booking.assign'),
  ('super_admin','booking.cancel'),
  ('super_admin','catalog.manage'),
  ('super_admin','content.manage'),
  ('operations','booking.confirm'),
  ('operations','booking.reject'),
  ('operations','booking.assign'),
  ('operations','booking.cancel'),
  ('support','support_ticket.create'),
  ('provider','booking.transition')
ON CONFLICT (role_id, permission) DO NOTHING;

-- The nine service categories from the brand direction (§7.5).
-- is_active=true only means "bookable in principle" — no price is set,
-- so every service shows "request a quote" until a pricing rule exists.
INSERT INTO service_categories (name_ar, name_en, sort_order) VALUES
  ('التكييف والتبريد','AC & Cooling',1),
  ('السباكة','Plumbing',2),
  ('الكهرباء','Electrical',3),
  ('تنظيف المنازل','Home Cleaning',4),
  ('مكافحة الحشرات','Pest Control',5),
  ('الألمنية والنجارة','Carpentry & Aluminium',6),
  ('الدهان والتشطيب','Painting & Finishing',7),
  ('النقل والتركيب','Moving & Installation',8),
  ('خدمات متخصصة','Specialized Services',9)
ON CONFLICT DO NOTHING;

-- Default working windows (Fri–Sat weekend per Bahrain, sun–thu here = 0..4)
INSERT INTO time_slots (day_of_week, start_hhmm, end_hhmm, capacity)
SELECT d, '08:00', '14:00', 2 FROM (VALUES (0),(1),(2),(3),(4)) AS t(d)
ON CONFLICT DO NOTHING;

-- Settings placeholders — intentionally EMPTY so nothing false is shown.
-- Populate from verified business config before launch.
INSERT INTO site_settings (key, value) VALUES
  ('contact',  '{"whatsapp":"","phone":"","email":""}'::jsonb),
  ('hours',    '{"start":"08:00","end":"22:00"}'::jsonb),
  ('policies', '{}'::jsonb),
  ('trust_claims', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
