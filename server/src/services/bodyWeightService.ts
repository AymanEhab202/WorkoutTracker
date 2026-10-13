import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { BodyWeightEntry } from '@shared/types';

export interface CreateBodyWeightDto {
  measured_at: string;
  weight_kg: number;
  notes?: string | null;
}

export const bodyWeightService = {
  list(options?: { startDate?: string; endDate?: string }): BodyWeightEntry[] {
    const db = getDb();
    let sql = 'SELECT * FROM body_weight_entries WHERE 1=1';
    const params: unknown[] = [];

    if (options?.startDate) {
      sql += ' AND measured_at >= ?';
      params.push(options.startDate);
    }

    if (options?.endDate) {
      sql += ' AND measured_at <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY measured_at DESC';

    return db.prepare(sql).all(...params) as BodyWeightEntry[];
  },

  getById(id: string): BodyWeightEntry | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM body_weight_entries WHERE id = ?').get(id) as BodyWeightEntry | undefined;
    return row || null;
  },

  getLatest(): BodyWeightEntry | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM body_weight_entries
      ORDER BY measured_at DESC
      LIMIT 1
    `).get() as BodyWeightEntry | undefined;
    return row || null;
  },

  getFirst(): BodyWeightEntry | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM body_weight_entries
      ORDER BY measured_at ASC
      LIMIT 1
    `).get() as BodyWeightEntry | undefined;
    return row || null;
  },

  create(data: CreateBodyWeightDto): BodyWeightEntry {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO body_weight_entries (id, measured_at, weight_kg, notes, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.measured_at, data.weight_kg, data.notes ? data.notes.trim() : null, now);

    return this.getById(id)!;
  },

  update(id: string, data: Partial<CreateBodyWeightDto>): BodyWeightEntry {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Body weight entry with ID ${id} not found`);
    }

    const db = getDb();
    const measuredAt = data.measured_at || existing.measured_at;
    const weightKg = data.weight_kg !== undefined ? data.weight_kg : existing.weight_kg;
    const notes = data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : existing.notes;

    db.prepare(`
      UPDATE body_weight_entries
      SET measured_at = ?, weight_kg = ?, notes = ?
      WHERE id = ?
    `).run(measuredAt, weightKg, notes, id);

    return this.getById(id)!;
  },

  delete(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM body_weight_entries WHERE id = ?').run(id);
    return true;
  },

  getStats(): {
    current: number | null;
    current_date: string | null;
    change_from_first: number | null;
    change_last_30d: number | null;
    rolling_7d_average: number | null;
    trend: 'up' | 'down' | 'steady' | 'insufficient_data';
  } {
    const latest = this.getLatest();
    if (!latest) {
      return {
        current: null,
        current_date: null,
        change_from_first: null,
        change_last_30d: null,
        rolling_7d_average: null,
        trend: 'insufficient_data',
      };
    }

    const first = this.getFirst();
    const changeFromFirst = first && first.id !== latest.id ? parseFloat((latest.weight_kg - first.weight_kg).toFixed(2)) : 0;

    // Measurements in past 7 days for rolling average
    const db = getDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysIso = sevenDaysAgo.toISOString();

    const recent7d = db.prepare(`
      SELECT weight_kg FROM body_weight_entries
      WHERE measured_at >= ?
      ORDER BY measured_at ASC
    `).all(sevenDaysIso) as { weight_kg: number }[];

    let rollingAvg: number | null = null;
    // Section 4.6: "When the data is insufficient for an average, show the latest measurement rather than a misleading statistic."
    // If >= 3 measurements in 7 days, compute real average
    if (recent7d.length >= 3) {
      const sum = recent7d.reduce((acc, curr) => acc + curr.weight_kg, 0);
      rollingAvg = parseFloat((sum / recent7d.length).toFixed(2));
    }

    // Change in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysIso = thirtyDaysAgo.toISOString();

    const thirtyDayFirst = db.prepare(`
      SELECT weight_kg FROM body_weight_entries
      WHERE measured_at >= ?
      ORDER BY measured_at ASC
      LIMIT 1
    `).get(thirtyDaysIso) as { weight_kg: number } | undefined;

    const changeLast30d = thirtyDayFirst ? parseFloat((latest.weight_kg - thirtyDayFirst.weight_kg).toFixed(2)) : null;

    let trend: 'up' | 'down' | 'steady' | 'insufficient_data' = 'insufficient_data';
    if (changeLast30d !== null) {
      if (changeLast30d > 0.5) trend = 'up';
      else if (changeLast30d < -0.5) trend = 'down';
      else trend = 'steady';
    } else if (changeFromFirst !== 0) {
      if (changeFromFirst > 0.5) trend = 'up';
      else if (changeFromFirst < -0.5) trend = 'down';
      else trend = 'steady';
    }

    return {
      current: latest.weight_kg,
      current_date: latest.measured_at,
      change_from_first: changeFromFirst,
      change_last_30d: changeLast30d,
      rolling_7d_average: rollingAvg,
      trend,
    };
  },

  getHistoryWithRollingAverage(): Array<{
    id: string;
    measured_at: string;
    weight_kg: number;
    rolling_7d_avg: number | null;
    notes: string | null;
  }> {
    const entries = this.list(); // newest first
    const chronological = [...entries].reverse(); // oldest first

    return chronological.map((entry, index) => {
      const entryTime = new Date(entry.measured_at).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Find all measurements in the 7 days leading up to this entry
      const windowEntries = chronological.filter((e) => {
        const t = new Date(e.measured_at).getTime();
        return t <= entryTime && t >= entryTime - sevenDaysMs;
      });

      let rolling_7d_avg: number | null = null;
      if (windowEntries.length >= 3) {
        const sum = windowEntries.reduce((acc, curr) => acc + curr.weight_kg, 0);
        rolling_7d_avg = parseFloat((sum / windowEntries.length).toFixed(2));
      }

      return {
        id: entry.id,
        measured_at: entry.measured_at,
        weight_kg: entry.weight_kg,
        rolling_7d_avg,
        notes: entry.notes,
      };
    });
  },
};
