-- Seed a bootstrap admin mapped to the first authenticated user manually.
-- Replace the UUID/email values below before applying in your environment.

-- Example (commented):
-- INSERT INTO users (auth_user_id, email, full_name)
-- VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'admin@example.com', 'Bootstrap Admin')
-- ON CONFLICT (auth_user_id) DO UPDATE SET email = EXCLUDED.email;
--
-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'admin'::app_role FROM users
-- WHERE auth_user_id = '00000000-0000-0000-0000-000000000000'::uuid
-- ON CONFLICT (user_id, role) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Fake test data (Indian names) for local development and SQL/API verification.
--
-- Important:
-- 1) These are synthetic auth_user_id values. They are useful for DB-level testing.
-- 2) For protected API testing with a real Supabase token, map your real auth user
--    to one of the seeded users by updating auth_user_id in users table.
-- -----------------------------------------------------------------------------

INSERT INTO users (auth_user_id, email, full_name, is_active)
VALUES
	('11111111-1111-1111-1111-111111111111'::uuid, 'rajesh.sharma@example.com', 'Rajesh Sharma', true),
	('22222222-2222-2222-2222-222222222222'::uuid, 'priya.iyer@example.com', 'Priya Iyer', true),
	('33333333-3333-3333-3333-333333333333'::uuid, 'arjun.mehta@example.com', 'Arjun Mehta', true),
	('44444444-4444-4444-4444-444444444444'::uuid, 'neha.verma@example.com', 'Neha Verma', false)
ON CONFLICT (auth_user_id)
DO UPDATE SET
	email = EXCLUDED.email,
	full_name = EXCLUDED.full_name,
	is_active = EXCLUDED.is_active,
	updated_at = now();

-- Role mapping:
-- Rajesh -> admin, Priya -> analyst, Arjun -> normal_user, Neha -> normal_user (inactive)
INSERT INTO user_roles (user_id, role, granted_by)
SELECT admin_u.id, 'admin'::app_role, admin_u.id
FROM users admin_u
WHERE admin_u.auth_user_id = '11111111-1111-1111-1111-111111111111'::uuid
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role, granted_by)
SELECT analyst_u.id, 'analyst'::app_role, admin_u.id
FROM users analyst_u
JOIN users admin_u ON admin_u.auth_user_id = '11111111-1111-1111-1111-111111111111'::uuid
WHERE analyst_u.auth_user_id = '22222222-2222-2222-2222-222222222222'::uuid
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role, granted_by)
SELECT normal_u.id, 'normal_user'::app_role, admin_u.id
FROM users normal_u
JOIN users admin_u ON admin_u.auth_user_id = '11111111-1111-1111-1111-111111111111'::uuid
WHERE normal_u.auth_user_id IN (
	'33333333-3333-3333-3333-333333333333'::uuid,
	'44444444-4444-4444-4444-444444444444'::uuid
)
ON CONFLICT (user_id, role) DO NOTHING;

WITH seed_records AS (
	SELECT * FROM (VALUES
		('11111111-1111-1111-1111-111111111111'::uuid, 'Salary', 180000.00::numeric, 'income',  'INR', '[seed] April salary',               '2026-04-01'::date),
		('11111111-1111-1111-1111-111111111111'::uuid, 'Rent',    45000.00::numeric, 'expense', 'INR', '[seed] Bengaluru apartment rent',  '2026-04-03'::date),
		('11111111-1111-1111-1111-111111111111'::uuid, 'Stocks',  25000.00::numeric, 'income',  'INR', '[seed] Dividend payout',            '2026-04-10'::date),
		('22222222-2222-2222-2222-222222222222'::uuid, 'Consulting', 95000.00::numeric, 'income',  'INR', '[seed] Client retainer',           '2026-04-05'::date),
		('22222222-2222-2222-2222-222222222222'::uuid, 'Groceries',  12000.00::numeric, 'expense', 'INR', '[seed] Monthly groceries',         '2026-04-07'::date),
		('22222222-2222-2222-2222-222222222222'::uuid, 'Travel',     18000.00::numeric, 'expense', 'INR', '[seed] Pune work trip',            '2026-04-15'::date),
		('33333333-3333-3333-3333-333333333333'::uuid, 'Freelance',  42000.00::numeric, 'income',  'INR', '[seed] API integration project',   '2026-04-08'::date),
		('33333333-3333-3333-3333-333333333333'::uuid, 'Utilities',   5500.00::numeric, 'expense', 'INR', '[seed] Electricity and internet',  '2026-04-09'::date),
		('33333333-3333-3333-3333-333333333333'::uuid, 'Food',        7800.00::numeric, 'expense', 'INR', '[seed] Weekend dining',            '2026-04-12'::date)
	) AS t(auth_user_id, category, amount, type, currency, note, record_date)
)
INSERT INTO financial_records (user_id, category, amount, type, currency, note, record_date)
SELECT
	u.id,
	s.category,
	s.amount,
	s.type,
	s.currency,
	s.note,
	s.record_date
FROM seed_records s
JOIN users u ON u.auth_user_id = s.auth_user_id
WHERE NOT EXISTS (
	SELECT 1
	FROM financial_records r
	WHERE r.user_id = u.id
	  AND r.category = s.category
	  AND r.amount = s.amount
	  AND r.type = s.type
	  AND r.currency = s.currency
	  AND COALESCE(r.note, '') = s.note
	  AND r.record_date = s.record_date
);
