import path from 'path';
import fs from 'fs';
import { getDb, runInTransaction } from '../db/connection';

export interface JsonBackupData {
  version: string;
  exported_at: string;
  app_settings: Array<{ key: string; value: string }>;
  exercises: unknown[];
  workout_templates: unknown[];
  template_exercises: unknown[];
  weekly_schedule: unknown[];
  workout_sessions: unknown[];
  session_exercises: unknown[];
  set_logs: unknown[];
  body_weight_entries: unknown[];
  goals: unknown[];
}

export const backupService = {
  getBackupDir(): string {
    const backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  },

  checkIntegrity(): boolean {
    const db = getDb();
    const result = db.prepare('PRAGMA integrity_check;').all() as Array<{ integrity_check: string }>;
    return result.length > 0 && result[0].integrity_check === 'ok';
  },

  createSqliteBackup(): { filename: string; path: string; created_at: string; size_bytes: number } {
    const db = getDb();
    const backupDir = this.getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.db`;
    const fullPath = path.join(backupDir, filename);

    // Escape backslashes for SQLite VACUUM INTO string literal on Windows
    const sqlitePath = fullPath.replace(/\\/g, '/');

    // Section 9: Use suitable SQLite backup mechanism (VACUUM INTO)
    db.exec(`VACUUM INTO '${sqlitePath}'`);

    const stats = fs.statSync(fullPath);

    return {
      filename,
      path: fullPath,
      created_at: new Date().toISOString(),
      size_bytes: stats.size,
    };
  },

  listBackups(): Array<{ filename: string; created_at: string; size_bytes: number }> {
    const backupDir = this.getBackupDir();
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db') || f.endsWith('.json'));

    return files.map((f) => {
      const p = path.join(backupDir, f);
      const stat = fs.statSync(p);
      return {
        filename: f,
        created_at: stat.mtime.toISOString(),
        size_bytes: stat.size,
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  exportJson(): JsonBackupData {
    const db = getDb();

    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      app_settings: db.prepare('SELECT * FROM app_settings').all() as Array<{ key: string; value: string }>,
      exercises: db.prepare('SELECT * FROM exercises').all(),
      workout_templates: db.prepare('SELECT * FROM workout_templates').all(),
      template_exercises: db.prepare('SELECT * FROM template_exercises').all(),
      weekly_schedule: db.prepare('SELECT * FROM weekly_schedule').all(),
      workout_sessions: db.prepare('SELECT * FROM workout_sessions').all(),
      session_exercises: db.prepare('SELECT * FROM session_exercises').all(),
      set_logs: db.prepare('SELECT * FROM set_logs').all(),
      body_weight_entries: db.prepare('SELECT * FROM body_weight_entries').all(),
      goals: db.prepare('SELECT * FROM goals').all(),
    };
  },

  restoreJson(backup: JsonBackupData): { restored_at: string; pre_restore_backup: string } {
    if (!backup || backup.version !== '1.0') {
      throw new Error('Invalid backup format or unsupported backup version.');
    }

    if (!Array.isArray(backup.exercises) || !Array.isArray(backup.workout_sessions)) {
      throw new Error('Invalid backup payload: missing core collections.');
    }

    // Section 9: "Never overwrite the existing database silently during restore... create a recoverable backup first."
    const autoBackup = this.createSqliteBackup();

    runInTransaction(() => {
      const db = getDb();

      // Temporarily disable foreign keys for bulk restoration order safety
      db.exec('PRAGMA foreign_keys = OFF;');

      try {
        // Clear existing personal tables (preserve app_user and auth_sessions so user is not locked out)
        db.exec(`
          DELETE FROM set_logs;
          DELETE FROM session_exercises;
          DELETE FROM workout_sessions;
          DELETE FROM template_exercises;
          DELETE FROM workout_templates;
          DELETE FROM weekly_schedule;
          DELETE FROM body_weight_entries;
          DELETE FROM goals;
          DELETE FROM exercises;
          DELETE FROM app_settings;
        `);

        // Restore app_settings
        if (Array.isArray(backup.app_settings)) {
          const insertStmt = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)');
          for (const s of backup.app_settings as Array<{ key: string; value: string }>) {
            insertStmt.run(s.key, s.value);
          }
        }

        // Restore exercises
        if (Array.isArray(backup.exercises)) {
          const insertStmt = db.prepare(`
            INSERT INTO exercises (id, name, category, tracking_type, load_mode, load_basis, instructions, archived_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const ex of backup.exercises as any[]) {
            insertStmt.run(
              ex.id, ex.name, ex.category, ex.tracking_type, ex.load_mode,
              ex.load_basis, ex.instructions, ex.archived_at, ex.created_at, ex.updated_at
            );
          }
        }

        // Restore workout_templates
        if (Array.isArray(backup.workout_templates)) {
          const insertStmt = db.prepare(`
            INSERT INTO workout_templates (id, name, description, archived_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const t of backup.workout_templates as any[]) {
            insertStmt.run(t.id, t.name, t.description, t.archived_at, t.created_at, t.updated_at);
          }
        }

        // Restore template_exercises
        if (Array.isArray(backup.template_exercises)) {
          const insertStmt = db.prepare(`
            INSERT INTO template_exercises (
              id, template_id, exercise_id, position, target_sets, target_reps_min,
              target_reps_max, target_duration_seconds, target_load_kg, rest_seconds, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const te of backup.template_exercises as any[]) {
            insertStmt.run(
              te.id, te.template_id, te.exercise_id, te.position, te.target_sets,
              te.target_reps_min, te.target_reps_max, te.target_duration_seconds,
              te.target_load_kg, te.rest_seconds ?? 60, te.notes
            );
          }
        }

        // Restore weekly_schedule
        if (Array.isArray(backup.weekly_schedule)) {
          const insertStmt = db.prepare(`
            INSERT INTO weekly_schedule (id, weekday, template_id, position, active)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const ws of backup.weekly_schedule as any[]) {
            insertStmt.run(ws.id, ws.weekday, ws.template_id, ws.position, ws.active);
          }
        }

        // Restore workout_sessions
        if (Array.isArray(backup.workout_sessions)) {
          const insertStmt = db.prepare(`
            INSERT INTO workout_sessions (
              id, template_id, template_name_snapshot, status, started_at, finished_at, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const s of backup.workout_sessions as any[]) {
            insertStmt.run(
              s.id, s.template_id, s.template_name_snapshot, s.status,
              s.started_at, s.finished_at, s.notes, s.created_at
            );
          }
        }

        // Restore session_exercises
        if (Array.isArray(backup.session_exercises)) {
          const insertStmt = db.prepare(`
            INSERT INTO session_exercises (
              id, session_id, exercise_id, exercise_name_snapshot,
              tracking_type_snapshot, load_mode_snapshot, load_basis_snapshot,
              position, target_sets, rest_seconds, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const se of backup.session_exercises as any[]) {
            insertStmt.run(
              se.id, se.session_id, se.exercise_id, se.exercise_name_snapshot,
              se.tracking_type_snapshot, se.load_mode_snapshot, se.load_basis_snapshot,
              se.position, se.target_sets, se.rest_seconds ?? 60, se.notes
            );
          }
        }

        // Restore set_logs
        if (Array.isArray(backup.set_logs)) {
          const insertStmt = db.prepare(`
            INSERT INTO set_logs (
              id, session_exercise_id, set_number, target_reps_min, target_reps_max,
              target_duration_seconds, target_load_kg, actual_reps, actual_duration_seconds,
              actual_load_kg, status, notes, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const sl of backup.set_logs as any[]) {
            insertStmt.run(
              sl.id, sl.session_exercise_id, sl.set_number, sl.target_reps_min,
              sl.target_reps_max, sl.target_duration_seconds, sl.target_load_kg,
              sl.actual_reps, sl.actual_duration_seconds, sl.actual_load_kg,
              sl.status, sl.notes, sl.completed_at
            );
          }
        }

        // Restore body_weight_entries
        if (Array.isArray(backup.body_weight_entries)) {
          const insertStmt = db.prepare(`
            INSERT INTO body_weight_entries (id, measured_at, weight_kg, notes, created_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const bw of backup.body_weight_entries as any[]) {
            insertStmt.run(bw.id, bw.measured_at, bw.weight_kg, bw.notes, bw.created_at);
          }
        }

        // Restore goals
        if (Array.isArray(backup.goals)) {
          const insertStmt = db.prepare(`
            INSERT INTO goals (
              id, title, goal_type, exercise_id, baseline_value, target_value,
              start_date, deadline, status, notes, created_at, achieved_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const g of backup.goals as any[]) {
            insertStmt.run(
              g.id, g.title, g.goal_type, g.exercise_id, g.baseline_value,
              g.target_value, g.start_date, g.deadline, g.status, g.notes,
              g.created_at, g.achieved_at
            );
          }
        }
      } finally {
        db.exec('PRAGMA foreign_keys = ON;');
      }
    });

    return {
      restored_at: new Date().toISOString(),
      pre_restore_backup: autoBackup.filename,
    };
  },
};
