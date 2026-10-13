const { getDb } = require('../backend/src/db/connection');
const runSeed = require('../backend/scripts/seed');

try {
  const db = getDb();
  db.exec('DELETE FROM dishes;');
  console.log('[Reset] Existing dishes cleared.');
  runSeed();
} catch (err) {
  console.error('[Reset Error]', err.message);
  process.exit(1);
}
