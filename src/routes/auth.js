const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { redirectIfAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', { error: null, title: 'เข้าสู่ระบบ' });
});

router.post('/login', redirectIfAuthenticated, (req, res) => {
  const { username, password } = req.body;
  const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', title: 'เข้าสู่ระบบ' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    role: user.role,
  };
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
