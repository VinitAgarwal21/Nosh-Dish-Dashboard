const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Configure test database
const testDbPath = path.resolve(__dirname, '../data/test.db');
process.env.DB_PATH = testDbPath;
process.env.PORT = '3099';

const { getDb } = require('../src/db/connection');
const dishRepository = require('../src/db/dishRepository');
const app = require('../src/app');

describe('Nosh Dish Dashboard Backend API', () => {
  let db;

  before(() => {
    // Clean up any existing test db
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = getDb(testDbPath);

    // Seed test dishes
    dishRepository.insertOrReplaceDish({
      dishId: '1',
      dishName: 'Jeera Rice',
      imageUrl: 'https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg',
      isPublished: 1,
      version: 1,
    }, db);

    dishRepository.insertOrReplaceDish({
      dishId: '2',
      dishName: 'Paneer Tikka',
      imageUrl: 'https://nosh-assignment.s3.ap-south-1.amazonaws.com/paneer-tikka.jpg',
      isPublished: 1,
      version: 1,
    }, db);

    dishRepository.insertOrReplaceDish({
      dishId: 'bad-img-dish',
      dishName: 'Unpublished Invalid URL Dish',
      imageUrl: 'not-a-valid-protocol://invalid.domain',
      isPublished: 0,
      version: 1,
    }, db);
  });

  after(() => {
    try {
      db.close();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      if (fs.existsSync(`${testDbPath}-wal`)) {
        fs.unlinkSync(`${testDbPath}-wal`);
      }
      if (fs.existsSync(`${testDbPath}-shm`)) {
        fs.unlinkSync(`${testDbPath}-shm`);
      }
    } catch {
      // Ignore cleanup error on file lock
    }
  });

  describe('GET /dishes', () => {
    it('should return all dishes with boolean isPublished and integer version', async () => {
      const res = await request(app).get('/dishes');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 3);

      const dish1 = res.body.find((d) => d.dishId === '1');
      assert.ok(dish1);
      assert.equal(dish1.dishName, 'Jeera Rice');
      assert.equal(typeof dish1.isPublished, 'boolean');
      assert.equal(dish1.isPublished, true);
      assert.equal(typeof dish1.version, 'number');
      assert.equal(dish1.version, 1);
    });
  });

  describe('PATCH /dishes/:dishId validation (400 Bad Request)', () => {
    it('should reject missing or non-string dishName', async () => {
      const res = await request(app)
        .patch('/dishes/1')
        .send({ dishName: 12345, isPublished: true, expectedVersion: 1 });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Bad Request');
      assert.ok(res.body.details.some((msg) => msg.includes('dishName must be a string')));
    });

    it('should reject non-boolean isPublished', async () => {
      const res = await request(app)
        .patch('/dishes/1')
        .send({ dishName: 'Valid Name', isPublished: 'true', expectedVersion: 1 });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Bad Request');
      assert.ok(res.body.details.some((msg) => msg.includes('isPublished must be a boolean')));
    });

    it('should reject invalid expectedVersion (< 1 or non-integer)', async () => {
      const res = await request(app)
        .patch('/dishes/1')
        .send({ dishName: 'Valid Name', isPublished: true, expectedVersion: 0 });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Bad Request');
      assert.ok(res.body.details.some((msg) => msg.includes('expectedVersion')));
    });

    it('should reject publishing a dish with an empty or whitespace name', async () => {
      const res = await request(app)
        .patch('/dishes/1')
        .send({ dishName: '   ', isPublished: true, expectedVersion: 1 });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Bad Request');
      assert.ok(res.body.details.some((msg) => msg.includes('dishName cannot be empty')));
    });

    it('should reject publishing a dish with an invalid image URL', async () => {
      const res = await request(app)
        .patch('/dishes/bad-img-dish')
        .send({ dishName: 'Trying to Publish Bad URL', isPublished: true, expectedVersion: 1 });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Bad Request');
      assert.ok(res.body.details.some((msg) => msg.includes('imageUrl must be a valid HTTP or HTTPS URL')));
    });

    it('should reject malformed JSON body with 400', async () => {
      const res = await request(app)
        .patch('/dishes/1')
        .set('Content-Type', 'application/json')
        .send('{"dishName": "broken json');

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Bad Request');
      assert.ok(res.body.message.includes('Malformed JSON'));
    });
  });

  describe('PATCH /dishes/:dishId not found (404 Not Found)', () => {
    it('should return 404 when dishId does not exist', async () => {
      const res = await request(app)
        .patch('/dishes/nonexistent-9999')
        .send({ dishName: 'Ghost Dish', isPublished: false, expectedVersion: 1 });

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Not Found');
    });
  });

  describe('PATCH /dishes/:dishId successful update (200 OK)', () => {
    it('should atomically update the dish, increment version, trim name, and return saved dish', async () => {
      const res = await request(app)
        .patch('/dishes/1')
        .send({
          dishName: '   Spiced Jeera Rice   ',
          isPublished: false,
          expectedVersion: 1,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.dishId, '1');
      assert.equal(res.body.dishName, 'Spiced Jeera Rice'); // trimmed
      assert.equal(res.body.isPublished, false);
      assert.equal(res.body.version, 2);

      // Verify DB persistence
      const inDb = dishRepository.getDishById('1', db);
      assert.equal(inDb.dishName, 'Spiced Jeera Rice');
      assert.equal(inDb.isPublished, false);
      assert.equal(inDb.version, 2);
    });
  });

  describe('PATCH /dishes/:dishId conflict protection (409 Conflict)', () => {
    it('should reject update if expectedVersion does not match current version', async () => {
      // Dish 1 is currently at version 2 from previous test
      const res = await request(app)
        .patch('/dishes/1')
        .send({
          dishName: 'Stale Attempt',
          isPublished: true,
          expectedVersion: 1, // Stale version!
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.error, 'Conflict');
      assert.ok(res.body.currentDish);
      assert.equal(res.body.currentDish.dishId, '1');
      assert.equal(res.body.currentDish.version, 2);
      assert.equal(res.body.currentDish.dishName, 'Spiced Jeera Rice');

      // Verify DB was NOT modified
      const inDb = dishRepository.getDishById('1', db);
      assert.equal(inDb.version, 2);
      assert.equal(inDb.dishName, 'Spiced Jeera Rice');
    });
  });

  describe('Atomic Concurrency', () => {
    it('should allow exactly one update among parallel conflicting requests', async () => {
      // Dish 2 is at version 1
      const originalDish = dishRepository.getDishById('2', db);
      assert.equal(originalDish.version, 1);

      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .patch('/dishes/2')
          .send({
            dishName: `Concurrent Update #${i + 1}`,
            isPublished: true,
            expectedVersion: 1,
          })
      );

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 200);
      const conflicts = responses.filter((r) => r.status === 409);

      assert.equal(successes.length, 1, 'Exactly one concurrent request should succeed');
      assert.equal(conflicts.length, 9, 'All other concurrent requests should receive 409 Conflict');

      // Final version in DB must be exactly 2
      const updatedDish = dishRepository.getDishById('2', db);
      assert.equal(updatedDish.version, 2);
    });
  });
});
