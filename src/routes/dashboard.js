const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  const db = getDb();

  const stats = {
    connections: db.prepare('SELECT COUNT(*) as c FROM db_connections').get().c,
    groups: db.prepare('SELECT COUNT(*) as c FROM api_groups').get().c,
    queries: db.prepare('SELECT COUNT(*) as c FROM sql_queries').get().c,
    apis: db.prepare('SELECT COUNT(*) as c FROM apis').get().c,
    activeApis: db.prepare('SELECT COUNT(*) as c FROM apis WHERE is_active = 1').get().c,
    totalCalls: db.prepare('SELECT COUNT(*) as c FROM api_usage_logs').get().c,
    callsToday: db
      .prepare("SELECT COUNT(*) as c FROM api_usage_logs WHERE date(created_at) = date('now')")
      .get().c,
    errorsToday: db
      .prepare(
        "SELECT COUNT(*) as c FROM api_usage_logs WHERE date(created_at) = date('now') AND status_code >= 400"
      )
      .get().c,
    avgDuration: db
      .prepare(
        "SELECT ROUND(AVG(duration_ms), 2) as avg FROM api_usage_logs WHERE date(created_at) = date('now')"
      )
      .get().avg || 0,
  };

  const callsByDay = db
    .prepare(
      `SELECT date(created_at) as day, COUNT(*) as count
       FROM api_usage_logs
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY day`
    )
    .all();

  const topApis = db
    .prepare(
      `SELECT COALESCE(a.name, l.endpoint) as name, COUNT(*) as count
       FROM api_usage_logs l
       LEFT JOIN apis a ON a.id = l.api_id
       GROUP BY l.api_id
       ORDER BY count DESC
       LIMIT 5`
    )
    .all();

  const recentLogs = db
    .prepare(
      `SELECT l.*, a.name as api_name
       FROM api_usage_logs l
       LEFT JOIN apis a ON a.id = l.api_id
       ORDER BY l.created_at DESC
       LIMIT 10`
    )
    .all();

  res.render('dashboard', {
    title: 'Dashboard',
    user: req.session.user,
    stats,
    callsByDay,
    topApis,
    recentLogs,
  });
});

module.exports = router;
