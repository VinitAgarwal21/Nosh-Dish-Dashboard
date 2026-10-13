require('dotenv').config();
const app = require('./app');
const { getDb, resolveDbPath } = require('./db/connection');

const PORT = parseInt(process.env.PORT, 10) || 3001;

// Ensure database connection and schema are ready
const dbPath = resolveDbPath();
getDb();

const server = app.listen(PORT, () => {
  console.log(`[Nosh Backend] Server listening on port ${PORT}`);
  console.log(`[Nosh Backend] SQLite database: ${dbPath}`);
  console.log(`[Nosh Backend] Health check: http://localhost:${PORT}/health`);
  console.log(`[Nosh Backend] Dishes API: http://localhost:${PORT}/dishes`);
});

// Handle graceful shutdown
function handleShutdown() {
  console.log('\n[Nosh Backend] Shutting down gracefully...');
  server.close(() => {
    try {
      const db = getDb();
      db.close();
      console.log('[Nosh Backend] SQLite connection closed.');
    } catch {
      // Ignore if already closed
    }
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
