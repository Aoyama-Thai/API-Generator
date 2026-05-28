const { getDb } = require('../db');
const { encrypt } = require('./crypto');

const EXPORT_VERSION = '1.0';

function exportBundle() {
  const db = getDb();

  const connections = db
    .prepare(
      `SELECT name, db_type, host, port, database_name, username, password_encrypted,
              options_json, is_active
       FROM db_connections ORDER BY name`
    )
    .all();

  const connById = Object.fromEntries(
    db.prepare('SELECT id, name FROM db_connections').all().map((c) => [c.id, c.name])
  );

  const sqlQueries = db
    .prepare(
      `SELECT name, description, connection_id, query_text, query_type, parameters_json
       FROM sql_queries ORDER BY name`
    )
    .all()
    .map((q) => ({
      name: q.name,
      description: q.description,
      connection_name: connById[q.connection_id] || null,
      query_text: q.query_text,
      query_type: q.query_type,
      parameters_json: q.parameters_json,
    }));

  const groupById = Object.fromEntries(
    db.prepare('SELECT id, prefix_path FROM api_groups').all().map((g) => [g.id, g.prefix_path])
  );

  const apis = db
    .prepare(
      `SELECT name, group_id, path, http_method, connection_id, sql_query_id, description,
              parameters_json, is_active
       FROM apis ORDER BY name`
    )
    .all();

  const queryById = Object.fromEntries(
    db.prepare('SELECT id, name FROM sql_queries').all().map((q) => [q.id, q.name])
  );

  const apiGroups = db
    .prepare('SELECT name, description, prefix_path, is_active FROM api_groups ORDER BY name')
    .all();

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    db_connections: connections,
    sql_queries: sqlQueries,
    api_groups: apiGroups,
    apis: apis.map((a) => ({
      name: a.name,
      group_prefix: groupById[a.group_id] || null,
      path: a.path,
      http_method: a.http_method,
      connection_name: a.connection_id ? connById[a.connection_id] || null : null,
      query_name: a.sql_query_id ? queryById[a.sql_query_id] || null : null,
      description: a.description,
      parameters_json: a.parameters_json,
      is_active: a.is_active,
    })),
  };
}

function validateBundle(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
  }
  if (!data.version) {
    throw new Error('ไฟล์ไม่มี version');
  }
  const arrays = ['db_connections', 'sql_queries', 'api_groups', 'apis'];
  for (const key of arrays) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      throw new Error(`${key} ต้องเป็น array`);
    }
  }
}

function findConnectionId(db, name) {
  if (!name) return null;
  const row = db.prepare('SELECT id FROM db_connections WHERE name = ?').get(name);
  return row ? row.id : null;
}

function upsertConnection(db, conn) {
  if (!conn.name) throw new Error('การเชื่อมต่อต้องมี name');

  const existing = db.prepare('SELECT id, password_encrypted FROM db_connections WHERE name = ?').get(conn.name);
  const passwordEncrypted =
    conn.password_encrypted ||
    (conn.password ? encrypt(conn.password) : existing?.password_encrypted);

  if (!passwordEncrypted) {
    throw new Error(`การเชื่อมต่อ "${conn.name}" ไม่มีรหัสผ่าน`);
  }

  if (existing) {
    db.prepare(
      `UPDATE db_connections SET db_type=?, host=?, port=?, database_name=?, username=?,
       password_encrypted=?, options_json=?, is_active=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      conn.db_type,
      conn.host,
      conn.port,
      conn.database_name,
      conn.username,
      passwordEncrypted,
      conn.options_json || '{}',
      conn.is_active !== undefined ? (conn.is_active ? 1 : 0) : 1,
      existing.id
    );
    return { id: existing.id, created: false };
  }

  const result = db
    .prepare(
      `INSERT INTO db_connections (name, db_type, host, port, database_name, username, password_encrypted, options_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      conn.name,
      conn.db_type,
      conn.host,
      conn.port,
      conn.database_name,
      conn.username,
      passwordEncrypted,
      conn.options_json || '{}',
      conn.is_active !== undefined ? (conn.is_active ? 1 : 0) : 1
    );
  return { id: result.lastInsertRowid, created: true };
}

function upsertSqlQuery(db, query) {
  if (!query.name) throw new Error('SQL Query ต้องมี name');
  const connectionId = findConnectionId(db, query.connection_name);
  if (!connectionId) {
    throw new Error(`ไม่พบการเชื่อมต่อ "${query.connection_name}" สำหรับ query "${query.name}"`);
  }

  const existing = db
    .prepare('SELECT id FROM sql_queries WHERE name = ? AND connection_id = ?')
    .get(query.name, connectionId);

  if (existing) {
    db.prepare(
      `UPDATE sql_queries SET description=?, query_text=?, query_type=?, parameters_json=?,
       updated_at=datetime('now') WHERE id=?`
    ).run(
      query.description || '',
      query.query_text,
      query.query_type || 'select',
      query.parameters_json || '[]',
      existing.id
    );
    return { id: existing.id, created: false };
  }

  const result = db
    .prepare(
      `INSERT INTO sql_queries (name, description, connection_id, query_text, query_type, parameters_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      query.name,
      query.description || '',
      connectionId,
      query.query_text,
      query.query_type || 'select',
      query.parameters_json || '[]'
    );
  return { id: result.lastInsertRowid, created: true };
}

function upsertApiGroup(db, group) {
  if (!group.prefix_path) throw new Error('API Group ต้องมี prefix_path');

  const prefix = normalizePrefix(group.prefix_path);
  const existing = db.prepare('SELECT id FROM api_groups WHERE prefix_path = ?').get(prefix);

  if (existing) {
    db.prepare(
      `UPDATE api_groups SET name=?, description=?, is_active=?, updated_at=datetime('now') WHERE id=?`
    ).run(group.name, group.description || '', group.is_active !== undefined ? (group.is_active ? 1 : 0) : 1, existing.id);
    return { id: existing.id, created: false };
  }

  const result = db
    .prepare('INSERT INTO api_groups (name, description, prefix_path, is_active) VALUES (?, ?, ?, ?)')
    .run(group.name, group.description || '', prefix, group.is_active !== undefined ? (group.is_active ? 1 : 0) : 1);
  return { id: result.lastInsertRowid, created: true };
}

function upsertApi(db, api) {
  if (!api.group_prefix) throw new Error(`API "${api.name}" ต้องมี group_prefix`);

  const group = db
    .prepare('SELECT id FROM api_groups WHERE prefix_path = ?')
    .get(normalizePrefix(api.group_prefix));
  if (!group) {
    throw new Error(`ไม่พบ API Group prefix "${api.group_prefix}" สำหรับ API "${api.name}"`);
  }

  let connectionId = api.connection_name ? findConnectionId(db, api.connection_name) : null;
  let sqlQueryId = null;
  if (api.query_name) {
    let q;
    if (connectionId) {
      q = db.prepare('SELECT id FROM sql_queries WHERE name = ? AND connection_id = ?').get(api.query_name, connectionId);
    } else {
      q = db.prepare('SELECT id, connection_id FROM sql_queries WHERE name = ?').get(api.query_name);
      if (q && !connectionId) connectionId = q.connection_id;
    }
    if (!q) throw new Error(`ไม่พบ SQL Query "${api.query_name}"`);
    sqlQueryId = q.id;
  }

  const path = normalizePath(api.path);
  const method = api.http_method || 'GET';
  const existing = db
    .prepare('SELECT id FROM apis WHERE group_id = ? AND path = ? AND http_method = ?')
    .get(group.id, path, method);

  if (existing) {
    db.prepare(
      `UPDATE apis SET name=?, connection_id=?, sql_query_id=?, description=?, parameters_json=?,
       is_active=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      api.name,
      connectionId,
      sqlQueryId,
      api.description || '',
      api.parameters_json || '[]',
      api.is_active !== undefined ? (api.is_active ? 1 : 0) : 1,
      existing.id
    );
    return { id: existing.id, created: false };
  }

  const result = db
    .prepare(
      `INSERT INTO apis (group_id, name, path, http_method, connection_id, sql_query_id, description, parameters_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      group.id,
      api.name,
      path,
      method,
      connectionId,
      sqlQueryId,
      api.description || '',
      api.parameters_json || '[]',
      api.is_active !== undefined ? (api.is_active ? 1 : 0) : 1
    );
  return { id: result.lastInsertRowid, created: true };
}

function importBundle(data) {
  validateBundle(data);
  const db = getDb();
  const stats = {
    connections: { created: 0, updated: 0 },
    sql_queries: { created: 0, updated: 0 },
    api_groups: { created: 0, updated: 0 },
    apis: { created: 0, updated: 0 },
  };

  for (const conn of data.db_connections || []) {
    const r = upsertConnection(db, conn);
    stats.connections[r.created ? 'created' : 'updated']++;
  }

  for (const query of data.sql_queries || []) {
    const r = upsertSqlQuery(db, query);
    stats.sql_queries[r.created ? 'created' : 'updated']++;
  }

  for (const group of data.api_groups || []) {
    const r = upsertApiGroup(db, group);
    stats.api_groups[r.created ? 'created' : 'updated']++;
  }

  for (const api of data.apis || []) {
    const r = upsertApi(db, api);
    stats.apis[r.created ? 'created' : 'updated']++;
  }

  return stats;
}

function normalizePrefix(prefix) {
  return String(prefix || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

function normalizePath(p) {
  return String(p || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

module.exports = { exportBundle, importBundle, EXPORT_VERSION };
