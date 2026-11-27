-- schema_007: separate super admin accounts. Run once. It replaces schema_006 (do not run 006 again).
BEGIN;

CREATE TABLE IF NOT EXISTS superadmins (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    settings      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT superadmin_email_lowercase CHECK (email = LOWER(email))
);

-- Normal accounts have exactly one role: user
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'user';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = 'user');

-- Super admin ids for approvals and the audit log
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS approved_by_admin BIGINT REFERENCES superadmins(id) ON DELETE SET NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_admin_id BIGINT REFERENCES superadmins(id) ON DELETE SET NULL;

-- Calendar columns the code already uses (schema_004 was empty)
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS scheduled_platform VARCHAR(20);

-- A super admin edits the workspace record and is not in the users table
ALTER TABLE IF EXISTS workspace_settings DROP CONSTRAINT IF EXISTS workspace_settings_updated_by_fkey;

COMMIT;

SELECT id, name, email, role FROM users ORDER BY id;