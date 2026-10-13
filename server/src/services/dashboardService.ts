import { getDb } from '../db/connection';
import { DashboardData } from '@shared/types';
import { scheduleService } from './scheduleService';
import { sessionService } from './sessionService';
import { bodyWeightService } from './bodyWeightService';
import { goalService } from './goalService';

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export const dashboardService = {
  getDashboardData(): DashboardData {
    const db = getDb();
    const weekStartIso = getMondayOfCurrentWeek();

    // 1. Today's workout & active session
    const scheduledTemplate = scheduleService.getTodayScheduledTemplate();
    const activeSession = sessionService.getActiveSession();

    // 2. Weekly stats
    const completedWorkoutsRow = db.prepare(`
      SELECT count(*) as count
      FROM workout_sessions
      WHERE status = 'completed' AND started_at >= ?
    `).get(weekStartIso) as { count: number };

    const targetFrequencySetting = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'weekly_target_frequency'
    `).get() as { value: string } | undefined;
    const targetFreq = targetFrequencySetting ? parseInt(targetFrequencySetting.value, 10) : 4;

    const completedWorkoutsThisWeek = completedWorkoutsRow.count;
    const completionRate = targetFreq > 0 ? Math.min(100, Math.round((completedWorkoutsThisWeek / targetFreq) * 100)) : 0;

    // Sets completed vs planned this week
    const setsRow = db.prepare(`
      SELECT
        COUNT(sl.id) as planned_sets,
        SUM(CASE WHEN sl.status = 'completed' THEN 1 ELSE 0 END) as completed_sets
      FROM set_logs sl
      JOIN session_exercises se ON sl.session_exercise_id = se.id
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.started_at >= ?
    `).get(weekStartIso) as { planned_sets: number; completed_sets: number | null };

    // 3. Latest body weight and trend
    const weightStats = bodyWeightService.getStats();

    // 4. Active goals
    const activeGoals = goalService.list({ status: 'active' });

    // 5. Recent personal records (best completed sets per exercise)
    const personalRecordsQuery = db.prepare(`
      SELECT
        e.id as exercise_id,
        e.name as exercise_name,
        e.tracking_type,
        MAX(sl.actual_reps) as max_reps,
        MAX(sl.actual_load_kg) as max_load,
        MAX(sl.actual_duration_seconds) as max_duration,
        MAX(sl.completed_at) as achieved_at
      FROM set_logs sl
      JOIN session_exercises se ON sl.session_exercise_id = se.id
      JOIN exercises e ON se.exercise_id = e.id
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.status = 'completed' AND sl.status = 'completed'
      GROUP BY e.id, e.name, e.tracking_type
      ORDER BY achieved_at DESC
      LIMIT 5
    `).all() as Array<{
      exercise_id: string;
      exercise_name: string;
      tracking_type: 'reps' | 'duration';
      max_reps: number | null;
      max_load: number | null;
      max_duration: number | null;
      achieved_at: string;
    }>;

    const recentPrs: DashboardData['recent_personal_records'] = [];
    for (const pr of personalRecordsQuery) {
      if (pr.tracking_type === 'duration' && pr.max_duration) {
        recentPrs.push({
          exercise_id: pr.exercise_id,
          exercise_name: pr.exercise_name,
          record_type: 'duration',
          value: pr.max_duration,
          achieved_at: pr.achieved_at,
        });
      } else if (pr.max_load && pr.max_load > 0) {
        recentPrs.push({
          exercise_id: pr.exercise_id,
          exercise_name: pr.exercise_name,
          record_type: 'load',
          value: pr.max_load,
          load_kg: pr.max_load,
          achieved_at: pr.achieved_at,
        });
      } else if (pr.max_reps) {
        recentPrs.push({
          exercise_id: pr.exercise_id,
          exercise_name: pr.exercise_name,
          record_type: 'reps',
          value: pr.max_reps,
          achieved_at: pr.achieved_at,
        });
      }
    }

    // 6. Recent activity chart (past 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysIso = fourteenDaysAgo.toISOString();

    const recentSessions = db.prepare(`
      SELECT
        ws.id,
        ws.started_at,
        ws.finished_at,
        ws.template_name_snapshot as workout_name,
        COUNT(sl.id) as total_sets,
        SUM(CASE WHEN sl.status = 'completed' THEN 1 ELSE 0 END) as completed_sets
      FROM workout_sessions ws
      LEFT JOIN session_exercises se ON se.session_id = ws.id
      LEFT JOIN set_logs sl ON sl.session_exercise_id = se.id
      WHERE ws.status = 'completed' AND ws.started_at >= ?
      GROUP BY ws.id
      ORDER BY ws.started_at ASC
    `).all(fourteenDaysIso) as Array<{
      id: string;
      started_at: string;
      finished_at: string | null;
      workout_name: string;
      total_sets: number;
      completed_sets: number | null;
    }>;

    const recentActivityChart = recentSessions.map((s) => {
      let durationMinutes = 0;
      if (s.started_at && s.finished_at) {
        const diffMs = new Date(s.finished_at).getTime() - new Date(s.started_at).getTime();
        durationMinutes = Math.max(1, Math.round(diffMs / 60000));
      }
      return {
        date: s.started_at.split('T')[0],
        completed_sets: s.completed_sets || 0,
        duration_minutes: durationMinutes,
        workout_name: s.workout_name,
      };
    });

    return {
      today_workout: {
        scheduled_template: scheduledTemplate,
        active_session: activeSession,
      },
      weekly_stats: {
        completed_workouts: completedWorkoutsThisWeek,
        target_frequency: targetFreq,
        completion_rate: completionRate,
        planned_sets: setsRow.planned_sets || 0,
        completed_sets: setsRow.completed_sets || 0,
      },
      latest_weight: {
        current: weightStats.current,
        change_from_first: weightStats.change_from_first,
        change_last_30d: weightStats.change_last_30d,
        trend: weightStats.trend,
      },
      active_goals: activeGoals,
      recent_personal_records: recentPrs,
      recent_activity_chart: recentActivityChart,
    };
  },
};
