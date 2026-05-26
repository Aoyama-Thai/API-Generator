const { getDb } = require('../db');
const dbConnection = require('./dbConnection');
const sqlExecutor = require('./sqlExecutor');

function loadActiveApis() {
  return getDb()
    .prepare(
      `SELECT a.*, g.prefix_path as group_prefix, g.name as group_name,
              sq.query_text, sq.query_type, sq.parameters_json as sql_params_json,
              c.db_type, c.host, c.port, c.database_name, c.username, c.password_encrypted, c.options_json
       FROM apis a
       JOIN api_groups g ON g.id = a.group_id
       LEFT JOIN sql_queries sq ON sq.id = a.sql_query_id
       LEFT JOIN db_connections c ON c.id = COALESCE(a.connection_id, sq.connection_id)
       WHERE a.is_active = 1 AND g.is_active = 1`
    )
    .all();
}

function buildRuntimePath(api) {
  const prefix = api.group_prefix.replace(/^\/|\/$/g, '');
  const path = api.path.replace(/^\/|\/$/g, '');
  return `/runtime/${prefix}/${path}`;
}

function normalizeRuntimePath(path) {
  return path.replace(/\/+$/, '') || path;
}

function findApi(method, requestPath) {
  const path = normalizeRuntimePath(requestPath);
  const httpMethod = method.toUpperCase();
  return loadActiveApis().find(
    (api) => buildRuntimePath(api) === path && api.http_method === httpMethod
  );
}

function collectParams(api, req) {
  const paramDefs = JSON.parse(api.parameters_json || '[]');
  const params = {};

  for (const def of paramDefs) {
    const source = def.source || 'query';
    let value;
    if (source === 'body') value = req.body?.[def.name];
    else if (source === 'path') value = req.params?.[def.name];
    else value = req.query?.[def.name];

    if (value === undefined || value === '') {
      if (def.required) throw new Error(`Missing required parameter: ${def.name}`);
      if (def.default !== undefined) value = def.default;
    }
    if (value !== undefined) params[def.name] = value;
  }

  return params;
}

async function executeApi(api, req) {
  if (!api.query_text) {
    throw new Error('API has no SQL query configured');
  }
  if (!api.password_encrypted) {
    throw new Error('API has no database connection configured');
  }

  const params = collectParams(api, req);
  const password = dbConnection.getConnectionPassword({
    password_encrypted: api.password_encrypted,
  });

  const conn = {
    db_type: api.db_type,
    host: api.host,
    port: api.port,
    database_name: api.database_name,
    username: api.username,
    password_encrypted: api.password_encrypted,
    options_json: api.options_json,
  };

  return sqlExecutor.executeQuery(conn, password, api.query_text, params);
}

function logUsage({ api, req, statusCode, durationMs, errorMessage }) {
  getDb()
    .prepare(
      `INSERT INTO api_usage_logs (api_id, group_id, endpoint, http_method, status_code, duration_ms, client_ip, user_agent, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      api?.id || null,
      api?.group_id || null,
      req.originalUrl,
      req.method,
      statusCode,
      durationMs,
      req.ip,
      req.get('user-agent'),
      errorMessage || null
    );
}

module.exports = {
  loadActiveApis,
  buildRuntimePath,
  normalizeRuntimePath,
  findApi,
  executeApi,
  logUsage,
};
