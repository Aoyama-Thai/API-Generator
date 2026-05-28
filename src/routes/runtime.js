const express = require('express');
const apiRuntime = require('../services/apiRuntime');
const runtimeCors = require('../middleware/runtimeCors');

const router = express.Router();

router.all('*', async (req, res) => {
  const fullPath = apiRuntime.normalizeRuntimePath(`${req.baseUrl}${req.path}`);
  const api = apiRuntime.findApi(req.method, fullPath);

  if (!api) {
    return res.status(404).json({ success: false, error: 'API not found' });
  }

  const start = Date.now();
  try {
    const result = await apiRuntime.executeApi(api, req);
    const duration = Date.now() - start;
    apiRuntime.logUsage({ api, req, statusCode: 200, durationMs: duration });
    res.json({
      success: true,
      data: result.rows,
      meta: { rowCount: result.rowCount, durationMs: duration },
    });
  } catch (err) {
    const duration = Date.now() - start;
    apiRuntime.logUsage({
      api,
      req,
      statusCode: 500,
      durationMs: duration,
      errorMessage: err.message,
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

function mountRuntimeRoutes(app) {
  app.use('/runtime', runtimeCors);
  app.use('/runtime', router);
  const count = apiRuntime.loadActiveApis().length;
  console.log(`Runtime API: ${count} active endpoint(s) — auto-reload on create/edit (no restart)`);
}

module.exports = { mountRuntimeRoutes };
