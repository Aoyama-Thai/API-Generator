const express = require('express');
const { getDb } = require('../db');
const dbConnection = require('../services/dbConnection');
const sqlExecutor = require('../services/sqlExecutor');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function listQueries() {
  return getDb()
    .prepare(
      `SELECT sq.*, c.name as connection_name, c.db_type
       FROM sql_queries sq
       JOIN db_connections c ON c.id = sq.connection_id
       ORDER BY sq.name`
    )
    .all();
}

router.get('/sql-queries', requireAuth, (req, res) => {
  res.render('sql-queries/index', {
    title: req.t('navSqlQueries'),
    user: req.session.user,
    queries: listQueries(),
    message: req.query.message,
  });
});

router.get('/sql-queries/new', requireAuth, (req, res) => {
  res.render('sql-queries/form', {
    title: req.t('add'),
    user: req.session.user,
    query: null,
    connections: dbConnection.listConnections(),
    action: '/sql-queries',
  });
});

router.get('/sql-queries/:id/edit', requireAuth, (req, res) => {
  const query = getDb().prepare('SELECT * FROM sql_queries WHERE id = ?').get(req.params.id);
  if (!query) return res.redirect('/sql-queries?error=not_found');
  res.render('sql-queries/form', {
    title: req.t('edit'),
    user: req.session.user,
    query,
    connections: dbConnection.listConnections(),
    action: `/sql-queries/${query.id}?_method=PUT`,
  });
});

router.post('/sql-queries', requireAuth, (req, res) => {
  getDb()
    .prepare(
      `INSERT INTO sql_queries (name, description, connection_id, query_text, query_type, parameters_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.body.name,
      req.body.description || '',
      req.body.connection_id,
      req.body.query_text,
      req.body.query_type || 'select',
      req.body.parameters_json || '[]'
    );
  res.redirect('/sql-queries?message=created');
});

router.put('/sql-queries/:id', requireAuth, (req, res) => {
  getDb()
    .prepare(
      `UPDATE sql_queries SET name=?, description=?, connection_id=?, query_text=?, query_type=?,
       parameters_json=?, updated_at=datetime('now') WHERE id=?`
    )
    .run(
      req.body.name,
      req.body.description || '',
      req.body.connection_id,
      req.body.query_text,
      req.body.query_type || 'select',
      req.body.parameters_json || '[]',
      req.params.id
    );
  res.redirect('/sql-queries?message=updated');
});

router.delete('/sql-queries/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM sql_queries WHERE id = ?').run(req.params.id);
  res.redirect('/sql-queries?message=deleted');
});

router.post('/sql-queries/:id/test', requireAuth, async (req, res) => {
  try {
    const query = getDb().prepare('SELECT * FROM sql_queries WHERE id = ?').get(req.params.id);
    const conn = dbConnection.getConnectionById(query.connection_id);
    const password = dbConnection.getConnectionPassword(conn);
    const params = req.body.params ? JSON.parse(req.body.params) : {};
    const result = await sqlExecutor.executeQuery(conn, password, query.query_text, params);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
