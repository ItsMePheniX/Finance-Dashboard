-- Enforce single-role policy for each user.
-- - Keeps one role per user in user_roles (admin > analyst > normal_user).
-- - Assigns analyst to users missing a role.
-- - Adds unique index on user_roles(user_id).
-- - Synchronizes users.role_id when available.

WITH ranked AS (
    SELECT
        ur.id,
        ur.user_id,
        row_number() OVER (
            PARTITION BY ur.user_id
            ORDER BY
                CASE ur.role
                    WHEN 'admin' THEN 1
                    WHEN 'analyst' THEN 2
                    ELSE 3
                END,
                ur.created_at ASC,
                ur.id ASC
        ) AS rn
    FROM user_roles ur
),
duplicates AS (
    SELECT id
    FROM ranked
    WHERE rn > 1
)
DELETE FROM user_roles ur
USING duplicates d
WHERE ur.id = d.id;

INSERT INTO user_roles (user_id, role)
SELECT u.id, 'analyst'::app_role
FROM users u
WHERE u.is_active = true
  AND NOT EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_id_unique
    ON user_roles(user_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'role_id'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'roles'
    ) THEN
        UPDATE users u
        SET
            role_id = r.id,
            updated_at = now()
        FROM user_roles ur
        JOIN roles r ON r.name = ur.role
        WHERE u.id = ur.user_id
          AND u.role_id IS DISTINCT FROM r.id;

        UPDATE users u
        SET
            role_id = r.id,
            updated_at = now()
        FROM roles r
        WHERE r.name = 'analyst'::app_role
          AND u.role_id IS NULL;
    END IF;
END
$$;
