-- Normalize legacy viewer role to normal_user.
-- This migration is safe to run after older schemas where app_role included viewer.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'app_role' AND e.enumlabel = 'viewer'
    ) THEN
        -- Replace the enum type in one pass and map legacy values during cast.
        -- This avoids "unsafe use of new value" errors in transactional execution.
        ALTER TYPE app_role RENAME TO app_role_old;
        CREATE TYPE app_role AS ENUM ('admin', 'analyst', 'normal_user');

        ALTER TABLE user_roles
            ALTER COLUMN role TYPE app_role
            USING (
                CASE
                    WHEN role::text = 'viewer' THEN 'normal_user'
                    ELSE role::text
                END::app_role
            );

        DROP TYPE app_role_old;
    END IF;
END
$$;
