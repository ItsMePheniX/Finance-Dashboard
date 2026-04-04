-- Set one user to normal_user (replace email if needed).
-- This script:
-- 1) Ensures normal_user role exists for the user.
-- 2) Removes other roles for that user.
-- 3) Syncs users.role_id if the column exists (migration 0007).

BEGIN;

WITH target AS (
  SELECT id
  FROM users
  WHERE lower(email) = lower('paisabanao.exe@gmail.com')
  LIMIT 1
)
INSERT INTO user_roles (user_id, role)
SELECT id, 'normal_user'::app_role
FROM target
ON CONFLICT (user_id, role) DO NOTHING;

WITH target AS (
  SELECT id
  FROM users
  WHERE lower(email) = lower('paisabanao.exe@gmail.com')
  LIMIT 1
)
DELETE FROM user_roles ur
USING target t
WHERE ur.user_id = t.id
  AND ur.role <> 'normal_user'::app_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role_id'
  ) THEN
    UPDATE users u
    SET
      role_id = r.id,
      updated_at = now()
    FROM roles r
    WHERE lower(u.email) = lower('paisabanao.exe@gmail.com')
      AND r.name = 'normal_user'::app_role;
  END IF;
END
$$;

COMMIT;
