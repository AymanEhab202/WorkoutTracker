import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { WorkoutSession, Exercise, SessionStatus } from '@shared/types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  History,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Filter,
  Search,
  ChevronRight,
  Edit2,
  Trash2,
  Dumbbell,
} from 'lucide-react';

export const WorkoutHistory: React.FC = () => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExerciseFilter, setSelectedExerciseFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Detail Modal state
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Edit notes modal
  const [editNotesModalOpen, setEditNotesModalOpen] = useState<boolean>(false);
  const [editingNotes, setEditingNotes] = useState<string>('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      let query = '/api/sessions?limit=50';
      if (statusFilter !== 'all') query += `&status=${statusFilter}`;
      if (selectedExerciseFilter) query += `&exerciseId=${selectedExerciseFilter}`;
      if (startDateFilter) query += `&startDate=${startDateFilter}`;
      if (endDateFilter) query += `&endDate=${endDateFilter}`;

      const [res, exList] = await Promise.all([
        api.get<{ sessions: WorkoutSession[]; total: number }>(query),
        api.get<Exercise[]>('/api/exercises'),
      ]);

      setSessions(res.sessions);
      setTotal(res.total);
      setExercises(exList);
    } catch (err) {
      console.error('Failed to load workout history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, selectedExerciseFilter, startDateFilter, endDateFilter]);

  const handleOpenDetail = async (s: WorkoutSession) => {
    try {
      const full = await api.get<WorkoutSession>(`/api/sessions/${s.id}`);
      setSelectedSession(full);
      setDetailModalOpen(true);
    } catch (err: any) {
      alert('Failed to load session details');
    }
  };

  const handleOpenEditNotes = (s: WorkoutSession) => {
    setSelectedSession(s);
    setEditingNotes(s.notes || '');
    setEditNotesModalOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedSession) return;
    try {
      await api.put(`/api/sessions/${selectedSession.id}/notes`, { notes: editingNotes });
      setEditNotesModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update notes');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/sessions/${deleteTarget.id}`);
      setDeleteTarget(null);
      if (detailModalOpen) setDetailModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete session');
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Workout History
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review completed sessions, verify set logs, and track historical targets.
        </p>
      </div>

      {/* Filter controls */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="text-slate-400 font-semibold block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="cancelled">Cancelled Only</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-semibold block mb-1">Exercise</label>
          <select
            value={selectedExerciseFilter}
            onChange={(e) => setSelectedExerciseFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Exercises</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-semibold block mb-1">From Date</label>
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="text-slate-400 font-semibold block mb-1">To Date</label>
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* History Table / List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading workout history...</div>
      ) : sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isCompleted = s.status === 'completed';
            const isCancelled = s.status === 'cancelled';
            const isInProgress = s.status === 'in_progress';

            return (
              <div
                key={s.id}
                onClick={() => handleOpenDetail(s)}
                className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-2xl flex-shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : isCancelled
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : isCancelled ? (
                      <XCircle className="w-6 h-6" />
                    ) : (
                      <Activity className="w-6 h-6 animate-pulse" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {s.template_name_snapshot}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : isCancelled
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300'
                        }`}
                      >
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(s.started_at).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Duration: {formatDuration(s.duration_seconds)}
                      </span>
                      <span>•</span>
                      <span>
                        Sets: <strong className="text-slate-800 dark:text-slate-200">{s.completed_sets_count}</strong> / {s.planned_sets_count}
                      </span>
                    </div>

                    {s.notes && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic line-clamp-1">
                        "{s.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 self-end sm:self-center">
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    Details <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <History className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300">No workout records found</h3>
          <p className="text-xs text-slate-500 mt-1">Adjust filters or complete workouts to build history.</p>
        </div>
      )}

      {/* Workout Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedSession ? `${selectedSession.template_name_snapshot}` : 'Workout Details'}
        maxWidth="2xl"
      >
        {selectedSession && (
          <div className="space-y-6">
            {/* Summary info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Date & Time</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {new Date(selectedSession.started_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Duration</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatDuration(selectedSession.duration_seconds)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Completed Sets</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedSession.completed_sets_count} of {selectedSession.planned_sets_count}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Status</span>
                <span className="font-bold uppercase text-indigo-600 dark:text-indigo-400">
                  {selectedSession.status}
                </span>
              </div>
            </div>

            {/* Notes */}
            {selectedSession.notes && (
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-1">
                  Session Notes:
                </span>
                <p className="text-slate-700 dark:text-slate-300">{selectedSession.notes}</p>
              </div>
            )}

            {/* Set by set comparison (Planned Targets vs Actual Performance) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Exercise & Set Breakdown
              </h4>

              {selectedSession.exercises?.map((se) => (
                <div
                  key={se.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700/60 font-bold text-xs text-slate-800 dark:text-slate-200 flex justify-between">
                    <span>{se.exercise_name_snapshot}</span>
                    <span className="text-slate-500 font-normal capitalize">
                      {se.tracking_type_snapshot}
                    </span>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700/60 text-slate-400 text-[10px] uppercase">
                        <th className="py-2 px-3">Set</th>
                        <th className="py-2 px-3">Planned Target</th>
                        <th className="py-2 px-3">Actual Result</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                      {se.sets.map((sl) => {
                        const isDuration = se.tracking_type_snapshot === 'duration';

                        // Target string
                        let target = isDuration
                          ? `${sl.target_duration_seconds || 60}s`
                          : sl.target_reps_min && sl.target_reps_max
                          ? `${sl.target_reps_min}-${sl.target_reps_max} reps`
                          : `${sl.target_reps_max || sl.target_reps_min || '—'} reps`;
                        if (sl.target_load_kg) target += ` @ ${sl.target_load_kg}kg`;

                        // Actual string
                        let actual = '—';
                        if (sl.status === 'completed') {
                          actual = isDuration
                            ? `${sl.actual_duration_seconds || 0}s`
                            : `${sl.actual_reps || 0} reps`;
                          if (sl.actual_load_kg !== null && sl.actual_load_kg !== undefined) {
                            actual += ` @ ${sl.actual_load_kg}kg`;
                          }
                        } else if (sl.status === 'skipped') {
                          actual = 'Skipped';
                        }

                        return (
                          <tr key={sl.id}>
                            <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-300">
                              Set {sl.set_number}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono">{target}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                              {actual}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  sl.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : sl.status === 'skipped'
                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {sl.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleOpenEditNotes(selectedSession)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Session Notes
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(selectedSession)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Record
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Notes Modal */}
      <Modal
        isOpen={editNotesModalOpen}
        onClose={() => setEditNotesModalOpen(false)}
        title="Edit Workout Session Notes"
      >
        <div className="space-y-4">
          <textarea
            rows={4}
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Notes about this workout session..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditNotesModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotes}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
            >
              Save Notes
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Record Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Workout History Record"
        message={`Are you sure you want to delete this workout record from ${deleteTarget?.started_at ? new Date(deleteTarget.started_at).toLocaleDateString() : 'history'}? This cannot be undone.`}
      />
    </div>
  );
};
