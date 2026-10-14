const express = require('express');
const cors = require('cors');
const dishRoutes = require('./routes/dishRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const rawOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const normalizedOrigin = rawOrigin.replace(/\/+$/, '');

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (normalizedOrigin === '*' || origin === normalizedOrigin) {
        return callback(null, true);
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true,
  })
);

app.use(express.json());

app.use('/dishes', dishRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use(errorHandler);

module.exports = app;
