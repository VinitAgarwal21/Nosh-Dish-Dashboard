/**
 * Central Error Handling Middleware for Express
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Handle JSON parse error from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed JSON payload in request body',
    });
  }

  // Handle client validation error
  if (err.statusCode === 400) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
      details: err.details || [],
    });
  }

  // Handle not found error
  if (err.statusCode === 404) {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message || 'Resource not found',
    });
  }

  // Handle optimistic lock conflict
  if (err.statusCode === 409) {
    return res.status(409).json({
      error: 'Conflict',
      message: err.message || 'The dish was updated by another user or session',
      currentDish: err.currentDish || null,
    });
  }

  // Unexpected internal server errors
  console.error('[InternalServerError]', {
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
  });
}

module.exports = errorHandler;
