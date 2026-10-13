const fs = require('fs');
const path = require('path');
const { getDb, resolveDbPath } = require('../src/db/connection');
const dishRepository = require('../src/db/dishRepository');

function runSeed() {
  const jsonPath = path.resolve(__dirname, '../data/dishes.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`[Seed Error] dishes.json not found at ${jsonPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  let dishes;
  try {
    dishes = JSON.parse(rawData);
  } catch (err) {
    console.error('[Seed Error] Failed to parse dishes.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(dishes)) {
    console.error('[Seed Error] Expected dishes.json to contain an array of dishes.');
    process.exit(1);
  }

  const dbPath = resolveDbPath();
  const db = getDb();

  console.log(`[Seed] Target database: ${dbPath}`);
  console.log(`[Seed] Processing ${dishes.length} dishes from seed file...`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const item of dishes) {
    // Map input fields robustly
    const dishId = String(item.dishId ?? item.dish_id ?? item.id ?? '').trim();
    const dishName = String(item.dishName ?? item.dish_name ?? item.name ?? '').trim();
    const imageUrl = String(item.imageUrl ?? item.image_url ?? item.image ?? '').trim();
    const isPublished = Boolean(item.isPublished ?? item.is_published ?? false);

    if (!dishId) {
      console.warn('[Seed Warning] Skipping dish without valid dishId:', item);
      skippedCount++;
      continue;
    }

    const inserted = dishRepository.insertDishIfMissing(
      {
        dishId,
        dishName,
        imageUrl,
        isPublished,
      },
      db
    );

    if (inserted) {
      insertedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`[Seed] Seeding complete: ${insertedCount} inserted, ${skippedCount} skipped.`);
}

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
