import dotenv from 'dotenv';
dotenv.config();

import { initDb, closeDb } from './db/connection';
import { runMigrations } from './db/migrations';
import { createApp } from './app';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    console.log('Initializing SQLite database and applying migrations...');
    const db = initDb();
    runMigrations(db);
    console.log('Database initialized successfully.');

    const app = createApp();

    const server = app.listen(PORT, HOST, () => {
      console.log(`=========================================`);
      console.log(`Workout Tracker Server is running!`);
      console.log(`Listening on: http://${HOST}:${PORT}`);
      console.log(`Access locally: http://127.0.0.1:${PORT}`);
      if (HOST === '0.0.0.0') {
        console.log(`Network access enabled on port ${PORT}`);
      }
      console.log(`=========================================`);
    });

    const shutdown = () => {
      console.log('\nShutting down Workout Tracker gracefully...');
      server.close(() => {
        closeDb();
        console.log('Server and database closed. Bye!');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
