const dishService = require('../services/dishService');

/**
 * GET /dishes
 * Fetches all dishes.
 */
function getAllDishes(req, res, next) {
  try {
    const dishes = dishService.getDishes();
    res.status(200).json(dishes);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dishes/:dishId
 * Fetches a single dish by dishId.
 */
function getDishById(req, res, next) {
  try {
    const { dishId } = req.params;
    const dish = dishService.getDish(dishId);
    res.status(200).json(dish);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /dishes/:dishId
 * Updates dishName and isPublished with optimistic locking check on expectedVersion.
 */
function updateDish(req, res, next) {
  try {
    const { dishId } = req.params;

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      const err = new Error('Request body must be a valid JSON object');
      err.statusCode = 400;
      err.details = ['Request body must be a valid JSON object'];
      throw err;
    }

    const { dishName, isPublished, expectedVersion, imageUrl } = req.body;

    // URL checker at patch route controller: validate provided imageUrl or existing dish imageUrl
    if (imageUrl !== undefined && !dishService.isValidHttpUrl(imageUrl)) {
      const err = new Error('the imageUrl is not valid cannot send request');
      err.statusCode = 400;
      err.details = ['the imageUrl is not valid cannot send request'];
      throw err;
    }

    // Check target dish imageUrl
    const existingDish = dishService.getDish(dishId);
    const targetUrl = imageUrl !== undefined ? imageUrl : existingDish.imageUrl;
    if (!dishService.isValidHttpUrl(targetUrl)) {
      const err = new Error('the imageUrl is not valid cannot send request');
      err.statusCode = 400;
      err.details = ['the imageUrl is not valid cannot send request'];
      throw err;
    }

    const updatedDish = dishService.updateDish(dishId, {
      dishName,
      isPublished,
      expectedVersion,
    });

    res.status(200).json(updatedDish);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllDishes,
  getDishById,
  updateDish,
};
