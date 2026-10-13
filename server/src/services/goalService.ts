import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { Goal, GoalType, GoalStatus } from '@shared/types';
import { bodyWeightService } from './bodyWeightService';

export interface CreateGoalDto {
  title: string;
  goal_type: GoalType;
  exercise_id?: string | null;
  baseline_value: number;
  target_value: number;
  start_date: string;
  deadline?: string | null;
  status?: GoalStatus;
  notes?: string | null;
}

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export const goalService = {
  list(options?: { status?: GoalStatus }): Goal[] {
    const db = getDb();
    let sql = `
      SELECT g.*, e.name as exercise_name
      FROM goals g
      LEFT JOIN exercises e ON g.exercise_id = e.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (options?.status) {
      sql += ' AND g.status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY g.created_at DESC';

    const rawGoals = db.prepare(sql).all(...params) as (Goal & { exercise_name: string | null })[];

    return rawGoals.map((g) => this.hydrateGoalProgress(g));
  },

  getById(id: string): Goal | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT g.*, e.name as exercise_name
      FROM goals g
      LEFT JOIN exercises e ON g.exercise_id = e.id
      WHERE g.id = ?
    `).get(id) as (Goal & { exercise_name: string | null }) | undefined;

    if (!row) return null;
    return this.hydrateGoalProgress(row);
  },

  create(data: CreateGoalDto): Goal {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO goals (
        id, title, goal_type, exercise_id, baseline_value, target_value,
        start_date, deadline, status, notes, created_at, achieved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      id,
      data.title.trim(),
      data.goal_type,
      data.exercise_id || null,
      data.baseline_value,
      data.target_value,
      data.start_date,
      data.deadline || null,
      data.status || 'active',
      data.notes ? data.notes.trim() : null,
      now
    );

    return this.getById(id)!;
  },

  update(id: string, data: Partial<CreateGoalDto>): Goal {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Goal with ID ${id} not found`);
    }

    const db = getDb();
    const title = data.title !== undefined ? data.title.trim() : existing.title;
    const goalType = data.goal_type !== undefined ? data.goal_type : existing.goal_type;
    const exerciseId = data.exercise_id !== undefined ? data.exercise_id : existing.exercise_id;
    const baseline = data.baseline_value !== undefined ? data.baseline_value : existing.baseline_value;
    const target = data.target_value !== undefined ? data.target_value : existing.target_value;
    const startDate = data.start_date !== undefined ? data.start_date : existing.start_date;
    const deadline = data.deadline !== undefined ? data.deadline : existing.deadline;
    const status = data.status !== undefined ? data.status : existing.status;
    const notes = data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : existing.notes;

    db.prepare(`
      UPDATE goals
      SET title = ?, goal_type = ?, exercise_id = ?, baseline_value = ?, target_value = ?,
          start_date = ?, deadline = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(
      title,
      goalType,
      exerciseId || null,
      baseline,
      target,
      startDate,
      deadline || null,
      status,
      notes,
      id
    );

    return this.getById(id)!;
  },

  delete(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    return true;
  },

  hydrateGoalProgress(goal: Goal): Goal {
    const db = getDb();
    let currentValue = 0;
    let isAchieved = false;
    let progressPercent = 0;

    switch (goal.goal_type) {
      case 'max_reps': {
        if (goal.exercise_id) {
          const row = db.prepare(`
            SELECT COALESCE(MAX(sl.actual_reps), 0) as best
            FROM set_logs sl
            JOIN session_exercises se ON sl.session_exercise_id = se.id
            JOIN workout_sessions ws ON se.session_id = ws.id
            WHERE ws.status = 'completed' AND sl.status = 'completed'
              AND se.exercise_id = ?
              AND ws.started_at >= ?
          `).get(goal.exercise_id, goal.start_date) as { best: number };

          currentValue = row.best;
          isAchieved = currentValue >= goal.target_value;

          const span = goal.target_value - goal.baseline_value;
          if (span > 0) {
            progressPercent = Math.max(0, Math.min(100, Math.round(((currentValue - goal.baseline_value) / span) * 100)));
          } else {
            progressPercent = isAchieved ? 100 : 0;
          }
        }
        break;
      }

      case 'max_duration': {
        if (goal.exercise_id) {
          const row = db.prepare(`
            SELECT COALESCE(MAX(sl.actual_duration_seconds), 0) as best
            FROM set_logs sl
            JOIN session_exercises se ON sl.session_exercise_id = se.id
            JOIN workout_sessions ws ON se.session_id = ws.id
            WHERE ws.status = 'completed' AND sl.status = 'completed'
              AND se.exercise_id = ?
              AND ws.started_at >= ?
          `).get(goal.exercise_id, goal.start_date) as { best: number };

          currentValue = row.best;
          isAchieved = currentValue >= goal.target_value;

          const span = goal.target_value - goal.baseline_value;
          if (span > 0) {
            progressPercent = Math.max(0, Math.min(100, Math.round(((currentValue - goal.baseline_value) / span) * 100)));
          } else {
            progressPercent = isAchieved ? 100 : 0;
          }
        }
        break;
      }

      case 'external_load': {
        if (goal.exercise_id) {
          const row = db.prepare(`
            SELECT COALESCE(MAX(sl.actual_load_kg), 0) as best
            FROM set_logs sl
            JOIN session_exercises se ON sl.session_exercise_id = se.id
            JOIN workout_sessions ws ON se.session_id = ws.id
            WHERE ws.status = 'completed' AND sl.status = 'completed'
              AND se.exercise_id = ?
              AND ws.started_at >= ?
          `).get(goal.exercise_id, goal.start_date) as { best: number };

          currentValue = row.best;
          isAchieved = currentValue >= goal.target_value;

          const span = goal.target_value - goal.baseline_value;
          if (span > 0) {
            progressPercent = Math.max(0, Math.min(100, Math.round(((currentValue - goal.baseline_value) / span) * 100)));
          } else {
            progressPercent = isAchieved ? 100 : 0;
          }
        }
        break;
      }

      case 'body_weight': {
        const latestWeight = bodyWeightService.getLatest();
        if (latestWeight) {
          currentValue = latestWeight.weight_kg;

          if (goal.target_value < goal.baseline_value) {
            // Weight loss goal
            isAchieved = currentValue <= goal.target_value;
            const span = goal.baseline_value - goal.target_value;
            if (span > 0) {
              const lost = goal.baseline_value - currentValue;
              progressPercent = Math.max(0, Math.min(100, Math.round((lost / span) * 100)));
            } else {
              progressPercent = isAchieved ? 100 : 0;
            }
          } else {
            // Weight gain goal
            isAchieved = currentValue >= goal.target_value;
            const span = goal.target_value - goal.baseline_value;
            if (span > 0) {
              const gained = currentValue - goal.baseline_value;
              progressPercent = Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
            } else {
              progressPercent = isAchieved ? 100 : 0;
            }
          }
        } else {
          currentValue = goal.baseline_value;
          progressPercent = 0;
          isAchieved = false;
        }
        break;
      }

      case 'workout_frequency': {
        const weekStartIso = getMondayOfCurrentWeek();
        const row = db.prepare(`
          SELECT count(*) as count
          FROM workout_sessions
          WHERE status = 'completed' AND started_at >= ?
        `).get(weekStartIso) as { count: number };

        currentValue = row.count;
        isAchieved = currentValue >= goal.target_value;

        if (goal.target_value > 0) {
          progressPercent = Math.max(0, Math.min(100, Math.round((currentValue / goal.target_value) * 100)));
        } else {
          progressPercent = 100;
          isAchieved = true;
        }
        break;
      }
    }

    // If goal is achieved and status was active, record achievement timestamp
    if (isAchieved && goal.status === 'active' && !goal.achieved_at) {
      const now = new Date().toISOString();
      db.prepare("UPDATE goals SET status = 'achieved', achieved_at = ? WHERE id = ?").run(now, goal.id);
      goal.status = 'achieved';
      goal.achieved_at = now;
    }

    return {
      ...goal,
      current_value: currentValue,
      progress_percent: progressPercent,
      is_achieved: isAchieved,
    };
  },
};
