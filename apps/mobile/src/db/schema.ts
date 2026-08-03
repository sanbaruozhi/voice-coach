export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  current_stage INTEGER NOT NULL,
  main_goal TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  planned_duration_min INTEGER NOT NULL,
  actual_duration_sec INTEGER,
  session_type TEXT NOT NULL,
  completed INTEGER NOT NULL,
  throat_status_before TEXT,
  throat_status_after TEXT,
  recommendation_reason TEXT NOT NULL,
  focus_goal TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS session_modules (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  planned_duration_sec INTEGER NOT NULL,
  completed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_scores (
  session_id TEXT PRIMARY KEY,
  throat_ease INTEGER NOT NULL,
  voice_stability INTEGER NOT NULL,
  resonance_forward INTEGER NOT NULL,
  sentence_ending INTEGER NOT NULL,
  naturalness INTEGER NOT NULL,
  difficulty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  file_uri TEXT NOT NULL,
  script_id TEXT,
  duration_sec INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS module_progress (
  category TEXT PRIMARY KEY,
  level INTEGER NOT NULL,
  last_practiced_at TEXT,
  practice_count_7d INTEGER NOT NULL,
  practice_count_30d INTEGER NOT NULL,
  avg_score REAL,
  weak_tags TEXT
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  next_advice TEXT NOT NULL,
  raw_response_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
