CREATE TABLE IF NOT EXISTS vps_records (
  entity text NOT NULL,
  id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (entity, id)
);
CREATE INDEX IF NOT EXISTS vps_records_entity_created_idx ON vps_records(entity, created_at DESC);
CREATE INDEX IF NOT EXISTS vps_records_owner_idx ON vps_records(entity, created_by_id);
CREATE UNIQUE INDEX IF NOT EXISTS vps_user_email_unique_idx ON vps_records(lower(data->>'email')) WHERE entity='User';

CREATE TABLE IF NOT EXISTS vps_otps (
  email text NOT NULL,
  purpose text NOT NULL,
  code_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY(email, purpose)
);

CREATE TABLE IF NOT EXISTS vps_files (
  id text PRIMARY KEY,
  owner_id text NOT NULL DEFAULT '',
  visibility text NOT NULL CHECK (visibility IN ('private', 'public')),
  original_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vps_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
