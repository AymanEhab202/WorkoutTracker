import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { Exercise, TrackingType, LoadMode, LoadBasis } from '@shared/types';

export interface CreateExerciseDto {
  name: string;
  category: string;
  tracking_type: TrackingType;
  load_mode: LoadMode;
  load_basis: LoadBasis;
  instructions?: string | null;
}

export const exerciseService = {
  list(options?: { includeArchived?: boolean; category?: string }): Exercise[] {
    const db = getDb();
    let sql = 'SELECT * FROM exercises WHERE 1=1';
    const params: unknown[] = [];

    if (!options?.includeArchived) {
      sql += ' AND archived_at IS NULL';
    }

    if (options?.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY name ASC';

    return db.prepare(sql).all(...params) as Exercise[];
  },

  getById(id: string): Exercise | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as Exercise | undefined;
    return row || null;
  },

  create(data: CreateExerciseDto): Exercise {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO exercises (id, name, category, tracking_type, load_mode, load_basis, instructions, archived_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      data.name.trim(),
      data.category.trim(),
      data.tracking_type,
      data.load_mode,
      data.load_basis,
      data.instructions ? data.instructions.trim() : null,
      now,
      now
    );

    return this.getById(id)!;
  },

  update(id: string, data: Partial<CreateExerciseDto>): Exercise {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Exercise with ID ${id} not found`);
    }

    const db = getDb();
    const now = new Date().toISOString();
    const updatedName = data.name !== undefined ? data.name.trim() : existing.name;
    const updatedCategory = data.category !== undefined ? data.category.trim() : existing.category;
    const updatedTracking = data.tracking_type !== undefined ? data.tracking_type : existing.tracking_type;
    const updatedLoadMode = data.load_mode !== undefined ? data.load_mode : existing.load_mode;
    const updatedLoadBasis = data.load_basis !== undefined ? data.load_basis : existing.load_basis;
    const updatedInstructions = data.instructions !== undefined ? (data.instructions ? data.instructions.trim() : null) : existing.instructions;

    db.prepare(`
      UPDATE exercises
      SET name = ?, category = ?, tracking_type = ?, load_mode = ?, load_basis = ?, instructions = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updatedName,
      updatedCategory,
      updatedTracking,
      updatedLoadMode,
      updatedLoadBasis,
      updatedInstructions,
      now,
      id
    );

    return this.getById(id)!;
  },

  archive(id: string): Exercise {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Exercise with ID ${id} not found`);
    }

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE exercises SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
    return this.getById(id)!;
  },

  unarchive(id: string): Exercise {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Exercise with ID ${id} not found`);
    }

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE exercises SET archived_at = NULL, updated_at = ? WHERE id = ?').run(now, id);
    return this.getById(id)!;
  },

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Exercise with ID ${id} not found`);
    }

    const db = getDb();
    // Check if referenced in historical workout sessions
    const sessionCount = db.prepare('SELECT count(*) as count FROM session_exercises WHERE exercise_id = ?').get(id) as { count: number };
    const templateCount = db.prepare('SELECT count(*) as count FROM template_exercises WHERE exercise_id = ?').get(id) as { count: number };
    const goalCount = db.prepare('SELECT count(*) as count FROM goals WHERE exercise_id = ?').get(id) as { count: number };

    if (sessionCount.count > 0 || templateCount.count > 0 || goalCount.count > 0) {
      throw new Error('Cannot permanently delete exercise because historical sessions, templates, or goals depend on it. Please archive it instead.');
    }

    db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
    return true;
  },

  getCategories(): string[] {
    const db = getDb();
    const rows = db.prepare('SELECT DISTINCT category FROM exercises ORDER BY category ASC').all() as { category: string }[];
    return rows.map((r) => r.category);
  },
};
