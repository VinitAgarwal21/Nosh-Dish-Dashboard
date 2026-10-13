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
    const { dishName, isPublished, expectedVersion } = req.body;

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
