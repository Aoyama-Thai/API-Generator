const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32chars!!',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  viewsPath: path.join(__dirname, '../../../views'),
  publicPath: path.join(__dirname, '../../public'),
  dataPath: path.join(__dirname, '../../data'),
};
