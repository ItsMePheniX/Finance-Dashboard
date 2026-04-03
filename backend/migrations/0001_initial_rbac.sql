-- Initial schema for app-level users and RBAC.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'analyst', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    full_name text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS financial_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    type text NOT NULL CHECK (type IN ('income', 'expense')),
    currency text NOT NULL DEFAULT 'USD',
    note text,
    record_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_user_id ON financial_records(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_record_date ON financial_records(record_date);
