const express = require('express');
const cors = require('cors');
const dishRoutes = require('./routes/dishRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enable CORS for Vite dev server or configured origin
const configuredOrigin = (process.env.CORS_ORIGIN || '').replace(/\/+$/, '');

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as curl, postman, server-to-server)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        configuredOrigin === '*' ||
        cleanOrigin === configuredOrigin ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly fallback
    },
    methods: ['GET', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true,
  })
);

// Parse JSON request body
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dishes API routes
app.use('/dishes', dishRoutes);

// Catch-all for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Central error handler
app.use(errorHandler);

module.exports = app;
