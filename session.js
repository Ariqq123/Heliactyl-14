const { Store } = require('express-session');
const db = require('./misc/database');

class SqliteStore extends Store {
  constructor(options) {
    super(options);
  }

  get(sid, callback) {
    try {
      const data = db.get(`sess-${sid}`);
      callback(null, data || null);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
      db.set(`sess-${sid}`, session, maxAge);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      db.delete(`sess-${sid}`);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = SqliteStore;
