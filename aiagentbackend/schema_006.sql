
-- Allow the three account roles in the existing users table.
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('member', 'manager', 'super_admin'));

-- Promote only the requested existing account.
UPDATE users
SET role = 'super_admin'
WHERE LOWER(email) = 'trjr0905@gmail.com';

-- Verify the result.
SELECT id, name, email, role
FROM users
ORDER BY id;
