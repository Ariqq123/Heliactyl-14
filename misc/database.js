const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "../database.sqlite");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");

sqlite.exec("CREATE TABLE IF NOT EXISTS keyv (key TEXT PRIMARY KEY, value TEXT)");

const getStmt = sqlite.prepare("SELECT value FROM keyv WHERE key = ?");
const setStmt = sqlite.prepare("INSERT OR REPLACE INTO keyv (key, value) VALUES (?, ?)");
const delStmt = sqlite.prepare("DELETE FROM keyv WHERE key = ?");

const NAMESPACE = "keyv:";

function deserialize(raw) {
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && "value" in parsed) {
    if (parsed.expires && parsed.expires < Date.now()) return undefined;
    return parsed.value;
  }
  return parsed;
}

function serialize(value, ttl) {
  const data = { value, expires: ttl ? Date.now() + ttl : null };
  return JSON.stringify(data);
}

const db = {
  get(key) {
    const row = getStmt.get(NAMESPACE + key);
    return row ? deserialize(row.value) : undefined;
  },
  set(key, value, ttl) {
    setStmt.run(NAMESPACE + key, serialize(value, ttl));
    return true;
  },
  delete(key) {
    const result = delStmt.run(NAMESPACE + key);
    return result.changes > 0;
  }
};

module.exports = db;
module.exports.sqlite = sqlite;
