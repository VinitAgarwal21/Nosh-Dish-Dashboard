const express = require('express');
const router = express.Router();
const dishController = require('../controllers/dishController');

router.get('/', dishController.getAllDishes);
router.get('/:dishId', dishController.getDishById);
router.patch('/:dishId', dishController.updateDish);

// Catch-all handler for unknown routes under /dishes
router.all('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

module.exports = router;
