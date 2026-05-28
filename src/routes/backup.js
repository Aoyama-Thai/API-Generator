const express = require('express');
const apiExportImport = require('../services/apiExportImport');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/backup', requireAuth, (req, res) => {
  res.render('backup/index', {
    title: req.t('backupTitle'),
    user: req.session.user,
    message: req.query.message,
    error: req.query.error,
  });
});

router.get('/backup/export', requireAuth, (req, res) => {
  const bundle = apiExportImport.exportBundle();
  const filename = `api-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(bundle, null, 2));
});

router.post('/backup/import', requireAuth, (req, res) => {
  try {
    const stats = apiExportImport.importBundle(req.body);
    const summary = [
      `การเชื่อมต่อ: สร้าง ${stats.connections.created} อัปเดต ${stats.connections.updated}`,
      `SQL Query: สร้าง ${stats.sql_queries.created} อัปเดต ${stats.sql_queries.updated}`,
      `API Group: สร้าง ${stats.api_groups.created} อัปเดต ${stats.api_groups.updated}`,
      `API: สร้าง ${stats.apis.created} อัปเดต ${stats.apis.updated}`,
    ].join(' | ');
    res.json({ success: true, stats, message: summary });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
