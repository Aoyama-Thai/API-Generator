const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/api-groups', requireAuth, (req, res) => {
  const groups = getDb()
    .prepare(
      `SELECT g.*, COUNT(a.id) as api_count
       FROM api_groups g
       LEFT JOIN apis a ON a.group_id = g.id
       GROUP BY g.id
       ORDER BY g.name`
    )
    .all();

  res.render('api-groups/index', {
    title: 'API Groups',
    user: req.session.user,
    groups,
    message: req.query.message,
  });
});

router.get('/api-groups/new', requireAuth, (req, res) => {
  res.render('api-groups/form', {
    title: 'สร้าง API Group',
    user: req.session.user,
    group: null,
    action: '/api-groups',
  });
});

router.get('/api-groups/:id/edit', requireAuth, (req, res) => {
  const group = getDb().prepare('SELECT * FROM api_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.redirect('/api-groups?error=not_found');
  res.render('api-groups/form', {
    title: 'แก้ไข API Group',
    user: req.session.user,
    group,
    action: `/api-groups/${group.id}?_method=PUT`,
  });
});

router.post('/api-groups', requireAuth, (req, res) => {
  try {
    getDb()
      .prepare('INSERT INTO api_groups (name, description, prefix_path, is_active) VALUES (?, ?, ?, ?)')
      .run(req.body.name, req.body.description || '', normalizePrefix(req.body.prefix_path), req.body.is_active ? 1 : 0);
    res.redirect('/api-groups?message=created');
  } catch (err) {
    res.redirect(`/api-groups/new?error=${encodeURIComponent(err.message)}`);
  }
});

router.put('/api-groups/:id', requireAuth, (req, res) => {
  getDb()
    .prepare(
      `UPDATE api_groups SET name=?, description=?, prefix_path=?, is_active=?, updated_at=datetime('now') WHERE id=?`
    )
    .run(
      req.body.name,
      req.body.description || '',
      normalizePrefix(req.body.prefix_path),
      req.body.is_active ? 1 : 0,
      req.params.id
    );
  res.redirect('/api-groups?message=updated');
});

router.delete('/api-groups/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM api_groups WHERE id = ?').run(req.params.id);
  res.redirect('/api-groups?message=deleted');
});

function normalizePrefix(prefix) {
  return String(prefix || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

module.exports = router;
