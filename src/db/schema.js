const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS db_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  db_type TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  options_json TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  prefix_path TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sql_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  connection_id INTEGER NOT NULL,
  query_text TEXT NOT NULL,
  query_type TEXT DEFAULT 'select' CHECK (query_type IN ('select', 'insert', 'update', 'delete', 'procedure')),
  parameters_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES db_connections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS apis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  http_method TEXT DEFAULT 'GET' CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  connection_id INTEGER,
  sql_query_id INTEGER,
  description TEXT,
  parameters_json TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES api_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES db_connections(id) ON DELETE SET NULL,
  FOREIGN KEY (sql_query_id) REFERENCES sql_queries(id) ON DELETE SET NULL,
  UNIQUE(group_id, path, http_method)
);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER,
  group_id INTEGER,
  endpoint TEXT,
  http_method TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  client_ip TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_created ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_api ON api_usage_logs(api_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

module.exports = { SCHEMA };
