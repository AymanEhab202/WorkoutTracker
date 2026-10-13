import { randomUUID } from 'crypto';
import { getDb, runInTransaction } from '../db/connection';
import { WeeklyScheduleConfig, WeeklyScheduleEntry, WorkoutTemplate } from '@shared/types';
import { templateService } from './templateService';

export const scheduleService = {
  getSchedule(): WeeklyScheduleConfig {
    const db = getDb();

    const entries = db.prepare(`
      SELECT ws.*, wt.name as template_name
      FROM weekly_schedule ws
      LEFT JOIN workout_templates wt ON ws.template_id = wt.id
      ORDER BY ws.weekday ASC, ws.position ASC
    `).all() as WeeklyScheduleEntry[];

    const freqSetting = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'weekly_target_frequency'
    `).get() as { value: string } | undefined;

    const target_frequency = freqSetting ? parseInt(freqSetting.value, 10) : 4;

    return {
      entries,
      target_frequency,
    };
  },

  updateSchedule(
    entries: { weekday: number; template_id: string | null; position: number; active: number }[],
    targetFrequency: number
  ): WeeklyScheduleConfig {
    return runInTransaction(() => {
      const db = getDb();

      // Update target frequency in app_settings
      db.prepare(`
        INSERT INTO app_settings (key, value) VALUES ('weekly_target_frequency', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(targetFrequency.toString());

      // Update entries
      db.prepare('DELETE FROM weekly_schedule').run();

      const insertStmt = db.prepare(`
        INSERT INTO weekly_schedule (id, weekday, template_id, position, active)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const entry of entries) {
        insertStmt.run(
          randomUUID(),
          entry.weekday,
          entry.template_id || null,
          entry.position,
          entry.active
        );
      }

      return this.getSchedule();
    });
  },

  getTodayScheduledTemplate(): WorkoutTemplate | null {
    const db = getDb();
    const todayWeekday = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...

    const scheduleEntry = db.prepare(`
      SELECT template_id
      FROM weekly_schedule
      WHERE weekday = ? AND active = 1 AND template_id IS NOT NULL
      ORDER BY position ASC
      LIMIT 1
    `).get(todayWeekday) as { template_id: string } | undefined;

    if (!scheduleEntry?.template_id) return null;

    return templateService.getById(scheduleEntry.template_id);
  },
};
