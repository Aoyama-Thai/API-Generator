const { getDb } = require('../db');
const { decrypt, encrypt } = require('./crypto');

function listConnections() {
  return getDb()
    .prepare(
      `SELECT id, name, db_type, host, port, database_name, username, options_json, is_active, created_at, updated_at
       FROM db_connections ORDER BY name`
    )
    .all();
}

function getConnectionById(id) {
  return getDb().prepare('SELECT * FROM db_connections WHERE id = ?').get(id);
}

function getConnectionPassword(conn) {
  return decrypt(conn.password_encrypted);
}

function createConnection(data) {
  const result = getDb()
    .prepare(
      `INSERT INTO db_connections (name, db_type, host, port, database_name, username, password_encrypted, options_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.name,
      data.db_type,
      data.host,
      data.port || defaultPort(data.db_type),
      data.database_name,
      data.username,
      encrypt(data.password),
      JSON.stringify(data.options || {})
    );
  return result.lastInsertRowid;
}

function updateConnection(id, data) {
  const existing = getConnectionById(id);
  if (!existing) return false;

  const password = data.password ? encrypt(data.password) : existing.password_encrypted;

  getDb()
    .prepare(
      `UPDATE db_connections SET name=?, db_type=?, host=?, port=?, database_name=?, username=?,
       password_encrypted=?, options_json=?, is_active=?, updated_at=datetime('now') WHERE id=?`
    )
    .run(
      data.name,
      data.db_type,
      data.host,
      data.port || defaultPort(data.db_type),
      data.database_name,
      data.username,
      password,
      JSON.stringify(data.options || {}),
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active,
      id
    );
  return true;
}

function deleteConnection(id) {
  return getDb().prepare('DELETE FROM db_connections WHERE id = ?').run(id).changes > 0;
}

function defaultPort(dbType) {
  const ports = { mssql: 1433, postgres: 5432, db2: 50000 };
  return ports[dbType] || 0;
}

async function testConnection(connOrId) {
  const conn = typeof connOrId === 'number' ? getConnectionById(connOrId) : connOrId;
  if (!conn) throw new Error('Connection not found');

  const password = getConnectionPassword(conn);
  const executor = require('./sqlExecutor');
  await executor.ping(conn, password);
  return { success: true, message: 'เชื่อมต่อสำเร็จ' };
}

module.exports = {
  listConnections,
  getConnectionById,
  getConnectionPassword,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  defaultPort,
};
