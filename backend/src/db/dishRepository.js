const { getDb } = require('./connection');

/**
 * Format a database row into the API response shape.
 */
function formatDish(row) {
  if (!row) return null;
  return {
    dishId: row.dishId,
    dishName: row.dishName,
    imageUrl: row.imageUrl,
    isPublished: Boolean(row.isPublished),
    version: row.version,
  };
}

/**
 * Fetches all dishes from the database.
 * @param {import('better-sqlite3').Database} [db]
 */
function getAllDishes(db = getDb()) {
  const stmt = db.prepare('SELECT dishId, dishName, imageUrl, isPublished, version FROM dishes ORDER BY CAST(dishId AS INTEGER) ASC, dishId ASC');
  const rows = stmt.all();
  return rows.map(formatDish);
}

/**
 * Fetches a single dish by ID.
 * @param {string} dishId
 * @param {import('better-sqlite3').Database} [db]
 */
function getDishById(dishId, db = getDb()) {
  const stmt = db.prepare('SELECT dishId, dishName, imageUrl, isPublished, version FROM dishes WHERE dishId = ?');
  const row = stmt.get(dishId);
  return formatDish(row);
}

/**
 * Atomically updates a dish if expectedVersion matches current version.
 * Runs inside a transaction.
 *
 * @param {Object} params
 * @param {string} params.dishId
 * @param {string} params.dishName - Trimmed dish name
 * @param {boolean} params.isPublished - Explicit published boolean
 * @param {number} params.expectedVersion - Integer >= 1
 * @param {import('better-sqlite3').Database} [db]
 * @returns {{ status: 'SUCCESS', dish: Object } | { status: 'NOT_FOUND' } | { status: 'CONFLICT', currentDish: Object }}
 */
function updateDishAtomic({ dishId, dishName, isPublished, expectedVersion }, db = getDb()) {
  const runTransaction = db.transaction(() => {
    const updateStmt = db.prepare(
      'UPDATE dishes SET dishName = ?, isPublished = ?, version = version + 1 WHERE dishId = ? AND version = ?'
    );
    const result = updateStmt.run(dishName, isPublished ? 1 : 0, dishId, expectedVersion);

    if (result.changes === 1) {
      const selectStmt = db.prepare('SELECT dishId, dishName, imageUrl, isPublished, version FROM dishes WHERE dishId = ?');
      const updatedRow = selectStmt.get(dishId);
      return {
        status: 'SUCCESS',
        dish: formatDish(updatedRow),
      };
    }

    // result.changes === 0: Either row doesn't exist or version mismatch
    const selectStmt = db.prepare('SELECT dishId, dishName, imageUrl, isPublished, version FROM dishes WHERE dishId = ?');
    const currentRow = selectStmt.get(dishId);

    if (!currentRow) {
      return { status: 'NOT_FOUND' };
    }

    return {
      status: 'CONFLICT',
      currentDish: formatDish(currentRow),
    };
  });

  return runTransaction();
}

/**
 * Inserts a dish if not already present (INSERT OR IGNORE).
 * @param {Object} dish
 * @param {import('better-sqlite3').Database} [db]
 * @returns {boolean} true if inserted, false if ignored/skipped
 */
function insertDishIfMissing(dish, db = getDb()) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO dishes (dishId, dishName, imageUrl, isPublished, version)
    VALUES (?, ?, ?, ?, 1)
  `);
  const result = stmt.run(dish.dishId, dish.dishName, dish.imageUrl, dish.isPublished ? 1 : 0);
  return result.changes > 0;
}

/**
 * Inserts or replaces a dish (useful for test setup).
 * @param {Object} dish
 * @param {import('better-sqlite3').Database} [db]
 */
function insertOrReplaceDish(dish, db = getDb()) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO dishes (dishId, dishName, imageUrl, isPublished, version)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(dish.dishId, dish.dishName, dish.imageUrl, dish.isPublished ? 1 : 0, dish.version || 1);
}

module.exports = {
  formatDish,
  getAllDishes,
  getDishById,
  updateDishAtomic,
  insertDishIfMissing,
  insertOrReplaceDish,
};
