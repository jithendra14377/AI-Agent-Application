ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'member';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member','manager'));

CREATE TABLE IF NOT EXISTS content_jobs (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id         BIGINT NOT NULL REFERENCES users(id),
    instruction      TEXT NOT NULL,
    brief            TEXT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','generating','pending_approval','approved','rejected','publishing','published','partly_failed','failed')),
    seo_title        VARCHAR(200),
    description      TEXT,
    hashtags         TEXT[] NOT NULL DEFAULT '{}',
    copy_by_platform JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_by      BIGINT REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_steps (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id     BIGINT NOT NULL REFERENCES content_jobs(id) ON DELETE CASCADE,
    step_no    INT NOT NULL,
    tool_name  VARCHAR(50) NOT NULL,
    input      JSONB,
    output     JSONB,
    status     VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, step_no)
);

CREATE TABLE IF NOT EXISTS assets (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id       BIGINT NOT NULL REFERENCES content_jobs(id) ON DELETE CASCADE,
    kind         VARCHAR(10) NOT NULL CHECK (kind IN ('image','video')),
    storage_path TEXT NOT NULL,
    provider     VARCHAR(50),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_posts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id      BIGINT NOT NULL REFERENCES content_jobs(id) ON DELETE CASCADE,
    platform    VARCHAR(20) NOT NULL CHECK (platform IN ('instagram','facebook','youtube','linkedin','x','tiktok')),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed')),
    external_id TEXT,
    error       TEXT,
    posted_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, platform)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id   BIGINT REFERENCES users(id),
    action     VARCHAR(50) NOT NULL,
    job_id     BIGINT REFERENCES content_jobs(id) ON DELETE SET NULL,
    detail     JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_owner  ON content_jobs (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON content_jobs (status);
