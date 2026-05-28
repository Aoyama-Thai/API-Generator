const { getDb } = require('../db');
const { decrypt, encrypt } = require('./crypto');
const { isValidDbType, defaultPort } = require('../constants/dbTypes');

function normalizeConnectionInput(data) {
  if (!isValidDbType(data.db_type)) {
    throw new Error(`Unsupported database type: ${data.db_type}`);
  }

  const normalized = { ...data };

  if (normalized.db_type === 'sqlite') {
    normalized.host = normalized.host || 'local';
    normalized.username = normalized.username || '';
    normalized.port = 0;
    normalized.password = normalized.password || '';
  }

  if (normalized.db_type === 'mongodb' && !normalized.username) {
    normalized.username = '';
    normalized.password = normalized.password || '';
  }

  return normalized;
}

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
  const input = normalizeConnectionInput(data);
  const result = getDb()
    .prepare(
      `INSERT INTO db_connections (name, db_type, host, port, database_name, username, password_encrypted, options_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.db_type,
      input.host,
      input.port || defaultPort(input.db_type),
      input.database_name,
      input.username,
      encrypt(input.password || ''),
      JSON.stringify(input.options || {})
    );
  return result.lastInsertRowid;
}

function updateConnection(id, data) {
  const existing = getConnectionById(id);
  if (!existing) return false;

  const input = normalizeConnectionInput(data);
  const password = input.password ? encrypt(input.password) : existing.password_encrypted;

  getDb()
    .prepare(
      `UPDATE db_connections SET name=?, db_type=?, host=?, port=?, database_name=?, username=?,
       password_encrypted=?, options_json=?, is_active=?, updated_at=datetime('now') WHERE id=?`
    )
    .run(
      input.name,
      input.db_type,
      input.host,
      input.port || defaultPort(input.db_type),
      input.database_name,
      input.username,
      password,
      JSON.stringify(input.options || {}),
      input.is_active !== undefined ? (input.is_active ? 1 : 0) : existing.is_active,
      id
    );
  return true;
}

function deleteConnection(id) {
  return getDb().prepare('DELETE FROM db_connections WHERE id = ?').run(id).changes > 0;
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
  normalizeConnectionInput,
};
