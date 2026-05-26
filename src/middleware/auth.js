function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session?.user) return res.redirect('/dashboard');
  next();
}

module.exports = { requireAuth, redirectIfAuthenticated };
