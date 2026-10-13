import { randomUUID } from 'crypto';

// Safely load Node.js built-in node:sqlite
type DatabaseSync = any;

interface Migration {
  name: string;
  up: (db: DatabaseSync) => void;
}

export const migrations: Migration[] = [
  {
    name: '001_initial_schema',
    up: (db: DatabaseSync) => {
      db.exec(`
        -- App Owner & Auth
        CREATE TABLE IF NOT EXISTS app_user (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

        -- App Settings
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- Exercises
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          tracking_type TEXT NOT NULL,
          load_mode TEXT NOT NULL,
          load_basis TEXT NOT NULL,
          instructions TEXT,
          archived_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
        CREATE INDEX IF NOT EXISTS idx_exercises_archived ON exercises(archived_at);

        -- Workout Templates
        CREATE TABLE IF NOT EXISTS workout_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          archived_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workout_templates_archived ON workout_templates(archived_at);

        -- Template Exercises
        CREATE TABLE IF NOT EXISTS template_exercises (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
          exercise_id TEXT NOT NULL REFERENCES exercises(id),
          position INTEGER NOT NULL,
          target_sets INTEGER NOT NULL,
          target_reps_min INTEGER,
          target_reps_max INTEGER,
          target_duration_seconds INTEGER,
          target_load_kg REAL,
          rest_seconds INTEGER NOT NULL DEFAULT 60,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(template_id);
        CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise ON template_exercises(exercise_id);

        -- Weekly Schedule
        CREATE TABLE IF NOT EXISTS weekly_schedule (
          id TEXT PRIMARY KEY,
          weekday INTEGER NOT NULL,
          template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
          position INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_weekly_schedule_weekday ON weekly_schedule(weekday);

        -- Workout Sessions
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY,
          template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
          template_name_snapshot TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_started_at ON workout_sessions(started_at);

        -- Session Exercises (Snapshot of exercise config during this session)
        CREATE TABLE IF NOT EXISTS session_exercises (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
          exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
          exercise_name_snapshot TEXT NOT NULL,
          tracking_type_snapshot TEXT NOT NULL,
          load_mode_snapshot TEXT NOT NULL,
          load_basis_snapshot TEXT NOT NULL,
          position INTEGER NOT NULL,
          target_sets INTEGER NOT NULL,
          rest_seconds INTEGER NOT NULL DEFAULT 60,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise ON session_exercises(exercise_id);

        -- Set Logs
        CREATE TABLE IF NOT EXISTS set_logs (
          id TEXT PRIMARY KEY,
          session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          target_reps_min INTEGER,
          target_reps_max INTEGER,
          target_duration_seconds INTEGER,
          target_load_kg REAL,
          actual_reps INTEGER,
          actual_duration_seconds INTEGER,
          actual_load_kg REAL,
          status TEXT NOT NULL,
          notes TEXT,
          completed_at TEXT,
          UNIQUE(session_exercise_id, set_number)
        );
        CREATE INDEX IF NOT EXISTS idx_set_logs_session_exercise ON set_logs(session_exercise_id);
        CREATE INDEX IF NOT EXISTS idx_set_logs_status ON set_logs(status);

        -- Body Weight Entries
        CREATE TABLE IF NOT EXISTS body_weight_entries (
          id TEXT PRIMARY KEY,
          measured_at TEXT NOT NULL,
          weight_kg REAL NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_body_weight_measured_at ON body_weight_entries(measured_at);

        -- Goals
        CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          goal_type TEXT NOT NULL,
          exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
          baseline_value REAL NOT NULL,
          target_value REAL NOT NULL,
          start_date TEXT NOT NULL,
          deadline TEXT,
          status TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          achieved_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(goal_type);
        CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
        CREATE INDEX IF NOT EXISTS idx_goals_exercise ON goals(exercise_id);
      `);
    },
  },
  {
    name: '002_seed_defaults',
    up: (db: DatabaseSync) => {
      // Seed default weekly frequency setting
      db.prepare(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('weekly_target_frequency', '4')
      `).run();

      // Seed weekly schedule entries for days 0..6 (0=Sunday, 1=Monday, ..., 6=Saturday)
      const existingSchedule = db.prepare('SELECT count(*) as count FROM weekly_schedule').get() as { count: number };
      if (existingSchedule.count === 0) {
        const insertSchedule = db.prepare(`
          INSERT INTO weekly_schedule (id, weekday, template_id, position, active)
          VALUES (?, ?, NULL, 0, 1)
        `);
        for (let i = 0; i < 7; i++) {
          insertSchedule.run(randomUUID(), i);
        }
      }

      // Seed initial exercise library if empty
      const existingExercises = db.prepare('SELECT count(*) as count FROM exercises').get() as { count: number };
      if (existingExercises.count === 0) {
        const now = new Date().toISOString();
        const defaultExercises = [
          { name: 'Push-ups', category: 'Chest', tracking_type: 'reps', load_mode: 'none', load_basis: 'total', instructions: 'Standard push-ups keeping core tight and elbows at 45 degrees.' },
          { name: 'Pull-ups', category: 'Back', tracking_type: 'reps', load_mode: 'optional', load_basis: 'total', instructions: 'Full range of motion pull-ups with overhand grip.' },
          { name: 'Bodyweight Squats', category: 'Legs', tracking_type: 'reps', load_mode: 'optional', load_basis: 'total', instructions: 'Squat to parallel or below with chest up.' },
          { name: 'Plank', category: 'Core', tracking_type: 'duration', load_mode: 'none', load_basis: 'total', instructions: 'Hold forearm plank maintaining a straight line from head to heels.' },
          { name: 'Dumbbell Bench Press', category: 'Chest', tracking_type: 'reps', load_mode: 'required', load_basis: 'per_hand', instructions: 'Flat dumbbell bench press focusing on chest contraction.' },
          { name: 'Dumbbell Shoulder Press', category: 'Shoulders', tracking_type: 'reps', load_mode: 'required', load_basis: 'per_hand', instructions: 'Overhead dumbbell press seated or standing.' },
          { name: 'Dumbbell Bicep Curls', category: 'Arms', tracking_type: 'reps', load_mode: 'required', load_basis: 'per_hand', instructions: 'Strict bicep curls rotating wrists at the top.' },
          { name: 'Romanian Deadlift', category: 'Legs', tracking_type: 'reps', load_mode: 'required', load_basis: 'total', instructions: 'Hinge at the hips with neutral spine to work hamstrings and glutes.' },
          { name: 'Hanging Knee Raises', category: 'Core', tracking_type: 'reps', load_mode: 'none', load_basis: 'total', instructions: 'Hang from pull-up bar and raise knees toward chest with control.' },
          { name: 'Jump Rope', category: 'Cardio', tracking_type: 'duration', load_mode: 'none', load_basis: 'total', instructions: 'Continuous rhythm jump rope session.' },
        ];

        const insertEx = db.prepare(`
          INSERT INTO exercises (id, name, category, tracking_type, load_mode, load_basis, instructions, archived_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        `);

        for (const ex of defaultExercises) {
          insertEx.run(
            randomUUID(),
            ex.name,
            ex.category,
            ex.tracking_type,
            ex.load_mode,
            ex.load_basis,
            ex.instructions,
            now,
            now
          );
        }
      }
    },
  },
];

export function runMigrations(db: DatabaseSync): void {
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  const appliedSet = new Set(appliedRows.map((r) => r.name));

  for (const migration of migrations) {
    if (!appliedSet.has(migration.name)) {
      db.exec('BEGIN TRANSACTION;');
      try {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
          migration.name,
          new Date().toISOString()
        );
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw new Error(`Migration ${migration.name} failed: ${(error as Error).message}`);
      }
    }
  }
}
