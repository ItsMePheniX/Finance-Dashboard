-- Set one user to normal_user (replace identifier with email OR username).
-- This script:
-- 1) Ensures normal_user role exists for the user.
-- 2) Removes other roles for that user.
-- 3) Syncs users.role_id if the column exists (migration 0007).
-- 4) Raises an error if no matching user is found.

DO $$
DECLARE
  target_identifier text := 'paisabanao.exe@gmail.com';
  target_user_id uuid;
BEGIN
  SELECT u.id
  INTO target_user_id
  FROM users u
  WHERE lower(u.email) = lower(target_identifier)
     OR lower(COALESCE(u.username, '')) = lower(target_identifier)
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for identifier: %', target_identifier;
  END IF;

  DELETE FROM user_roles
  WHERE user_id = target_user_id

  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'normal_user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

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
    WHERE u.id = target_user_id
      AND r.name = 'normal_user'::app_role;
  END IF;
END
$$;
