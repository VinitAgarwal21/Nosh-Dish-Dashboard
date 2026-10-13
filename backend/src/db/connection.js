const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

let dbInstance = null;

/**
 * Resolves the database file path consistently whether executed
 * from the project root or the /backend directory.
 */
function resolveDbPath(customPath) {
  const envPath = customPath || process.env.DB_PATH;
  if (!envPath) {
    return path.resolve(__dirname, '../../data/nosh.db');
  }

  if (envPath === ':memory:') {
    return ':memory:';
  }

  if (path.isAbsolute(envPath)) {
    return envPath;
  }

  const cwd = process.cwd();
  // If running from backend folder
  if (path.basename(cwd) === 'backend') {
    return path.resolve(cwd, envPath);
  }

  // If running from root folder and envPath starts with ./data or data/
  if (envPath.startsWith('./data') || envPath.startsWith('data')) {
    return path.resolve(cwd, 'backend', envPath);
  }

  return path.resolve(cwd, envPath);
}

/**
 * Initializes and returns the SQLite database connection.
 * @param {string} [customPath] - Optional override path (e.g., ':memory:' for unit tests)
 * @returns {Database.Database}
 */
function getDb(customPath) {
  if (customPath && customPath === ':memory:') {
    const memDb = new Database(':memory:');
    initSchema(memDb);
    return memDb;
  }

  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const resolvedPath = resolveDbPath(customPath);

  // Ensure target directory exists for file-based DB
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  initSchema(db);

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

/**
 * Ensures table schema is present.
 * @param {Database.Database} db
 */
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      dishId TEXT PRIMARY KEY,
      dishName TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      isPublished INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1
    );
  `);
}

module.exports = {
  getDb,
  resolveDbPath,
  initSchema,
};
