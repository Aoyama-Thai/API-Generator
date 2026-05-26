const pg = require('pg');

let ibmDb;
try {
  ibmDb = require('ibm_db');
} catch {
  ibmDb = null;
}

async function ping(conn, password) {
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

  if (dbType === 'postgres') {
    return executePostgres(conn, password, queryText, params, options);
  }
  if (dbType === 'mssql') {
    return executeMssql(conn, password, queryText, params, options);
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

module.exports = { executeQuery, ping, getPingQuery };
