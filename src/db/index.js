const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { SCHEMA } = require('./schema');

let db;

function wrapDatabase(nativeDb) {
  return {
    prepare(sql) {
      const stmt = nativeDb.prepare(sql);
      return {
        get(...params) {
          return stmt.get(...params);
        },
        all(...params) {
          return stmt.all(...params);
        },
        run(...params) {
          stmt.run(...params);
          return {
            lastInsertRowid: nativeDb.lastInsertRowid,
            changes: nativeDb.changes,
          };
        },
      };
    },
    exec(sql) {
      nativeDb.exec(sql);
    },
    close() {
      nativeDb.close();
    },
  };
}

function getDb() {
  if (!db) {
    fs.mkdirSync(config.dataPath, { recursive: true });
    const dbPath = path.join(config.dataPath, 'app.db');
    const nativeDb = new DatabaseSync(dbPath);
    nativeDb.exec('PRAGMA journal_mode = WAL');
    nativeDb.exec('PRAGMA foreign_keys = ON');
    nativeDb.exec(SCHEMA);
    db = wrapDatabase(nativeDb);
    seedAdminUser();
  }
  return db;
}

function seedAdminUser() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) {
    const hash = bcrypt.hashSync(config.adminPassword, 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
    ).run(config.adminUsername, hash, 'Administrator', 'admin');
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
