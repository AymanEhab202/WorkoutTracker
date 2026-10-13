import { randomUUID } from 'crypto';
import { getDb, runInTransaction } from '../db/connection';
import {
  WorkoutSession,
  SessionExercise,
  SetLog,
  SessionStatus,
  SetStatus,
  TrackingType,
  LoadMode,
  LoadBasis,
} from '@shared/types';
import { templateService } from './templateService';
import { exerciseService } from './exerciseService';

export interface StartSessionOptions {
  template_id?: string | null;
  name?: string;
}

export interface UpdateSetDto {
  status: SetStatus;
  actual_reps?: number | null;
  actual_duration_seconds?: number | null;
  actual_load_kg?: number | null;
  notes?: string | null;
}

export interface AddExtraSetDto {
  session_exercise_id: string;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_duration_seconds?: number | null;
  target_load_kg?: number | null;
}

export interface AddSessionExerciseDto {
  exercise_id: string;
  target_sets: number;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_duration_seconds?: number | null;
  target_load_kg?: number | null;
  rest_seconds?: number;
}

export const sessionService = {
  getActiveSession(): WorkoutSession | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM workout_sessions
      WHERE status = 'in_progress'
      ORDER BY started_at DESC
      LIMIT 1
    `).get() as WorkoutSession | undefined;

    if (!row) return null;
    return this.getSessionById(row.id);
  },

  getSessionById(id: string): WorkoutSession | null {
    const db = getDb();
    const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(id) as WorkoutSession | undefined;
    if (!session) return null;

    const sessionExercises = db.prepare(`
      SELECT * FROM session_exercises
      WHERE session_id = ?
      ORDER BY position ASC
    `).all(id) as SessionExercise[];

    const setLogsStmt = db.prepare(`
      SELECT * FROM set_logs
      WHERE session_exercise_id = ?
      ORDER BY set_number ASC
    `);

    let completedSets = 0;
    let plannedSets = 0;

    for (const se of sessionExercises) {
      se.sets = setLogsStmt.all(se.id) as SetLog[];
      for (const s of se.sets) {
        plannedSets++;
        if (s.status === 'completed') {
          completedSets++;
        }
      }
    }

    session.exercises = sessionExercises;
    session.planned_sets_count = plannedSets;
    session.completed_sets_count = completedSets;

    if (session.started_at && session.finished_at) {
      const start = new Date(session.started_at).getTime();
      const end = new Date(session.finished_at).getTime();
      session.duration_seconds = Math.max(0, Math.round((end - start) / 1000));
    } else if (session.started_at && session.status === 'in_progress') {
      const start = new Date(session.started_at).getTime();
      const now = Date.now();
      session.duration_seconds = Math.max(0, Math.round((now - start) / 1000));
    }

    return session;
  },

  startSession(options?: StartSessionOptions): WorkoutSession {
    // If an active session is already running, return it (idempotency against rapid clicks)
    const existingActive = this.getActiveSession();
    if (existingActive) {
      return existingActive;
    }

    return runInTransaction(() => {
      const db = getDb();
      const sessionId = randomUUID();
      const now = new Date().toISOString();

      let templateName = options?.name?.trim() || 'Ad-hoc Workout';
      let templateExercisesToCopy: Array<{
        exercise_id: string;
        exercise_name: string;
        tracking_type: TrackingType;
        load_mode: LoadMode;
        load_basis: LoadBasis;
        position: number;
        target_sets: number;
        target_reps_min?: number | null;
        target_reps_max?: number | null;
        target_duration_seconds?: number | null;
        target_load_kg?: number | null;
        rest_seconds: number;
        notes?: string | null;
      }> = [];

      if (options?.template_id) {
        const template = templateService.getById(options.template_id);
        if (template) {
          templateName = template.name;
          if (template.exercises && template.exercises.length > 0) {
            templateExercisesToCopy = template.exercises.map((te) => ({
              exercise_id: te.exercise_id,
              exercise_name: te.exercise_name || 'Exercise',
              tracking_type: te.tracking_type || 'reps',
              load_mode: te.load_mode || 'none',
              load_basis: te.load_basis || 'total',
              position: te.position,
              target_sets: te.target_sets,
              target_reps_min: te.target_reps_min,
              target_reps_max: te.target_reps_max,
              target_duration_seconds: te.target_duration_seconds,
              target_load_kg: te.target_load_kg,
              rest_seconds: te.rest_seconds,
              notes: te.notes,
            }));
          }
        }
      }

      // 1. Create workout session record
      db.prepare(`
        INSERT INTO workout_sessions (
          id, template_id, template_name_snapshot, status, started_at, finished_at, notes, created_at
        ) VALUES (?, ?, ?, 'in_progress', ?, NULL, NULL, ?)
      `).run(sessionId, options?.template_id || null, templateName, now, now);

      // 2. Snapshot exercises and generate pending sets
      const insertSessionEx = db.prepare(`
        INSERT INTO session_exercises (
          id, session_id, exercise_id, exercise_name_snapshot,
          tracking_type_snapshot, load_mode_snapshot, load_basis_snapshot,
          position, target_sets, rest_seconds, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertSetLog = db.prepare(`
        INSERT INTO set_logs (
          id, session_exercise_id, set_number,
          target_reps_min, target_reps_max, target_duration_seconds, target_load_kg,
          actual_reps, actual_duration_seconds, actual_load_kg,
          status, notes, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'pending', NULL, NULL)
      `);

      for (const ex of templateExercisesToCopy) {
        const sessionExId = randomUUID();
        insertSessionEx.run(
          sessionExId,
          sessionId,
          ex.exercise_id,
          ex.exercise_name,
          ex.tracking_type,
          ex.load_mode,
          ex.load_basis,
          ex.position,
          ex.target_sets,
          ex.rest_seconds,
          ex.notes || null
        );

        for (let setNum = 1; setNum <= ex.target_sets; setNum++) {
          insertSetLog.run(
            randomUUID(),
            sessionExId,
            setNum,
            ex.target_reps_min ?? null,
            ex.target_reps_max ?? null,
            ex.target_duration_seconds ?? null,
            ex.target_load_kg ?? null
          );
        }
      }

      return this.getSessionById(sessionId)!;
    });
  },

  updateSet(setId: string, data: UpdateSetDto): SetLog {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM set_logs WHERE id = ?').get(setId) as SetLog | undefined;
    if (!existing) {
      throw new Error(`Set log with ID ${setId} not found`);
    }

    const now = new Date().toISOString();
    const completedAt = data.status === 'completed' ? (existing.completed_at || now) : null;

    db.prepare(`
      UPDATE set_logs
      SET status = ?,
          actual_reps = ?,
          actual_duration_seconds = ?,
          actual_load_kg = ?,
          notes = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      data.status,
      data.actual_reps !== undefined ? data.actual_reps : existing.actual_reps,
      data.actual_duration_seconds !== undefined ? data.actual_duration_seconds : existing.actual_duration_seconds,
      data.actual_load_kg !== undefined ? data.actual_load_kg : existing.actual_load_kg,
      data.notes !== undefined ? data.notes : existing.notes,
      completedAt,
      setId
    );

    return db.prepare('SELECT * FROM set_logs WHERE id = ?').get(setId) as SetLog;
  },

  addExtraSet(data: AddExtraSetDto): SetLog {
    return runInTransaction(() => {
      const db = getDb();
      const sessionExercise = db.prepare('SELECT * FROM session_exercises WHERE id = ?').get(data.session_exercise_id) as SessionExercise | undefined;
      if (!sessionExercise) {
        throw new Error(`Session exercise with ID ${data.session_exercise_id} not found`);
      }

      const maxSetRow = db.prepare(`
        SELECT COALESCE(MAX(set_number), 0) as max_set
        FROM set_logs
        WHERE session_exercise_id = ?
      `).get(data.session_exercise_id) as { max_set: number };

      const nextSetNumber = maxSetRow.max_set + 1;
      const newSetId = randomUUID();

      // Find targets from previous set if not provided
      let targetMin = data.target_reps_min;
      let targetMax = data.target_reps_max;
      let targetDuration = data.target_duration_seconds;
      let targetLoad = data.target_load_kg;

      if (targetMin === undefined && targetMax === undefined && targetDuration === undefined && targetLoad === undefined) {
        const lastSet = db.prepare(`
          SELECT target_reps_min, target_reps_max, target_duration_seconds, target_load_kg
          FROM set_logs
          WHERE session_exercise_id = ?
          ORDER BY set_number DESC LIMIT 1
        `).get(data.session_exercise_id) as SetLog | undefined;

        if (lastSet) {
          targetMin = lastSet.target_reps_min;
          targetMax = lastSet.target_reps_max;
          targetDuration = lastSet.target_duration_seconds;
          targetLoad = lastSet.target_load_kg;
        }
      }

      db.prepare(`
        INSERT INTO set_logs (
          id, session_exercise_id, set_number,
          target_reps_min, target_reps_max, target_duration_seconds, target_load_kg,
          actual_reps, actual_duration_seconds, actual_load_kg,
          status, notes, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'pending', NULL, NULL)
      `).run(
        newSetId,
        data.session_exercise_id,
        nextSetNumber,
        targetMin ?? null,
        targetMax ?? null,
        targetDuration ?? null,
        targetLoad ?? null
      );

      // Update target sets count on session exercise
      db.prepare(`
        UPDATE session_exercises
        SET target_sets = target_sets + 1
        WHERE id = ?
      `).run(data.session_exercise_id);

      return db.prepare('SELECT * FROM set_logs WHERE id = ?').get(newSetId) as SetLog;
    });
  },

  addExerciseToSession(sessionId: string, data: AddSessionExerciseDto): SessionExercise {
    return runInTransaction(() => {
      const db = getDb();
      const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(sessionId) as WorkoutSession | undefined;
      if (!session) {
        throw new Error(`Workout session with ID ${sessionId} not found`);
      }

      const exercise = exerciseService.getById(data.exercise_id);
      if (!exercise) {
        throw new Error(`Exercise with ID ${data.exercise_id} not found`);
      }

      const maxPosRow = db.prepare(`
        SELECT COALESCE(MAX(position), -1) as max_pos
        FROM session_exercises
        WHERE session_id = ?
      `).get(sessionId) as { max_pos: number };

      const nextPosition = maxPosRow.max_pos + 1;
      const sessionExId = randomUUID();

      db.prepare(`
        INSERT INTO session_exercises (
          id, session_id, exercise_id, exercise_name_snapshot,
          tracking_type_snapshot, load_mode_snapshot, load_basis_snapshot,
          position, target_sets, rest_seconds, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        sessionExId,
        sessionId,
        exercise.id,
        exercise.name,
        exercise.tracking_type,
        exercise.load_mode,
        exercise.load_basis,
        nextPosition,
        data.target_sets,
        data.rest_seconds ?? 60
      );

      const insertSetLog = db.prepare(`
        INSERT INTO set_logs (
          id, session_exercise_id, set_number,
          target_reps_min, target_reps_max, target_duration_seconds, target_load_kg,
          actual_reps, actual_duration_seconds, actual_load_kg,
          status, notes, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'pending', NULL, NULL)
      `);

      for (let i = 1; i <= data.target_sets; i++) {
        insertSetLog.run(
          randomUUID(),
          sessionExId,
          i,
          data.target_reps_min ?? null,
          data.target_reps_max ?? null,
          data.target_duration_seconds ?? null,
          data.target_load_kg ?? null
        );
      }

      const sessionEx = db.prepare('SELECT * FROM session_exercises WHERE id = ?').get(sessionExId) as SessionExercise;
      sessionEx.sets = db.prepare('SELECT * FROM set_logs WHERE session_exercise_id = ? ORDER BY set_number ASC').all(sessionExId) as SetLog[];

      return sessionEx;
    });
  },

  updateSessionNotes(sessionId: string, notes: string | null): WorkoutSession {
    const db = getDb();
    db.prepare('UPDATE workout_sessions SET notes = ? WHERE id = ?').run(notes ? notes.trim() : null, sessionId);
    return this.getSessionById(sessionId)!;
  },

  finishSession(sessionId: string, notes?: string | null): WorkoutSession {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(sessionId) as WorkoutSession | undefined;
    if (!existing) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const now = new Date().toISOString();
    const finalNotes = notes !== undefined ? (notes ? notes.trim() : null) : existing.notes;

    db.prepare(`
      UPDATE workout_sessions
      SET status = 'completed', finished_at = ?, notes = ?
      WHERE id = ?
    `).run(now, finalNotes, sessionId);

    return this.getSessionById(sessionId)!;
  },

  cancelSession(sessionId: string, notes?: string | null): WorkoutSession {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(sessionId) as WorkoutSession | undefined;
    if (!existing) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const now = new Date().toISOString();
    const finalNotes = notes !== undefined ? (notes ? notes.trim() : null) : existing.notes;

    db.prepare(`
      UPDATE workout_sessions
      SET status = 'cancelled', finished_at = ?, notes = ?
      WHERE id = ?
    `).run(now, finalNotes, sessionId);

    return this.getSessionById(sessionId)!;
  },

  listHistory(options?: {
    limit?: number;
    offset?: number;
    status?: SessionStatus;
    startDate?: string;
    endDate?: string;
    exerciseId?: string;
  }): { sessions: WorkoutSession[]; total: number } {
    const db = getDb();
    let whereClause = '1=1';
    const params: unknown[] = [];

    if (options?.status) {
      whereClause += ' AND ws.status = ?';
      params.push(options.status);
    }

    if (options?.startDate) {
      whereClause += ' AND ws.started_at >= ?';
      params.push(options.startDate);
    }

    if (options?.endDate) {
      whereClause += ' AND ws.started_at <= ?';
      params.push(options.endDate);
    }

    if (options?.exerciseId) {
      whereClause += ' AND ws.id IN (SELECT session_id FROM session_exercises WHERE exercise_id = ?)';
      params.push(options.exerciseId);
    }

    const countRow = db.prepare(`
      SELECT count(*) as count
      FROM workout_sessions ws
      WHERE ${whereClause}
    `).get(...params) as { count: number };

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const sessionRows = db.prepare(`
      SELECT ws.*
      FROM workout_sessions ws
      WHERE ${whereClause}
      ORDER BY ws.started_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as WorkoutSession[];

    const sessions = sessionRows.map((s) => this.getSessionById(s.id)!);

    return {
      sessions,
      total: countRow.count,
    };
  },

  updateHistoricalSession(
    sessionId: string,
    updates: { started_at?: string; finished_at?: string | null; notes?: string | null }
  ): WorkoutSession {
    const existing = this.getSessionById(sessionId);
    if (!existing) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const db = getDb();
    const startedAt = updates.started_at || existing.started_at;
    const finishedAt = updates.finished_at !== undefined ? updates.finished_at : existing.finished_at;
    const notes = updates.notes !== undefined ? updates.notes : existing.notes;

    db.prepare(`
      UPDATE workout_sessions
      SET started_at = ?, finished_at = ?, notes = ?
      WHERE id = ?
    `).run(startedAt, finishedAt, notes, sessionId);

    return this.getSessionById(sessionId)!;
  },

  deleteSession(sessionId: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM workout_sessions WHERE id = ?').run(sessionId);
    return true;
  },
};
