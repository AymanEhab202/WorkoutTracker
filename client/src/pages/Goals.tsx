import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Goal, GoalType, GoalStatus, Exercise } from '@shared/types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Target,
  Plus,
  Trophy,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Clock,
  Trash2,
  Edit2,
  Calendar,
} from 'lucide-react';

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  max_reps: 'Maximum Repetitions',
  max_duration: 'Maximum Hold Duration (secs)',
  external_load: 'External Load (kg)',
  body_weight: 'Target Body Weight (kg)',
  workout_frequency: 'Weekly Workout Frequency',
};

export const Goals: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    goal_type: 'max_reps' as GoalType,
    exercise_id: '',
    baseline_value: 0,
    target_value: 10,
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    status: 'active' as GoalStatus,
    notes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const url = statusFilter !== 'all' ? `/api/goals?status=${statusFilter}` : '/api/goals';
      const [goalsRes, exList] = await Promise.all([
        api.get<Goal[]>(url),
        api.get<Exercise[]>('/api/exercises'),
      ]);
      setGoals(goalsRes);
      setExercises(exList);
    } catch (err) {
      console.error('Failed to load goals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setFormData({
      title: '',
      goal_type: 'max_reps',
      exercise_id: exercises.length > 0 ? exercises[0].id : '',
      baseline_value: 0,
      target_value: 20,
      start_date: new Date().toISOString().split('T')[0],
      deadline: '',
      status: 'active',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      goal_type: goal.goal_type,
      exercise_id: goal.exercise_id || '',
      baseline_value: goal.baseline_value,
      target_value: goal.target_value,
      start_date: goal.start_date.split('T')[0],
      deadline: goal.deadline ? goal.deadline.split('T')[0] : '',
      status: goal.status,
      notes: goal.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Goal title is required');
      return;
    }

    try {
      const payload = {
        ...formData,
        exercise_id: ['max_reps', 'max_duration', 'external_load'].includes(formData.goal_type)
          ? formData.exercise_id || null
          : null,
        deadline: formData.deadline ? formData.deadline : null,
      };

      if (editingGoal) {
        await api.put(`/api/goals/${editingGoal.id}`, payload);
      } else {
        await api.post('/api/goals', payload);
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save goal');
    }
  };

  const handleToggleStatus = async (goal: Goal, newStatus: GoalStatus) => {
    try {
      await api.put(`/api/goals/${goal.id}`, { status: newStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update goal status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/goals/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete goal');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Goals & Milestones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Progress is derived in real time from your actual workout and weight history.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {['all', 'active', 'achieved', 'paused', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`pb-2.5 px-3 uppercase tracking-wider transition border-b-2 ${
              statusFilter === tab
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading goals...</div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((g) => {
            const isAchieved = g.is_achieved || g.status === 'achieved';
            const progress = g.progress_percent || 0;

            let unit = '';
            if (g.goal_type === 'max_reps') unit = 'reps';
            else if (g.goal_type === 'max_duration') unit = 's';
            else if (g.goal_type === 'external_load' || g.goal_type === 'body_weight') unit = 'kg';
            else if (g.goal_type === 'workout_frequency') unit = 'workouts/week';

            return (
              <div
                key={g.id}
                className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                        {GOAL_TYPE_LABELS[g.goal_type]}
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
                        {g.title}
                      </h3>
                      {g.exercise_name && (
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Exercise: {g.exercise_name}
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isAchieved
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : g.status === 'paused'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : g.status === 'cancelled'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>

                  {/* Progress Bar & Values */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-400">Progress</span>
                      <span className={isAchieved ? 'text-emerald-600' : 'text-indigo-600'}>
                        {progress}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          isAchieved ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Baseline: {g.baseline_value} {unit}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Current: {g.current_value} {unit}
                      </span>
                      <span>Target: {g.target_value} {unit}</span>
                    </div>
                  </div>

                  {g.deadline && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Deadline: {new Date(g.deadline).toLocaleDateString()}</span>
                    </div>
                  )}

                  {g.notes && (
                    <p className="mt-2 text-xs text-slate-500 italic line-clamp-2">
                      "{g.notes}"
                    </p>
                  )}
                </div>

                {/* Card footer actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {g.status === 'active' ? (
                      <button
                        onClick={() => handleToggleStatus(g, 'paused')}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Pause goal"
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>
                    ) : g.status === 'paused' ? (
                      <button
                        onClick={() => handleToggleStatus(g, 'active')}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Resume goal"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                      title="Edit goal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => setDeleteTarget(g)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <Target className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300">No goals found</h3>
          <p className="text-xs text-slate-500 mt-1">Set targets for reps, load, or body weight.</p>
        </div>
      )}

      {/* Create / Edit Goal Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGoal ? 'Edit Goal' : 'Create New Goal'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Goal Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 50 Push-ups, 100kg Bench, 80kg Body Weight"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Goal Type
            </label>
            <select
              value={formData.goal_type}
              onChange={(e) => setFormData({ ...formData, goal_type: e.target.value as GoalType })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="max_reps">Maximum Repetitions (Exercise)</option>
              <option value="max_duration">Maximum Hold Duration (Exercise)</option>
              <option value="external_load">External Load Weight (Exercise)</option>
              <option value="body_weight">Target Body Weight</option>
              <option value="workout_frequency">Weekly Workout Frequency</option>
            </select>
          </div>

          {['max_reps', 'max_duration', 'external_load'].includes(formData.goal_type) && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Related Exercise
              </label>
              <select
                required
                value={formData.exercise_id}
                onChange={(e) => setFormData({ ...formData, exercise_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Baseline Value
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={formData.baseline_value}
                onChange={(e) => setFormData({ ...formData, baseline_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Target Value
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Deadline (Optional)
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Focus on clean lockouts and pauses"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
            >
              Save Goal
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Goal"
        message={`Are you sure you want to delete the goal "${deleteTarget?.title}"?`}
      />
    </div>
  );
};
