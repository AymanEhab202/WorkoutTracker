import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { exerciseService } from '../services/exerciseService';
import { templateService } from '../services/templateService';
import { sessionService } from '../services/sessionService';
import { bodyWeightService } from '../services/bodyWeightService';
import { goalService } from '../services/goalService';
import { dashboardService } from '../services/dashboardService';
import { analyticsService } from '../services/analyticsService';
import { backupService } from '../services/backupService';
import fs from 'fs';
import path from 'path';

describe('Domain Services & Data Integrity', () => {
  let testDbFile: string;

  beforeEach(() => {
    testDbFile = path.resolve(process.cwd(), `test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    closeDb();
    const db = initDb(testDbFile);
    runMigrations(db);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbFile)) {
      try {
        fs.unlinkSync(testDbFile);
      } catch {}
    }
  });

  describe('Exercises', () => {
    it('creates and lists exercises, including tracking types', () => {
      const ex = exerciseService.create({
        name: 'Incline Dumbbell Press',
        category: 'Chest',
        tracking_type: 'reps',
        load_mode: 'required',
        load_basis: 'per_hand',
        instructions: 'Bench set to 30 degrees.',
      });

      expect(ex.id).toBeDefined();
      expect(ex.name).toBe('Incline Dumbbell Press');

      const all = exerciseService.list({ category: 'Chest' });
      expect(all.some((e) => e.name === 'Incline Dumbbell Press')).toBe(true);
    });

    it('archives an exercise and excludes from default list', () => {
      const ex = exerciseService.create({
        name: 'Temporary Exercise',
        category: 'Other',
        tracking_type: 'reps',
        load_mode: 'none',
        load_basis: 'total',
      });

      exerciseService.archive(ex.id);

      const activeList = exerciseService.list();
      expect(activeList.some((e) => e.id === ex.id)).toBe(false);

      const archivedList = exerciseService.list({ includeArchived: true });
      expect(archivedList.some((e) => e.id === ex.id)).toBe(true);
    });

    it('prevents permanent deletion if historical session depends on exercise', () => {
      const exercises = exerciseService.list();
      const firstEx = exercises[0];

      // Start session and finish it with this exercise
      const session = sessionService.startSession({ name: 'History Test' });
      sessionService.addExerciseToSession(session.id, {
        exercise_id: firstEx.id,
        target_sets: 2,
      });

      expect(() => {
        exerciseService.delete(firstEx.id);
      }).toThrow(/Cannot permanently delete exercise because historical sessions/);
    });
  });

  describe('Workout Templates & Historic Integrity', () => {
    it('creates template and isolates historical session from template changes', () => {
      const exercises = exerciseService.list();
      const ex1 = exercises[0];

      const template = templateService.create({
        name: 'Upper Body Blast',
        description: 'Focus on chest and back',
        exercises: [
          {
            exercise_id: ex1.id,
            position: 0,
            target_sets: 3,
            target_reps_min: 8,
            target_reps_max: 12,
            target_load_kg: 20,
            rest_seconds: 90,
          },
        ],
      });

      expect(template.exercises?.length).toBe(1);

      // Start session from template
      const session = sessionService.startSession({ template_id: template.id });
      expect(session.exercises?.length).toBe(1);
      expect(session.exercises![0].target_sets).toBe(3);
      expect(session.exercises![0].sets.length).toBe(3);
      expect(session.exercises![0].sets[0].target_reps_min).toBe(8);
      expect(session.exercises![0].sets[0].target_reps_max).toBe(12);

      // Now update the template targets (change to 5 sets, 15 reps)
      templateService.update(template.id, {
        exercises: [
          {
            exercise_id: ex1.id,
            position: 0,
            target_sets: 5,
            target_reps_min: 15,
            target_reps_max: 15,
            target_load_kg: 30,
            rest_seconds: 60,
          },
        ],
      });

      // Verify the session STILL has its original snapshot (3 sets, 8-12 reps)
      const fetchedSession = sessionService.getSessionById(session.id);
      expect(fetchedSession?.exercises?.length).toBe(1);
      expect(fetchedSession?.exercises![0].target_sets).toBe(3);
      expect(fetchedSession?.exercises![0].sets.length).toBe(3);
      expect(fetchedSession?.exercises![0].sets[0].target_reps_min).toBe(8);
    });
  });

  describe('Active Workout & Set Recording', () => {
    it('handles set completion, extra sets, skipping, and finishing', () => {
      const exercises = exerciseService.list();
      const session = sessionService.startSession({ name: 'Live Workout' });

      // Add exercise to active session
      const sessionEx = sessionService.addExerciseToSession(session.id, {
        exercise_id: exercises[0].id,
        target_sets: 2,
        target_reps_min: 10,
        target_reps_max: 10,
      });

      expect(sessionEx.sets.length).toBe(2);
      expect(sessionEx.sets[0].status).toBe('pending');

      // Record set 1 completed
      const updatedSet1 = sessionService.updateSet(sessionEx.sets[0].id, {
        status: 'completed',
        actual_reps: 10,
        actual_load_kg: 50,
      });
      expect(updatedSet1.status).toBe('completed');
      expect(updatedSet1.actual_reps).toBe(10);
      expect(updatedSet1.completed_at).toBeDefined();

      // Skip set 2
      const updatedSet2 = sessionService.updateSet(sessionEx.sets[1].id, {
        status: 'skipped',
      });
      expect(updatedSet2.status).toBe('skipped');

      // Add extra set (set 3)
      const extraSet = sessionService.addExtraSet({
        session_exercise_id: sessionEx.id,
      });
      expect(extraSet.set_number).toBe(3);
      expect(extraSet.status).toBe('pending');

      // Complete extra set
      sessionService.updateSet(extraSet.id, {
        status: 'completed',
        actual_reps: 8,
        actual_load_kg: 55,
      });

      // Finish session
      const finished = sessionService.finishSession(session.id, 'Great session!');
      expect(finished.status).toBe('completed');
      expect(finished.finished_at).toBeDefined();
      expect(finished.completed_sets_count).toBe(2); // set 1 and extra set completed, set 2 skipped
    });

    it('resumes active workout and prevents duplicate starts', () => {
      const session1 = sessionService.startSession({ name: 'Session One' });
      expect(sessionService.getActiveSession()?.id).toBe(session1.id);

      // Attempting to start another session while active returns the existing one (idempotent)
      const session2 = sessionService.startSession({ name: 'Session Two' });
      expect(session2.id).toBe(session1.id);

      // Cancelling frees active state
      sessionService.cancelSession(session1.id);
      expect(sessionService.getActiveSession()).toBeNull();
    });
  });

  describe('Body Weight & Rolling Average', () => {
    it('computes rolling 7-day average when >= 3 entries exist in window', () => {
      const now = new Date();

      // Add 3 entries within past 3 days
      const d1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const d2 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const d3 = now.toISOString();

      bodyWeightService.create({ measured_at: d1, weight_kg: 80.0 });
      bodyWeightService.create({ measured_at: d2, weight_kg: 81.0 });
      bodyWeightService.create({ measured_at: d3, weight_kg: 82.0 });

      const stats = bodyWeightService.getStats();
      expect(stats.current).toBe(82.0);
      expect(stats.rolling_7d_average).toBe(81.0); // (80 + 81 + 82) / 3 = 81.0
    });

    it('returns null rolling average when entries are insufficient', () => {
      bodyWeightService.create({ measured_at: new Date().toISOString(), weight_kg: 75.0 });
      const stats = bodyWeightService.getStats();
      expect(stats.rolling_7d_average).toBeNull();
    });
  });

  describe('Goals & Real Dynamic Progress', () => {
    it('calculates max_reps and external_load goals from real completed sets', () => {
      const exercises = exerciseService.list();
      const pushUps = exercises.find((e) => e.name === 'Push-ups') || exercises[0];

      const goal = goalService.create({
        title: '50 Push-ups',
        goal_type: 'max_reps',
        exercise_id: pushUps.id,
        baseline_value: 20,
        target_value: 50,
        start_date: '2026-01-01',
      });

      expect(goal.current_value).toBe(0);
      expect(goal.progress_percent).toBe(0);
      expect(goal.is_achieved).toBe(false);

      // Complete a session with 35 reps
      const session = sessionService.startSession({ name: 'Push-up test' });
      const se = sessionService.addExerciseToSession(session.id, {
        exercise_id: pushUps.id,
        target_sets: 1,
      });
      sessionService.updateSet(se.sets[0].id, {
        status: 'completed',
        actual_reps: 35,
      });
      sessionService.finishSession(session.id);

      const updatedGoal = goalService.getById(goal.id)!;
      expect(updatedGoal.current_value).toBe(35);
      // (35 - 20) / (50 - 20) = 15/30 = 50%
      expect(updatedGoal.progress_percent).toBe(50);
      expect(updatedGoal.is_achieved).toBe(false);

      // Now complete a session with 50 reps
      const session2 = sessionService.startSession({ name: 'Push-up PR' });
      const se2 = sessionService.addExerciseToSession(session2.id, {
        exercise_id: pushUps.id,
        target_sets: 1,
      });
      sessionService.updateSet(se2.sets[0].id, {
        status: 'completed',
        actual_reps: 52,
      });
      sessionService.finishSession(session2.id);

      const achievedGoal = goalService.getById(goal.id)!;
      expect(achievedGoal.current_value).toBe(52);
      expect(achievedGoal.is_achieved).toBe(true);
      expect(achievedGoal.status).toBe('achieved');
    });

    it('handles weight loss goal correctly', () => {
      const goal = goalService.create({
        title: 'Cut weight',
        goal_type: 'body_weight',
        baseline_value: 90,
        target_value: 80,
        start_date: '2026-01-01',
      });

      bodyWeightService.create({ measured_at: new Date().toISOString(), weight_kg: 85 });
      const hyd = goalService.getById(goal.id)!;
      // lost 5kg out of 10kg target -> 50%
      expect(hyd.progress_percent).toBe(50);
      expect(hyd.is_achieved).toBe(false);
    });
  });

  describe('Backup, Export, and Restore', () => {
    it('creates SQLite VACUUM backup and performs versioned JSON export/restore safely', () => {
      // Create SQLite backup
      const backup = backupService.createSqliteBackup();
      expect(fs.existsSync(backup.path)).toBe(true);
      expect(backup.size_bytes).toBeGreaterThan(0);

      // Check integrity
      expect(backupService.checkIntegrity()).toBe(true);

      // Export JSON
      const jsonExport = backupService.exportJson();
      expect(jsonExport.version).toBe('1.0');
      expect(jsonExport.exercises.length).toBeGreaterThan(0);

      // Restore JSON
      const restoreResult = backupService.restoreJson(jsonExport);
      expect(restoreResult.restored_at).toBeDefined();
      expect(restoreResult.pre_restore_backup).toBeDefined();

      // Clean up backup file
      if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
      }
    });
  });
});
