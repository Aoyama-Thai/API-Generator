const fs = require('fs');
const path = require('path');
const pg = require('pg');
const { DatabaseSync } = require('node:sqlite');
const { isSqlDriver } = require('../constants/dbTypes');

let ibmDb;
try {
  ibmDb = require('ibm_db');
} catch {
  ibmDb = null;
}

async function ping(conn, password) {
  if (conn.db_type === 'mongodb') {
    await pingMongo(conn, password);
    return;
  }
  await executeQuery(conn, password, getPingQuery(conn.db_type), {});
}

function getPingQuery(dbType) {
  if (dbType === 'mssql') return 'SELECT 1 AS ok';
  if (dbType === 'db2') return 'SELECT 1 AS ok FROM SYSIBM.SYSDUMMY1';
  return 'SELECT 1 AS ok';
}

async function executeQuery(conn, password, queryText, params = {}) {
  const dbType = conn.db_type;
  const options = JSON.parse(conn.options_json || '{}');

  if (dbType === 'mongodb') {
    return executeMongo(conn, password, queryText, params, options);
  }
  if (dbType === 'postgres') {
    return executePostgres(conn, password, queryText, params, options);
  }
  if (dbType === 'mssql') {
    return executeMssql(conn, password, queryText, params, options);
  }
  if (dbType === 'mysql' || dbType === 'mariadb') {
    return executeMysql(conn, password, queryText, params, options);
  }
  if (dbType === 'sqlite') {
    return executeSqlite(conn, queryText, params, options);
  }
  if (dbType === 'db2') {
    return executeDb2(conn, password, queryText, params, options);
  }
  throw new Error(`Unsupported database type: ${dbType}`);
}

async function executePostgres(conn, password, queryText, params, options) {
  const client = new pg.Client({
    host: conn.host,
    port: conn.port,
    database: conn.database_name,
    user: conn.username,
    password,
    ssl: options.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const { text, values } = bindParams(queryText, params, '$');
    const result = await client.query(text, values);
    if (result.command === 'SELECT') {
      return { rows: result.rows, rowCount: result.rowCount };
    }
    return { rows: result.rows || [], rowCount: result.rowCount, command: result.command };
  } finally {
    await client.end().catch(() => {});
  }
}

async function executeMssql(conn, password, queryText, params, options) {
  const sql = require('mssql');
  const pool = await sql.connect({
    server: conn.host,
    port: conn.port,
    database: conn.database_name,
    user: conn.username,
    password,
    options: {
      encrypt: options.encrypt !== false,
      trustServerCertificate: options.trustServerCertificate !== false,
    },
  });

  try {
    const request = pool.request();
    const { text, values } = bindParams(queryText, params, '@');
    values.forEach((val, i) => request.input(`p${i + 1}`, val));
    const mssqlText = text.replace(/\$(\d+)/g, (_, n) => `@p${n}`);
    const result = await request.query(mssqlText);
    return { rows: result.recordset || [], rowCount: result.rowsAffected?.[0] ?? 0 };
  } finally {
    await pool.close().catch(() => {});
  }
}

async function executeMysql(conn, password, queryText, params, options) {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: conn.host,
    port: conn.port,
    database: conn.database_name,
    user: conn.username,
    password,
    ssl: options.ssl || undefined,
  });

  try {
    const { text, values } = bindParams(queryText, params, '?');
    const [result] = await connection.execute(text, values);
    if (Array.isArray(result)) {
      return { rows: result, rowCount: result.length };
    }
    return { rows: [], rowCount: result?.affectedRows ?? 0, command: result?.command };
  } finally {
    await connection.end().catch(() => {});
  }
}

function executeSqlite(conn, queryText, params, options) {
  const dbPath = path.resolve(conn.database_name);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite file not found: ${dbPath}`);
  }

  const nativeDb = new DatabaseSync(dbPath, {
    readOnly: options.readOnly !== false,
  });

  const { text, values } = bindParams(queryText, params, '?');
  const stmt = nativeDb.prepare(text);
  const trimmed = text.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
    const rows = stmt.all(...values);
    return { rows, rowCount: rows.length };
  }

  const result = stmt.run(...values);
  return { rows: [], rowCount: result.changes ?? 0, command: 'RUN' };
}

async function executeDb2(conn, password, queryText, params, options) {
  if (!ibmDb) {
    throw new Error('ibm_db package is not installed. Run: npm install ibm_db');
  }

  const connStr = [
    `DATABASE=${conn.database_name}`,
    `HOSTNAME=${conn.host}`,
    `PORT=${conn.port}`,
    `PROTOCOL=TCPIP`,
    `UID=${conn.username}`,
    `PWD=${password}`,
  ].join(';');

  return new Promise((resolve, reject) => {
    ibmDb.open(connStr, (err, connection) => {
      if (err) return reject(err);

      const { text, values } = bindParams(queryText, params, '?');
      connection.query(text, values, (queryErr, rows) => {
        connection.close(() => {});
        if (queryErr) return reject(queryErr);
        const resultRows = Array.isArray(rows) ? rows : rows ? [rows] : [];
        resolve({ rows: resultRows, rowCount: resultRows.length });
      });
    });
  });
}

function buildMongoUri(conn, password, options) {
  if (options.uri) return options.uri;

  const host = conn.host || 'localhost';
  const port = conn.port || 27017;
  const user = conn.username ? encodeURIComponent(conn.username) : '';
  const pass = password ? encodeURIComponent(password) : '';
  const auth =
    user && pass ? `${user}:${pass}@` : user ? `${user}@` : '';

  const params = new URLSearchParams();
  if (options.authSource) params.set('authSource', options.authSource);
  const qs = params.toString();

  return `mongodb://${auth}${host}:${port}/${conn.database_name}${qs ? `?${qs}` : ''}`;
}

async function pingMongo(conn, password) {
  const { MongoClient } = require('mongodb');
  const options = JSON.parse(conn.options_json || '{}');
  const client = new MongoClient(buildMongoUri(conn, password, options));
  try {
    await client.connect();
    await client.db(conn.database_name).command({ ping: 1 });
  } finally {
    await client.close().catch(() => {});
  }
}

async function executeMongo(conn, password, queryText, params, options) {
  const { MongoClient } = require('mongodb');
  let spec;
  try {
    spec = JSON.parse(queryText);
  } catch {
    throw new Error('MongoDB query must be valid JSON');
  }

  if (!spec.collection) {
    throw new Error('MongoDB query requires "collection"');
  }

  const operation = (spec.operation || 'find').toLowerCase();
  const client = new MongoClient(buildMongoUri(conn, password, options));

  try {
    await client.connect();
    const collection = client.db(conn.database_name).collection(spec.collection);

    if (operation === 'find') {
      const filter = substituteMongoParams(spec.filter || {}, params);
      const cursor = collection.find(filter, {
        projection: spec.projection || undefined,
        sort: spec.sort || undefined,
        limit: spec.limit,
        skip: spec.skip,
      });
      const rows = await cursor.toArray();
      return { rows, rowCount: rows.length };
    }

    if (operation === 'findone') {
      const filter = substituteMongoParams(spec.filter || {}, params);
      const row = await collection.findOne(filter, { projection: spec.projection || undefined });
      const rows = row ? [row] : [];
      return { rows, rowCount: rows.length };
    }

    if (operation === 'aggregate') {
      const pipeline = substituteMongoParams(spec.pipeline || [], params);
      const rows = await collection.aggregate(pipeline).toArray();
      return { rows, rowCount: rows.length };
    }

    if (operation === 'count') {
      const filter = substituteMongoParams(spec.filter || {}, params);
      const count = await collection.countDocuments(filter);
      return { rows: [{ count }], rowCount: 1 };
    }

    throw new Error(`Unsupported MongoDB operation: ${operation}`);
  } finally {
    await client.close().catch(() => {});
  }
}

function substituteMongoParams(value, params) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const match = value.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (match) {
      const name = match[1];
      if (!(name in params)) throw new Error(`Missing parameter: ${name}`);
      return params[name];
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteMongoParams(item, params));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = substituteMongoParams(val, params);
    }
    return out;
  }
  return value;
}

function bindParams(queryText, params, placeholderStyle) {
  const values = [];
  let index = 0;

  const text = queryText.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Missing parameter: ${name}`);
    }
    values.push(params[name]);
    index += 1;
    if (placeholderStyle === '$') return `$${index}`;
    if (placeholderStyle === '@') return `@p${index}`;
    return '?';
  });

  return { text, values };
}

module.exports = { executeQuery, ping, getPingQuery, isSqlDriver };
