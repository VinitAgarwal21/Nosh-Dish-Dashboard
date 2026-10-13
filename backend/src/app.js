const express = require('express');
const cors = require('cors');
const dishRoutes = require('./routes/dishRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enable CORS for Vite dev server or configured origin
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin === '*' ? true : [allowedOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
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
