const corsSettings = require('../services/corsSettings');

function runtimeCors(req, res, next) {
  const settings = corsSettings.getSettings();
  const origin = req.headers.origin;
  const allowOrigin = corsSettings.resolveAllowOrigin(origin, settings);

  if (settings.enabled && allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    if (settings.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', settings.allowedMethods);
    res.setHeader('Access-Control-Allow-Headers', settings.allowedHeaders);
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(allowOrigin ? 204 : settings.enabled ? 403 : 204).end();
  }

  next();
}

module.exports = runtimeCors;
