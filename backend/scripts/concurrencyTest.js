/**
 * Verification Check 7: Concurrency Test
 * Fires parallel PATCH requests with the same expectedVersion against the running backend.
 * Validates that exactly ONE succeeds (HTTP 200) and the rest fail with HTTP 409 Conflict.
 */

const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const TARGET_DISH_ID = process.argv[2] || '1';
const CONCURRENT_REQUESTS = 10;

function sendRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(responseBody);
          } catch {
            parsed = responseBody;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runConcurrencyTest() {
  console.log(`\n========================================`);
  console.log(`Running Concurrency Test on dishId: ${TARGET_DISH_ID}`);
  console.log(`Target: http://localhost:${PORT}/dishes/${TARGET_DISH_ID}`);
  console.log(`Firing ${CONCURRENT_REQUESTS} parallel PATCH requests with the SAME expectedVersion...`);
  console.log(`========================================\n`);

  try {
    // 1. Get current dish
    const getRes = await sendRequest('GET', `/dishes/${TARGET_DISH_ID}`);
    if (getRes.status !== 200) {
      console.error(`[Error] Failed to fetch dish ${TARGET_DISH_ID}. HTTP ${getRes.status}:`, getRes.body);
      process.exit(1);
    }

    const currentDish = getRes.body;
    const originalVersion = currentDish.version;
    console.log(`[Initial State] Dish name: "${currentDish.dishName}", Version: ${originalVersion}`);

    // 2. Dispatch N concurrent requests with the identical expectedVersion
    const promises = [];
    for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
      const payload = {
        dishName: `Concurrent Update #${i}`,
        isPublished: true,
        expectedVersion: originalVersion,
      };
      promises.push(sendRequest('PATCH', `/dishes/${TARGET_DISH_ID}`, payload));
    }

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    const others = results.filter((r) => r.status !== 200 && r.status !== 409);

    console.log(`\n[Results Summary]`);
    console.log(`  - 200 OK (Success):   ${successes.length} (Expected: 1)`);
    console.log(`  - 409 Conflict:       ${conflicts.length} (Expected: ${CONCURRENT_REQUESTS - 1})`);
    console.log(`  - Other status:       ${others.length} (Expected: 0)`);

    // 3. Verify final state
    const finalRes = await sendRequest('GET', `/dishes/${TARGET_DISH_ID}`);
    console.log(`[Final State] Version in DB: ${finalRes.body.version} (Expected: ${originalVersion + 1})`);
    console.log(`[Winning Dish Name]: "${finalRes.body.dishName}"`);

    if (successes.length === 1 && conflicts.length === CONCURRENT_REQUESTS - 1 && finalRes.body.version === originalVersion + 1) {
      console.log(`\n✅ CONCURRENCY TEST PASSED! Optimistic locking successfully prevented race conditions.`);
      process.exit(0);
    } else {
      console.error(`\n❌ CONCURRENCY TEST FAILED! Expected exactly 1 success and ${CONCURRENT_REQUESTS - 1} conflicts.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('[Error] Concurrency test failed to execute:', err.message);
    console.error('Make sure the backend is running (`npm run dev` or `npm start`) on port ' + PORT);
    process.exit(1);
  }
}

runConcurrencyTest();
