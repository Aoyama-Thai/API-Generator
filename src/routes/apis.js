const express = require('express');
const { getDb } = require('../db');
const apiRuntime = require('../services/apiRuntime');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function listApis() {
  return getDb()
    .prepare(
      `SELECT a.*, g.name as group_name, g.prefix_path, sq.name as query_name
       FROM apis a
       JOIN api_groups g ON g.id = a.group_id
       LEFT JOIN sql_queries sq ON sq.id = a.sql_query_id
       ORDER BY g.name, a.name`
    )
    .all();
}

router.get('/apis', requireAuth, (req, res) => {
  const apis = listApis().map((api) => ({
    ...api,
    runtime_path: apiRuntime.buildRuntimePath({
      group_prefix: api.prefix_path,
      path: api.path,
    }),
  }));

  res.render('apis/index', {
    title: 'APIs',
    user: req.session.user,
    apis,
    message: req.query.message,
  });
});

router.get('/apis/new', requireAuth, (req, res) => {
  res.render('apis/form', {
    title: 'สร้าง API',
    user: req.session.user,
    api: null,
    groups: getDb().prepare('SELECT * FROM api_groups ORDER BY name').all(),
    queries: getDb().prepare('SELECT id, name FROM sql_queries ORDER BY name').all(),
    connections: getDb().prepare('SELECT id, name FROM db_connections ORDER BY name').all(),
    action: '/apis',
  });
});

router.get('/apis/:id/edit', requireAuth, (req, res) => {
  const api = getDb().prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id);
  if (!api) return res.redirect('/apis?error=not_found');

  res.render('apis/form', {
    title: 'แก้ไข API',
    user: req.session.user,
    api,
    groups: getDb().prepare('SELECT * FROM api_groups ORDER BY name').all(),
    queries: getDb().prepare('SELECT id, name FROM sql_queries ORDER BY name').all(),
    connections: getDb().prepare('SELECT id, name FROM db_connections ORDER BY name').all(),
    action: `/apis/${api.id}?_method=PUT`,
  });
});

router.post('/apis', requireAuth, (req, res) => {
  try {
    getDb()
      .prepare(
        `INSERT INTO apis (group_id, name, path, http_method, connection_id, sql_query_id, description, parameters_json, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.body.group_id,
        req.body.name,
        normalizePath(req.body.path),
        req.body.http_method || 'GET',
        req.body.connection_id || null,
        req.body.sql_query_id || null,
        req.body.description || '',
        req.body.parameters_json || '[]',
        req.body.is_active ? 1 : 0
      );
    res.redirect('/apis?message=created');
  } catch (err) {
    res.redirect(`/apis/new?error=${encodeURIComponent(err.message)}`);
  }
});

router.put('/apis/:id', requireAuth, (req, res) => {
  getDb()
    .prepare(
      `UPDATE apis SET group_id=?, name=?, path=?, http_method=?, connection_id=?, sql_query_id=?,
       description=?, parameters_json=?, is_active=?, updated_at=datetime('now') WHERE id=?`
    )
    .run(
      req.body.group_id,
      req.body.name,
      normalizePath(req.body.path),
      req.body.http_method || 'GET',
      req.body.connection_id || null,
      req.body.sql_query_id || null,
      req.body.description || '',
      req.body.parameters_json || '[]',
      req.body.is_active ? 1 : 0,
      req.params.id
    );
  res.redirect('/apis?message=updated');
});

router.delete('/apis/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM apis WHERE id = ?').run(req.params.id);
  res.redirect('/apis?message=deleted');
});

function normalizePath(p) {
  return String(p || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

module.exports = router;
