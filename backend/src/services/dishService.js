const dishRepository = require('../db/dishRepository');

/**
 * Validates whether a string is a valid HTTP or HTTPS URL.
 * Uses the native URL constructor without network requests.
 * @param {string} urlString
 * @returns {boolean}
 */
function isValidHttpUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Retrieve all dishes.
 */
function getDishes(db) {
  return dishRepository.getAllDishes(db);
}

/**
 * Retrieve a dish by ID.
 */
function getDish(dishId, db) {
  const dish = dishRepository.getDishById(dishId, db);
  if (!dish) {
    const error = new Error(`Dish with ID "${dishId}" not found`);
    error.statusCode = 404;
    throw error;
  }
  return dish;
}

/**
 * Validates and atomically updates a dish.
 *
 * @param {string} dishId
 * @param {Object} updateData
 * @param {string} updateData.dishName
 * @param {boolean} updateData.isPublished
 * @param {number} updateData.expectedVersion
 * @param {import('better-sqlite3').Database} [db]
 */
function updateDish(dishId, { dishName, isPublished, expectedVersion }, db) {
  const validationErrors = [];

  if (typeof dishId !== 'string' || dishId.trim() === '') {
    validationErrors.push('dishId must be a non-empty string');
  }

  if (typeof dishName !== 'string') {
    validationErrors.push('dishName must be a string');
  }

  if (typeof isPublished !== 'boolean') {
    validationErrors.push('isPublished must be a boolean');
  }

  if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    validationErrors.push('expectedVersion must be an integer greater than or equal to 1');
  }

  if (validationErrors.length > 0) {
    const err = new Error('Invalid request payload');
    err.statusCode = 400;
    err.details = validationErrors;
    throw err;
  }

  const trimmedName = dishName.trim();

  // Retrieve existing dish to verify existence and check imageUrl if publishing
  const existingDish = dishRepository.getDishById(dishId, db);
  if (!existingDish) {
    const err = new Error(`Dish with ID "${dishId}" not found`);
    err.statusCode = 404;
    throw err;
  }

  // Publishing requirements
  if (isPublished) {
    const publishErrors = [];
    if (trimmedName.length === 0) {
      publishErrors.push('dishName cannot be empty when dish is published');
    }
    if (!isValidHttpUrl(existingDish.imageUrl)) {
      publishErrors.push('imageUrl must be a valid HTTP or HTTPS URL to publish');
    }
    if (publishErrors.length > 0) {
      const err = new Error('Validation failed for publishing dish');
      err.statusCode = 400;
      err.details = publishErrors;
      throw err;
    }
  }

  // Execute atomic update
  const result = dishRepository.updateDishAtomic(
    {
      dishId,
      dishName: trimmedName,
      isPublished,
      expectedVersion,
    },
    db
  );

  if (result.status === 'NOT_FOUND') {
    const err = new Error(`Dish with ID "${dishId}" not found`);
    err.statusCode = 404;
    throw err;
  }

  if (result.status === 'CONFLICT') {
    const err = new Error('Conflict: Dish has been modified by another update');
    err.statusCode = 409;
    err.code = 'CONFLICT';
    err.currentDish = result.currentDish;
    throw err;
  }

  return result.dish;
}

module.exports = {
  isValidHttpUrl,
  getDishes,
  getDish,
  updateDish,
};
