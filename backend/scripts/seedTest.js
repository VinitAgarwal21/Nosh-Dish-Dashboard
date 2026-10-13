const { getDb, resolveDbPath } = require('../src/db/connection');
const dishRepository = require('../src/db/dishRepository');

function seedTestDishes() {
  const dbPath = resolveDbPath();
  const db = getDb();

  console.log(`[Seed Test] Target database: ${dbPath}`);

  // Test dish with an invalid HTTP/HTTPS image URL (for verifying validation check #4)
  dishRepository.insertOrReplaceDish(
    {
      dishId: 'test-bad-url',
      dishName: 'Dish With Malformed Image URL',
      imageUrl: 'invalid-image-protocol://broken/image.jpg',
      isPublished: 0,
      version: 1,
    },
    db
  );

  console.log('[Seed Test] Successfully inserted test dish:');
  console.log('  - dishId: test-bad-url');
  console.log('  - dishName: "Dish With Malformed Image URL"');
  console.log('  - imageUrl: "invalid-image-protocol://broken/image.jpg" (invalid HTTP/HTTPS)');
  console.log('  - isPublished: false (draft)');
  console.log('  - version: 1');
  console.log('\nYou can now attempt to publish this dish in the dashboard or via PATCH to observe the 400 validation error.');
}

if (require.main === module) {
  seedTestDishes();
}

module.exports = seedTestDishes;
