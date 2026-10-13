const express = require('express');
const router = express.Router();
const dishController = require('../controllers/dishController');

router.get('/', dishController.getAllDishes);
router.get('/:dishId', dishController.getDishById);
router.patch('/:dishId', dishController.updateDish);

module.exports = router;
