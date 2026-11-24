-- Settings screen: per-user preferences and one shared workspace record.
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS workspace_settings (
    id         SMALLINT PRIMARY KEY CHECK (id = 1),
    data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO workspace_settings (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;