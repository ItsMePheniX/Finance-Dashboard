-- Add explicit roles foreign key on users.
-- This keeps existing user_roles RBAC model intact while adding a direct relation:
-- users.role_id -> roles.id

CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name app_role NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
    role_name app_role;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['admin'::app_role, 'analyst'::app_role, 'normal_user'::app_role]
    LOOP
        BEGIN
            INSERT INTO roles (name)
            VALUES (role_name);
        EXCEPTION
            WHEN unique_violation THEN
                NULL;
        END;
    END LOOP;
END
$$;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_role_id'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_role_id
            FOREIGN KEY (role_id)
            REFERENCES roles(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Backfill users.role_id from existing user_roles using precedence:
-- admin > analyst > normal_user.
WITH ranked_roles AS (
    SELECT
        ur.user_id,
        r.id AS role_id,
        row_number() OVER (
            PARTITION BY ur.user_id
            ORDER BY
                CASE ur.role
                    WHEN 'admin' THEN 1
                    WHEN 'analyst' THEN 2
                    ELSE 3
                END,
                ur.created_at ASC
        ) AS rn
    FROM user_roles ur
    JOIN roles r ON r.name = ur.role
),
resolved_roles AS (
    SELECT user_id, role_id
    FROM ranked_roles
    WHERE rn = 1
)
UPDATE users u
SET
    role_id = rr.role_id,
    updated_at = now()
FROM resolved_roles rr
WHERE u.id = rr.user_id
  AND u.role_id IS DISTINCT FROM rr.role_id;

-- Ensure users with no mapped role still have a default direct role reference.
UPDATE users u
SET
    role_id = r.id,
    updated_at = now()
FROM roles r
WHERE r.name = 'normal_user'::app_role
  AND u.role_id IS NULL;

-- Keep users.role_id synchronized whenever user_roles changes.
CREATE OR REPLACE FUNCTION sync_users_role_id_from_user_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id uuid;
    resolved_role_id uuid;
BEGIN
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);

    SELECT r.id
    INTO resolved_role_id
    FROM user_roles ur
    JOIN roles r ON r.name = ur.role
    WHERE ur.user_id = target_user_id
    ORDER BY
        CASE ur.role
            WHEN 'admin' THEN 1
            WHEN 'analyst' THEN 2
            ELSE 3
        END,
        ur.created_at ASC
    LIMIT 1;

    UPDATE users u
    SET
        role_id = resolved_role_id,
        updated_at = now()
    WHERE u.id = target_user_id
      AND u.role_id IS DISTINCT FROM resolved_role_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_users_role_id_on_user_roles ON user_roles;

CREATE TRIGGER trg_sync_users_role_id_on_user_roles
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_users_role_id_from_user_roles();
