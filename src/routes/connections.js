const express = require('express');
const dbConnection = require('../services/dbConnection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/connections', requireAuth, (req, res) => {
  res.render('connections/index', {
    title: req.t('databaseConnections'),
    user: req.session.user,
    connections: dbConnection.listConnections(),
    message: req.query.message,
    error: req.query.error,
  });
});

router.get('/connections/new', requireAuth, (req, res) => {
  res.render('connections/form', {
    title: req.t('add'),
    user: req.session.user,
    connection: null,
    action: '/connections',
  });
});

router.get('/connections/:id/edit', requireAuth, (req, res) => {
  const connection = dbConnection.getConnectionById(req.params.id);
  if (!connection) return res.redirect('/connections?error=not_found');
  res.render('connections/form', {
    title: req.t('edit'),
    user: req.session.user,
    connection,
    action: `/connections/${connection.id}?_method=PUT`,
  });
});

router.post('/connections', requireAuth, async (req, res) => {
  try {
    dbConnection.createConnection(req.body);
    res.redirect('/connections?message=created');
  } catch (err) {
    res.redirect(`/connections/new?error=${encodeURIComponent(err.message)}`);
  }
});

router.put('/connections/:id', requireAuth, (req, res) => {
  const ok = dbConnection.updateConnection(req.params.id, req.body);
  res.redirect(ok ? '/connections?message=updated' : '/connections?error=not_found');
});

router.delete('/connections/:id', requireAuth, (req, res) => {
  dbConnection.deleteConnection(req.params.id);
  res.redirect('/connections?message=deleted');
});

router.post('/connections/:id/test', requireAuth, async (req, res) => {
  try {
    const result = await dbConnection.testConnection(parseInt(req.params.id, 10));
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
