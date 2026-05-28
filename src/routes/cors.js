const express = require('express');
const corsSettings = require('../services/corsSettings');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/cors', requireAuth, (req, res) => {
  const settings = corsSettings.getSettings();
  res.render('cors/index', {
    title: req.t('corsTitle'),
    user: req.session.user,
    settings,
    runtimeBaseUrl: `${req.protocol}://${req.get('host')}/runtime`,
    message: req.query.message,
    error: req.query.error,
  });
});

router.post('/cors', requireAuth, (req, res) => {
  try {
    corsSettings.saveSettings(req.body);
    res.redirect('/cors?message=saved');
  } catch (err) {
    res.redirect(`/cors?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
