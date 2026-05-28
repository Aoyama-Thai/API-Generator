function needsDbConnectionsMigration(nativeDb) {
  const row = nativeDb
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'db_connections'`)
    .get();
  if (!row?.sql) return false;
  return row.sql.includes("CHECK (db_type IN ('mssql'") && !row.sql.includes("'mongodb'");
}

function migrateDbConnectionsTable(nativeDb) {
  nativeDb.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE db_connections_new (
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
    INSERT INTO db_connections_new SELECT * FROM db_connections;
    DROP TABLE db_connections;
    ALTER TABLE db_connections_new RENAME TO db_connections;
    PRAGMA foreign_keys = ON;
  `);
}

function runMigrations(nativeDb) {
  if (needsDbConnectionsMigration(nativeDb)) {
    migrateDbConnectionsTable(nativeDb);
  }
}

module.exports = { runMigrations };
