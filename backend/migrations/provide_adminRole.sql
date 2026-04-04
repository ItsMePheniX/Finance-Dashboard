-- 1) Grant admin role to one user (replace with the real email)
WITH target AS (
  SELECT id
  FROM users
  WHERE lower(email) = lower('paisabanao.exe@gmail.com')
  LIMIT 1
)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM target
ON CONFLICT (user_id, role) DO NOTHING;