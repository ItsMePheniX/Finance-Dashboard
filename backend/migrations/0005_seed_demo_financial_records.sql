-- Seed demo financial records in DB for users who currently have no records.
-- Safe to run multiple times; inserts only for users without existing financial_records.

WITH users_without_records AS (
    SELECT u.id
    FROM users u
    WHERE u.is_active = true
      AND NOT EXISTS (
          SELECT 1
          FROM financial_records fr
          WHERE fr.user_id = u.id
      )
),
seed_records AS (
    SELECT *
    FROM (
        VALUES
            ('Revenue', 32000.00, 'income', 'INR', 'Client retainer', current_date - 2),
            ('Revenue', 15600.00, 'income', 'INR', 'Consulting fee', current_date - 8),
            ('Revenue', 14500.00, 'income', 'INR', 'Product sale', current_date - 14),
            ('Salaries', 18400.00, 'expense', 'INR', 'Team payroll', current_date - 3),
            ('Infrastructure', 4800.00, 'expense', 'INR', 'Cloud hosting', current_date - 4),
            ('Marketing', 7600.00, 'expense', 'INR', 'Campaign spend', current_date - 6),
            ('Utilities', 2400.00, 'expense', 'INR', 'Internet service', current_date - 10),
            ('Operations', 4200.00, 'expense', 'INR', 'Security audit', current_date - 16),
            ('Travel', 2800.00, 'expense', 'INR', 'Client meeting travel', current_date - 20),
            ('Revenue', 22000.00, 'income', 'INR', 'Project milestone', current_date - 24),
            ('Revenue', 6800.00, 'income', 'INR', 'Workshop tickets', current_date - 28),
            ('Infrastructure', 5500.00, 'expense', 'INR', 'Office rent', current_date - 30)
    ) AS t(category, amount, type, currency, note, record_date)
)
INSERT INTO financial_records (user_id, category, amount, type, currency, note, record_date)
SELECT u.id, s.category, s.amount, s.type, s.currency, s.note, s.record_date
FROM users_without_records u
CROSS JOIN seed_records s;

-- Ensure active users have at least one app role.
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'normal_user'::app_role
FROM users u
WHERE u.is_active = true
  AND NOT EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
