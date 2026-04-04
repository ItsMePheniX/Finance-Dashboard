-- Add optional username for classic username/password login.
-- Keep this non-breaking for existing rows by allowing NULL values.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username text;

-- Enforce case-insensitive uniqueness only for populated usernames.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique
    ON users (lower(username))
    WHERE username IS NOT NULL AND username <> '';
