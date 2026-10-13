import path from 'path';
import fs from 'fs';

// Safely load Node.js built-in node:sqlite
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = eval('require')('node:sqlite');
type DatabaseSync = any;

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string = '';

export function getDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }
  // Default to data/workout_tracker.db in project root
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'workout_tracker.db');
}

export function initDb(dbPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  currentDbPath = dbPath || getDbPath();
  const dir = path.dirname(currentDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new DatabaseSync(currentDbPath);

  // Enable foreign keys and WAL mode for reliability and concurrency
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');

  return dbInstance;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Execute a callback within an atomic transaction.
 * Rolls back automatically if callback throws an error.
 */
export function runInTransaction<T>(callback: () => T): T {
  const db = getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = callback();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}
