BEGIN;
SELECT pg_advisory_xact_lock(240024);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(40) UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9_.-]{3,40}$'),
  name VARCHAR(60) NOT NULL,
  pin_hash TEXT NOT NULL,
  accent VARCHAR(12) NOT NULL DEFAULT 'amber' CHECK (accent IN ('amber','cyan','emerald')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (
  key CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_limits_expiry_idx ON auth_limits(reset_at);
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  target_date TIMESTAMPTZ NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Personnel',
  color_theme VARCHAR(12) NOT NULL DEFAULT 'amber'
    CHECK (color_theme IN ('amber', 'cyan', 'emerald')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS objectives_target_date_idx ON objectives(target_date);
-- Legacy rows remain unowned and invisible until explicitly assigned by an administrator.
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS objectives_user_target_idx ON objectives(user_id, target_date);
COMMIT;
