-- Seed additional fake financial data for active users.
-- Goals:
-- 1) Add more records for the current month.
-- 2) Ensure data exists across the last 8 months (including current month).
--
-- This migration is idempotent: it skips inserts that already exist with the same
-- user/category/amount/type/currency/note/date tuple.

WITH active_users AS (
    SELECT u.id
    FROM users u
    WHERE u.is_active = true
),
month_windows AS (
    SELECT
        m AS month_offset,
        (date_trunc('month', current_date) - (m || ' months')::interval)::date AS month_start,
        ((date_trunc('month', current_date) - (m || ' months')::interval) + interval '1 month - 1 day')::date AS month_end,
        LEAST(
            ((date_trunc('month', current_date) - (m || ' months')::interval) + interval '1 month - 1 day')::date,
            current_date
        )::date AS max_record_date
    FROM generate_series(0, 7) AS m
),
monthly_seed_records AS (
    SELECT
        'Salary'::text AS category,
        (165000 - (w.month_offset * 800))::numeric(12,2) AS amount,
        'income'::text AS type,
        'INR'::text AS currency,
        format('[seed-0006 m%s] Salary credit', w.month_offset) AS note,
        LEAST(w.month_start + 1, w.max_record_date)::date AS record_date
    FROM month_windows w

    UNION ALL

    SELECT
        'Freelance'::text,
        (22000 + ((7 - w.month_offset) * 600))::numeric(12,2),
        'income'::text,
        'INR'::text,
        format('[seed-0006 m%s] Freelance payout', w.month_offset),
        LEAST(w.month_start + 11, w.max_record_date)::date
    FROM month_windows w

    UNION ALL

    SELECT
        'Rent'::text,
        (42000 + (w.month_offset * 100))::numeric(12,2),
        'expense'::text,
        'INR'::text,
        format('[seed-0006 m%s] House rent', w.month_offset),
        LEAST(w.month_start + 3, w.max_record_date)::date
    FROM month_windows w

    UNION ALL

    SELECT
        'Groceries'::text,
        (9500 + ((w.month_offset % 3) * 650))::numeric(12,2),
        'expense'::text,
        'INR'::text,
        format('[seed-0006 m%s] Grocery basket', w.month_offset),
        LEAST(w.month_start + 8, w.max_record_date)::date
    FROM month_windows w

    UNION ALL

    SELECT
        'Utilities'::text,
        (3600 + ((w.month_offset % 2) * 300))::numeric(12,2),
        'expense'::text,
        'INR'::text,
        format('[seed-0006 m%s] Electricity and internet', w.month_offset),
        LEAST(w.month_start + 14, w.max_record_date)::date
    FROM month_windows w

    UNION ALL

    SELECT
        'Transport'::text,
        (4100 + (w.month_offset * 120))::numeric(12,2),
        'expense'::text,
        'INR'::text,
        format('[seed-0006 m%s] Local commute', w.month_offset),
        LEAST(w.month_start + 18, w.max_record_date)::date
    FROM month_windows w

    UNION ALL

    SELECT
        'Entertainment'::text,
        (5200 + ((w.month_offset % 4) * 450))::numeric(12,2),
        'expense'::text,
        'INR'::text,
        format('[seed-0006 m%s] Weekend activities', w.month_offset),
        LEAST(w.month_start + 24, w.max_record_date)::date
    FROM month_windows w
),
this_month_boost AS (
    SELECT
        'Consulting'::text AS category,
        18000.00::numeric(12,2) AS amount,
        'income'::text AS type,
        'INR'::text AS currency,
        '[seed-0006 this-month] Additional consulting payment'::text AS note,
        current_date::date AS record_date

    UNION ALL

    SELECT
        'Food'::text,
        2400.00::numeric(12,2),
        'expense'::text,
        'INR'::text,
        '[seed-0006 this-month] Team lunch',
        GREATEST(date_trunc('month', current_date)::date, current_date - 1)::date

    UNION ALL

    SELECT
        'Shopping'::text,
        3600.00::numeric(12,2),
        'expense'::text,
        'INR'::text,
        '[seed-0006 this-month] Equipment purchase',
        GREATEST(date_trunc('month', current_date)::date, current_date - 2)::date

    UNION ALL

    SELECT
        'Fuel'::text,
        1700.00::numeric(12,2),
        'expense'::text,
        'INR'::text,
        '[seed-0006 this-month] Fuel refill',
        GREATEST(date_trunc('month', current_date)::date, current_date - 3)::date

    UNION ALL

    SELECT
        'Healthcare'::text,
        2600.00::numeric(12,2),
        'expense'::text,
        'INR'::text,
        '[seed-0006 this-month] Preventive health check',
        GREATEST(date_trunc('month', current_date)::date, current_date - 4)::date
),
all_seed_records AS (
    SELECT * FROM monthly_seed_records
    UNION ALL
    SELECT * FROM this_month_boost
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
FROM active_users u
CROSS JOIN all_seed_records s
WHERE NOT EXISTS (
    SELECT 1
    FROM financial_records fr
    WHERE fr.user_id = u.id
      AND fr.category = s.category
      AND fr.amount = s.amount
      AND fr.type = s.type
      AND fr.currency = s.currency
      AND COALESCE(fr.note, '') = COALESCE(s.note, '')
      AND fr.record_date = s.record_date
);
