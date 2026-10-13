import { randomUUID } from 'crypto';
import { getDb, runInTransaction } from '../db/connection';
import { WorkoutTemplate, TemplateExercise } from '@shared/types';

export interface TemplateExerciseInput {
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_duration_seconds?: number | null;
  target_load_kg?: number | null;
  rest_seconds?: number;
  notes?: string | null;
}

export interface CreateTemplateDto {
  name: string;
  description?: string | null;
  exercises?: TemplateExerciseInput[];
}

export const templateService = {
  list(options?: { includeArchived?: boolean }): WorkoutTemplate[] {
    const db = getDb();
    let sql = 'SELECT * FROM workout_templates WHERE 1=1';
    if (!options?.includeArchived) {
      sql += ' AND archived_at IS NULL';
    }
    sql += ' ORDER BY name ASC';

    const templates = db.prepare(sql).all() as WorkoutTemplate[];

    // Fetch exercises for each template
    const templateExercisesStmt = db.prepare(`
      SELECT te.*, e.name as exercise_name, e.tracking_type, e.load_mode, e.load_basis
      FROM template_exercises te
      JOIN exercises e ON te.exercise_id = e.id
      WHERE te.template_id = ?
      ORDER BY te.position ASC
    `);

    for (const t of templates) {
      t.exercises = templateExercisesStmt.all(t.id) as TemplateExercise[];
    }

    return templates;
  },

  getById(id: string): WorkoutTemplate | null {
    const db = getDb();
    const template = db.prepare('SELECT * FROM workout_templates WHERE id = ?').get(id) as WorkoutTemplate | undefined;
    if (!template) return null;

    const exercises = db.prepare(`
      SELECT te.*, e.name as exercise_name, e.tracking_type, e.load_mode, e.load_basis
      FROM template_exercises te
      JOIN exercises e ON te.exercise_id = e.id
      WHERE te.template_id = ?
      ORDER BY te.position ASC
    `).all(id) as TemplateExercise[];

    template.exercises = exercises;
    return template;
  },

  create(data: CreateTemplateDto): WorkoutTemplate {
    return runInTransaction(() => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO workout_templates (id, name, description, archived_at, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?)
      `).run(id, data.name.trim(), data.description ? data.description.trim() : null, now, now);

      if (data.exercises && data.exercises.length > 0) {
        const insertEx = db.prepare(`
          INSERT INTO template_exercises (
            id, template_id, exercise_id, position, target_sets,
            target_reps_min, target_reps_max, target_duration_seconds,
            target_load_kg, rest_seconds, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        data.exercises.forEach((ex, idx) => {
          insertEx.run(
            randomUUID(),
            id,
            ex.exercise_id,
            ex.position !== undefined ? ex.position : idx,
            ex.target_sets,
            ex.target_reps_min ?? null,
            ex.target_reps_max ?? null,
            ex.target_duration_seconds ?? null,
            ex.target_load_kg ?? null,
            ex.rest_seconds ?? 60,
            ex.notes ?? null
          );
        });
      }

      return this.getById(id)!;
    });
  },

  update(id: string, data: Partial<CreateTemplateDto>): WorkoutTemplate {
    return runInTransaction(() => {
      const existing = this.getById(id);
      if (!existing) {
        throw new Error(`Workout template with ID ${id} not found`);
      }

      const db = getDb();
      const now = new Date().toISOString();
      const updatedName = data.name !== undefined ? data.name.trim() : existing.name;
      const updatedDesc = data.description !== undefined ? (data.description ? data.description.trim() : null) : existing.description;

      db.prepare(`
        UPDATE workout_templates
        SET name = ?, description = ?, updated_at = ?
        WHERE id = ?
      `).run(updatedName, updatedDesc, now, id);

      // If exercises array is provided, replace template exercises
      if (data.exercises !== undefined) {
        db.prepare('DELETE FROM template_exercises WHERE template_id = ?').run(id);

        const insertEx = db.prepare(`
          INSERT INTO template_exercises (
            id, template_id, exercise_id, position, target_sets,
            target_reps_min, target_reps_max, target_duration_seconds,
            target_load_kg, rest_seconds, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        data.exercises.forEach((ex, idx) => {
          insertEx.run(
            randomUUID(),
            id,
            ex.exercise_id,
            ex.position !== undefined ? ex.position : idx,
            ex.target_sets,
            ex.target_reps_min ?? null,
            ex.target_reps_max ?? null,
            ex.target_duration_seconds ?? null,
            ex.target_load_kg ?? null,
            ex.rest_seconds ?? 60,
            ex.notes ?? null
          );
        });
      }

      return this.getById(id)!;
    });
  },

  archive(id: string): WorkoutTemplate {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Workout template with ID ${id} not found`);
    }

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE workout_templates SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
    return this.getById(id)!;
  },

  unarchive(id: string): WorkoutTemplate {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Workout template with ID ${id} not found`);
    }

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE workout_templates SET archived_at = NULL, updated_at = ? WHERE id = ?').run(now, id);
    return this.getById(id)!;
  },

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Workout template with ID ${id} not found`);
    }

    const db = getDb();
    // Check if referenced in historical workout sessions
    const sessionCount = db.prepare('SELECT count(*) as count FROM workout_sessions WHERE template_id = ?').get(id) as { count: number };
    if (sessionCount.count > 0) {
      throw new Error('Cannot delete template because historical sessions reference it. Please archive it instead.');
    }

    runInTransaction(() => {
      db.prepare('DELETE FROM template_exercises WHERE template_id = ?').run(id);
      db.prepare('UPDATE weekly_schedule SET template_id = NULL WHERE template_id = ?').run(id);
      db.prepare('DELETE FROM workout_templates WHERE id = ?').run(id);
    });

    return true;
  },
};
