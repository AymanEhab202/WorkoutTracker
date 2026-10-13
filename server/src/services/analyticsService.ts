import { getDb } from '../db/connection';
import { AnalyticsData, TrackingType } from '@shared/types';
import { bodyWeightService } from './bodyWeightService';

export const analyticsService = {
  getAnalytics(options?: { range?: '7d' | '30d' | '90d' | 'all'; exerciseId?: string }): AnalyticsData {
    const db = getDb();
    const range = options?.range || '30d';

    let startDateIso: string | null = null;
    if (range !== 'all') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const d = new Date();
      d.setDate(d.getDate() - days);
      startDateIso = d.toISOString();
    }

    // 1. Summary Metrics
    let summarySql = `
      SELECT
        COUNT(id) as total_workouts,
        COALESCE(SUM(
          CASE
            WHEN started_at IS NOT NULL AND finished_at IS NOT NULL
            THEN (strftime('%s', finished_at) - strftime('%s', started_at)) / 60
            ELSE 0
          END
        ), 0) as total_duration_minutes
      FROM workout_sessions
      WHERE status = 'completed'
    `;
    const summaryParams: unknown[] = [];
    if (startDateIso) {
      summarySql += ' AND started_at >= ?';
      summaryParams.push(startDateIso);
    }

    const summaryRow = db.prepare(summarySql).get(...summaryParams) as {
      total_workouts: number;
      total_duration_minutes: number;
    };

    let totalCompletedSetsSql = `
      SELECT COUNT(sl.id) as completed_sets
      FROM set_logs sl
      JOIN session_exercises se ON sl.session_exercise_id = se.id
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.status = 'completed' AND sl.status = 'completed'
    `;
    const setsParams: unknown[] = [];
    if (startDateIso) {
      totalCompletedSetsSql += ' AND ws.started_at >= ?';
      setsParams.push(startDateIso);
    }
    const setsRow = db.prepare(totalCompletedSetsSql).get(...setsParams) as { completed_sets: number };

    const totalWorkouts = summaryRow.total_workouts || 0;
    const totalDuration = Math.round(summaryRow.total_duration_minutes || 0);
    const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

    // 2. Weekly Consistency (past 8-12 weeks or range)
    const targetFreqSetting = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'weekly_target_frequency'
    `).get() as { value: string } | undefined;
    const targetFreq = targetFreqSetting ? parseInt(targetFreqSetting.value, 10) : 4;

    // Group workouts by ISO week (using strftime '%Y-%W')
    const weeklySessionsSql = `
      SELECT
        strftime('%Y-W%W', started_at) as week_code,
        MIN(date(started_at)) as week_start,
        COUNT(id) as completed_workouts
      FROM workout_sessions
      WHERE status = 'completed'
      ${startDateIso ? 'AND started_at >= ?' : ''}
      GROUP BY week_code
      ORDER BY week_code ASC
    `;
    const weeklyParams = startDateIso ? [startDateIso] : [];
    const weeklyRows = db.prepare(weeklySessionsSql).all(...weeklyParams) as Array<{
      week_code: string;
      week_start: string;
      completed_workouts: number;
    }>;

    const weeklyConsistency = weeklyRows.map((r) => ({
      week_start: r.week_start,
      completed_workouts: r.completed_workouts,
      target_frequency: targetFreq,
    }));

    // 3. Training Volume Over Time (per session/day)
    const volumeSql = `
      SELECT
        date(ws.started_at) as session_date,
        COUNT(sl.id) as planned_sets,
        SUM(CASE WHEN sl.status = 'completed' THEN 1 ELSE 0 END) as completed_sets,
        COALESCE(SUM(CASE WHEN sl.status = 'completed' THEN sl.actual_reps ELSE 0 END), 0) as total_reps
      FROM workout_sessions ws
      LEFT JOIN session_exercises se ON se.session_id = ws.id
      LEFT JOIN set_logs sl ON sl.session_exercise_id = se.id
      WHERE ws.status = 'completed'
      ${startDateIso ? 'AND ws.started_at >= ?' : ''}
      GROUP BY session_date
      ORDER BY session_date ASC
    `;
    const volumeParams = startDateIso ? [startDateIso] : [];
    const volumeRows = db.prepare(volumeSql).all(...volumeParams) as Array<{
      session_date: string;
      planned_sets: number;
      completed_sets: number;
      total_reps: number;
    }>;

    const volumeOverTime = volumeRows.map((r) => ({
      date: r.session_date,
      planned_sets: r.planned_sets || 0,
      completed_sets: r.completed_sets || 0,
      total_reps: r.total_reps || 0,
    }));

    // 4. Body weight trend with rolling 7-day average
    const weightHistory = bodyWeightService.getHistoryWithRollingAverage();
    const filteredWeight = startDateIso
      ? weightHistory.filter((w) => w.measured_at >= startDateIso!)
      : weightHistory;

    const bodyWeightTrend = filteredWeight.map((w) => ({
      date: w.measured_at.split('T')[0],
      weight_kg: w.weight_kg,
      rolling_7d_avg: w.rolling_7d_avg,
    }));

    // 5. Exercise Progress (if exerciseId specified, or latest selected exercise)
    let exerciseProgress: AnalyticsData['exercise_progress'] = undefined;
    if (options?.exerciseId) {
      const exercise = db.prepare('SELECT id, name, tracking_type FROM exercises WHERE id = ?').get(options.exerciseId) as {
        id: string;
        name: string;
        tracking_type: TrackingType;
      } | undefined;

      if (exercise) {
        const exProgSql = `
          SELECT
            date(ws.started_at) as log_date,
            MAX(sl.actual_reps) as best_reps,
            MAX(sl.actual_load_kg) as best_load_kg,
            MAX(sl.actual_duration_seconds) as best_duration_seconds,
            COALESCE(SUM(CASE WHEN sl.actual_load_kg IS NOT NULL AND sl.actual_reps IS NOT NULL THEN sl.actual_load_kg * sl.actual_reps ELSE 0 END), 0) as total_volume_kg
          FROM set_logs sl
          JOIN session_exercises se ON sl.session_exercise_id = se.id
          JOIN workout_sessions ws ON se.session_id = ws.id
          WHERE ws.status = 'completed' AND sl.status = 'completed'
            AND se.exercise_id = ?
            ${startDateIso ? 'AND ws.started_at >= ?' : ''}
          GROUP BY log_date
          ORDER BY log_date ASC
        `;
        const exParams = startDateIso ? [options.exerciseId, startDateIso] : [options.exerciseId];
        const exRows = db.prepare(exProgSql).all(...exParams) as Array<{
          log_date: string;
          best_reps: number | null;
          best_load_kg: number | null;
          best_duration_seconds: number | null;
          total_volume_kg: number;
        }>;

        exerciseProgress = {
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          tracking_type: exercise.tracking_type,
          data: exRows.map((r) => ({
            date: r.log_date,
            best_reps: r.best_reps ?? undefined,
            best_load_kg: r.best_load_kg ?? undefined,
            best_duration_seconds: r.best_duration_seconds ?? undefined,
            total_volume_kg: Math.round(r.total_volume_kg),
          })),
        };
      }
    }

    return {
      summary: {
        total_workouts: totalWorkouts,
        total_completed_sets: setsRow.completed_sets || 0,
        total_duration_minutes: totalDuration,
        avg_workout_duration_minutes: avgDuration,
      },
      weekly_consistency: weeklyConsistency,
      volume_over_time: volumeOverTime,
      body_weight_trend: bodyWeightTrend,
      exercise_progress: exerciseProgress,
    };
  },
};
