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
