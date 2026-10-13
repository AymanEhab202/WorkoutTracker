import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import {
  WorkoutSession,
  SessionExercise,
  SetLog,
  Exercise,
  WorkoutTemplate,
} from '@shared/types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Play,
  Check,
  SkipForward,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Dumbbell,
  FileText,
  StopCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export const ActiveWorkout: React.FC = () => {
  const navigate = useNavigate();
  const outlet = useOutletContext<{ refreshActiveSession?: () => Promise<void> }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [savedFeedbackSetId, setSavedFeedbackSetId] = useState<string | null>(null);

  // Modals state
  const [finishModalOpen, setFinishModalOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [addExerciseModalOpen, setAddExerciseModalOpen] = useState<boolean>(false);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [newExerciseSets, setNewExerciseSets] = useState<number>(3);
  const [workoutNotes, setWorkoutNotes] = useState<string>('');

  // Start workout from scratch if no active session
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  // Local inputs state for fast editing before save: { [setId]: { reps, load, duration } }
  const [setInputs, setSetInputs] = useState<Record<string, { reps: string; load: string; duration: string }>>({});

  const loadActiveSession = async () => {
    try {
      setLoading(true);
      const res = await api.get<WorkoutSession | null>('/api/sessions/active');
      if (res) {
        setSession(res);
        setWorkoutNotes(res.notes || '');

        // Populate initial inputs from set logs
        const initialInputs: Record<string, { reps: string; load: string; duration: string }> = {};
        if (res.exercises) {
          for (const ex of res.exercises) {
            for (const s of ex.sets) {
              initialInputs[s.id] = {
                reps: s.actual_reps !== null ? s.actual_reps.toString() : (s.target_reps_max ?? s.target_reps_min ?? '').toString(),
                load: s.actual_load_kg !== null ? s.actual_load_kg.toString() : (s.target_load_kg ?? '').toString(),
                duration: s.actual_duration_seconds !== null ? s.actual_duration_seconds.toString() : (s.target_duration_seconds ?? '').toString(),
              };
            }
          }
        }
        setSetInputs(initialInputs);
      } else {
        // Load templates so user can start a workout directly here
        const tpls = await api.get<WorkoutTemplate[]>('/api/templates');
        setTemplates(tpls);
      }
    } catch (err) {
      console.error('Failed to load active session', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveSession();
  }, []);

  const handleStartWorkout = async (templateId?: string | null) => {
    try {
      setLoading(true);
      const res = await api.post<WorkoutSession>('/api/sessions/start', {
        template_id: templateId || null,
      });
      setSession(res);
      setWorkoutNotes(res.notes || '');
      if (outlet?.refreshActiveSession) {
        outlet.refreshActiveSession();
      }
      loadActiveSession();
    } catch (err: any) {
      alert(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (setId: string, field: 'reps' | 'load' | 'duration', value: string) => {
    setSetInputs((prev) => ({
      ...prev,
      [setId]: {
        ...prev[setId],
        [field]: value,
      },
    }));
  };

  // Complete a set
  const handleCompleteSet = async (sessionEx: SessionExercise, setLog: SetLog) => {
    const input = setInputs[setLog.id] || { reps: '', load: '', duration: '' };
    const trackingType = sessionEx.tracking_type_snapshot;

    const actualReps = trackingType === 'reps' ? (input.reps !== '' ? parseInt(input.reps, 10) : 0) : null;
    const actualDuration = trackingType === 'duration' ? (input.duration !== '' ? parseInt(input.duration, 10) : 0) : null;
    const actualLoad = input.load !== '' ? parseFloat(input.load) : null;

    try {
      setSavingSetId(setLog.id);
      const updated = await api.put<SetLog>(`/api/sessions/sets/${setLog.id}`, {
        status: 'completed',
        actual_reps: actualReps,
        actual_duration_seconds: actualDuration,
        actual_load_kg: actualLoad,
      });

      // Update in state immediately
      setSession((prev) => {
        if (!prev || !prev.exercises) return prev;
        const newExercises = prev.exercises.map((ex) => {
          if (ex.id === sessionEx.id) {
            return {
              ...ex,
              sets: ex.sets.map((s) => (s.id === updated.id ? updated : s)),
            };
          }
          return ex;
        });
        const completedCount = newExercises.flatMap((e) => e.sets).filter((s) => s.status === 'completed').length;
        return {
          ...prev,
          exercises: newExercises,
          completed_sets_count: completedCount,
        };
      });

      setSavedFeedbackSetId(setLog.id);
      setTimeout(() => setSavedFeedbackSetId(null), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to save set');
    } finally {
      setSavingSetId(null);
    }
  };

  // Skip a set
  const handleSkipSet = async (sessionEx: SessionExercise, setLog: SetLog) => {
    try {
      setSavingSetId(setLog.id);
      const updated = await api.put<SetLog>(`/api/sessions/sets/${setLog.id}`, {
        status: 'skipped',
        actual_reps: null,
        actual_duration_seconds: null,
        actual_load_kg: null,
      });

      setSession((prev) => {
        if (!prev || !prev.exercises) return prev;
        const newExercises = prev.exercises.map((ex) => {
          if (ex.id === sessionEx.id) {
            return {
              ...ex,
              sets: ex.sets.map((s) => (s.id === updated.id ? updated : s)),
            };
          }
          return ex;
        });
        return { ...prev, exercises: newExercises };
      });
    } catch (err: any) {
      alert(err.message || 'Failed to skip set');
    } finally {
      setSavingSetId(null);
    }
  };

  // Re-open / mark set pending for editing
  const handleResetSetToPending = async (sessionEx: SessionExercise, setLog: SetLog) => {
    try {
      setSavingSetId(setLog.id);
      const updated = await api.put<SetLog>(`/api/sessions/sets/${setLog.id}`, {
        status: 'pending',
      });

      setSession((prev) => {
        if (!prev || !prev.exercises) return prev;
        const newExercises = prev.exercises.map((ex) => {
          if (ex.id === sessionEx.id) {
            return {
              ...ex,
              sets: ex.sets.map((s) => (s.id === updated.id ? updated : s)),
            };
          }
          return ex;
        });
        const completedCount = newExercises.flatMap((e) => e.sets).filter((s) => s.status === 'completed').length;
        return {
          ...prev,
          exercises: newExercises,
          completed_sets_count: completedCount,
        };
      });
    } catch (err: any) {
      alert(err.message || 'Failed to reset set status');
    } finally {
      setSavingSetId(null);
    }
  };

  // Add extra set
  const handleAddExtraSet = async (sessionEx: SessionExercise) => {
    try {
      const newSet = await api.post<SetLog>('/api/sessions/sets/extra', {
        session_exercise_id: sessionEx.id,
      });

      setSetInputs((prev) => ({
        ...prev,
        [newSet.id]: {
          reps: (newSet.target_reps_max ?? newSet.target_reps_min ?? '').toString(),
          load: (newSet.target_load_kg ?? '').toString(),
          duration: (newSet.target_duration_seconds ?? '').toString(),
        },
      }));

      setSession((prev) => {
        if (!prev || !prev.exercises) return prev;
        const newExercises = prev.exercises.map((ex) => {
          if (ex.id === sessionEx.id) {
            return {
              ...ex,
              target_sets: ex.target_sets + 1,
              sets: [...ex.sets, newSet],
            };
          }
          return ex;
        });
        return {
          ...prev,
          exercises: newExercises,
          planned_sets_count: (prev.planned_sets_count || 0) + 1,
        };
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add extra set');
    }
  };

  // Open add exercise modal
  const handleOpenAddExercise = async () => {
    try {
      const exList = await api.get<Exercise[]>('/api/exercises');
      setExercisesList(exList);
      if (exList.length > 0) {
        setSelectedExerciseId(exList[0].id);
      }
      setAddExerciseModalOpen(true);
    } catch (err: any) {
      alert('Failed to load exercises');
    }
  };

  // Add exercise to session
  const handleConfirmAddExercise = async () => {
    if (!session || !selectedExerciseId) return;

    try {
      const addedExercise = await api.post<SessionExercise>(`/api/sessions/${session.id}/add-exercise`, {
        exercise_id: selectedExerciseId,
        target_sets: newExerciseSets,
      });

      // Populate inputs for new sets
      const newInputs: Record<string, { reps: string; load: string; duration: string }> = {};
      for (const s of addedExercise.sets) {
        newInputs[s.id] = {
          reps: (s.target_reps_max ?? s.target_reps_min ?? '').toString(),
          load: (s.target_load_kg ?? '').toString(),
          duration: (s.target_duration_seconds ?? '').toString(),
        };
      }
      setSetInputs((prev) => ({ ...prev, ...newInputs }));

      setSession((prev) => {
        if (!prev) return prev;
        const currentExercises = prev.exercises || [];
        return {
          ...prev,
          exercises: [...currentExercises, addedExercise],
          planned_sets_count: (prev.planned_sets_count || 0) + addedExercise.sets.length,
        };
      });

      setAddExerciseModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add exercise');
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!session) return;
    try {
      await api.put(`/api/sessions/${session.id}/notes`, { notes: workoutNotes });
    } catch (err) {
      console.error('Failed to save notes', err);
    }
  };

  // Finish session
  const handleFinishWorkout = async () => {
    if (!session) return;
    try {
      await api.post(`/api/sessions/${session.id}/finish`, { notes: workoutNotes });
      setFinishModalOpen(false);
      if (outlet?.refreshActiveSession) {
        await outlet.refreshActiveSession();
      }
      navigate('/history');
    } catch (err: any) {
      alert(err.message || 'Failed to complete session');
    }
  };

  // Cancel session
  const handleCancelWorkout = async () => {
    if (!session) return;
    try {
      await api.post(`/api/sessions/${session.id}/cancel`, { notes: workoutNotes });
      setCancelModalOpen(false);
      if (outlet?.refreshActiveSession) {
        await outlet.refreshActiveSession();
      }
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading workout session...</p>
        </div>
      </div>
    );
  }

  // If no active session, show Start Workout selector
  if (!session) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20 mb-4">
            <Play className="w-8 h-8 ml-1" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Ready to Train?
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base max-w-md mx-auto">
            Choose a routine template to follow or start an ad-hoc session to log as you go.
          </p>

          <button
            onClick={() => handleStartWorkout(null)}
            className="mt-6 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Start Blank Ad-hoc Workout
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white px-1">
            Or Choose a Workout Template:
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 transition cursor-pointer flex flex-col justify-between"
                onClick={() => handleStartWorkout(t.id)}
              >
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {t.description || 'No description provided'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Dumbbell className="w-3.5 h-3.5" />
                    <span>{t.exercises?.length || 0} exercises</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  <span>Start this plan</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active workout view
  const completedSetsCount = session.completed_sets_count || 0;
  const plannedSetsCount = session.planned_sets_count || 0;
  const progressPercent = plannedSetsCount > 0 ? Math.round((completedSetsCount / plannedSetsCount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Active Workout Header */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active Workout
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {session.template_name_snapshot}
          </h1>

          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Started: {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>•</span>
            <span>
              Progress: <strong className="text-slate-900 dark:text-white">{completedSetsCount}</strong> of {plannedSetsCount} sets ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFinishModalOpen(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-md shadow-emerald-600/20 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish Workout</span>
          </button>

          <button
            type="button"
            onClick={() => setCancelModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-700 dark:hover:bg-red-950/40 dark:text-slate-300 dark:hover:text-red-400 font-semibold rounded-xl text-sm transition"
            title="Cancel workout without saving"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Exercises & Sets Cards */}
      <div className="space-y-6">
        {session.exercises && session.exercises.length > 0 ? (
          session.exercises.map((sessionEx, exIndex) => {
            const isDuration = sessionEx.tracking_type_snapshot === 'duration';
            const loadMode = sessionEx.load_mode_snapshot;
            const loadBasis = sessionEx.load_basis_snapshot;
            const showLoad = loadMode !== 'none';

            return (
              <div
                key={sessionEx.id}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden"
              >
                {/* Exercise Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                      {exIndex + 1}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {sessionEx.exercise_name_snapshot}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="capitalize">{sessionEx.tracking_type_snapshot}</span>
                        {showLoad && (
                          <span>
                            • Load ({loadBasis === 'per_hand' ? 'per hand' : 'total'})
                          </span>
                        )}
                        <span>• Rest: {sessionEx.rest_seconds}s</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddExtraSet(sessionEx)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Set</span>
                  </button>
                </div>

                {/* Sets Table / Cards */}
                <div className="p-4 sm:p-5 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                        <th className="pb-2.5 px-2">Set</th>
                        <th className="pb-2.5 px-2">Target</th>
                        {showLoad && <th className="pb-2.5 px-2">Weight (kg)</th>}
                        <th className="pb-2.5 px-2">{isDuration ? 'Duration (s)' : 'Reps'}</th>
                        <th className="pb-2.5 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm">
                      {sessionEx.sets.map((setLog) => {
                        const input = setInputs[setLog.id] || { reps: '', load: '', duration: '' };
                        const isCompleted = setLog.status === 'completed';
                        const isSkipped = setLog.status === 'skipped';
                        const isSaving = savingSetId === setLog.id;
                        const isJustSaved = savedFeedbackSetId === setLog.id;

                        // Target label
                        let targetLabel = '';
                        if (isDuration) {
                          targetLabel = `${setLog.target_duration_seconds ?? 60}s`;
                        } else if (setLog.target_reps_min !== null && setLog.target_reps_max !== null) {
                          targetLabel =
                            setLog.target_reps_min === setLog.target_reps_max
                              ? `${setLog.target_reps_min}`
                              : `${setLog.target_reps_min}-${setLog.target_reps_max}`;
                        } else if (setLog.target_reps_max !== null) {
                          targetLabel = `${setLog.target_reps_max}`;
                        } else {
                          targetLabel = 'As many';
                        }
                        if (showLoad && setLog.target_load_kg) {
                          targetLabel += ` @ ${setLog.target_load_kg}kg`;
                        }

                        return (
                          <tr
                            key={setLog.id}
                            className={`transition-colors ${
                              isCompleted
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                : isSkipped
                                ? 'bg-slate-50 dark:bg-slate-900/40 opacity-60'
                                : ''
                            }`}
                          >
                            {/* Set Number */}
                            <td className="py-3 px-2 font-bold text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <span>{setLog.set_number}</span>
                                {isJustSaved && (
                                  <span className="text-[10px] text-emerald-600 font-bold animate-bounce">
                                    Saved!
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Target info */}
                            <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {targetLabel}
                            </td>

                            {/* Weight input (if applicable) */}
                            {showLoad && (
                              <td className="py-3 px-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  disabled={isCompleted || isSkipped || isSaving}
                                  value={input.load}
                                  onChange={(e) => handleInputChange(setLog.id, 'load', e.target.value)}
                                  placeholder="0.0"
                                  className="w-20 px-2.5 py-1.5 text-center font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                />
                              </td>
                            )}

                            {/* Reps or Duration input */}
                            <td className="py-3 px-2">
                              {isDuration ? (
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  disabled={isCompleted || isSkipped || isSaving}
                                  value={input.duration}
                                  onChange={(e) => handleInputChange(setLog.id, 'duration', e.target.value)}
                                  placeholder="secs"
                                  className="w-20 px-2.5 py-1.5 text-center font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                />
                              ) : (
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  disabled={isCompleted || isSkipped || isSaving}
                                  value={input.reps}
                                  onChange={(e) => handleInputChange(setLog.id, 'reps', e.target.value)}
                                  placeholder="reps"
                                  className="w-20 px-2.5 py-1.5 text-center font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                />
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isCompleted ? (
                                  <button
                                    type="button"
                                    onClick={() => handleResetSetToPending(sessionEx, setLog)}
                                    disabled={isSaving}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 flex items-center gap-1 transition"
                                    title="Click to edit set"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Done</span>
                                  </button>
                                ) : isSkipped ? (
                                  <button
                                    type="button"
                                    onClick={() => handleResetSetToPending(sessionEx, setLog)}
                                    disabled={isSaving}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 flex items-center gap-1 transition"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Skipped</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleCompleteSet(sessionEx, setLog)}
                                      disabled={isSaving}
                                      className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-sm disabled:opacity-50"
                                      title="Mark completed"
                                    >
                                      <Check className="w-4 h-4" />
                                      <span className="hidden sm:inline">Check</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSkipSet(sessionEx, setLog)}
                                      disabled={isSaving}
                                      className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium transition"
                                      title="Skip set"
                                    >
                                      <SkipForward className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
            <Dumbbell className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No exercises added to this workout yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your first exercise to start recording sets.
            </p>
          </div>
        )}
      </div>

      {/* Add Exercise Mid-Workout CTA */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleOpenAddExercise}
          className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold text-sm shadow-sm transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Exercise to This Workout</span>
        </button>
      </div>

      {/* Workout Notes Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Notes</h3>
        </div>
        <textarea
          rows={3}
          value={workoutNotes}
          onChange={(e) => setWorkoutNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="How did this workout feel? Notes on energy, weights, or technique..."
          className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <div className="text-[11px] text-slate-400 mt-1.5 text-right">
          Auto-saves when you click away
        </div>
      </div>

      {/* Add Exercise Modal */}
      <Modal
        isOpen={addExerciseModalOpen}
        onClose={() => setAddExerciseModalOpen(false)}
        title="Add Exercise to Active Workout"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Select Exercise
            </label>
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {exercisesList.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.category} • {ex.tracking_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Target Sets
            </label>
            <input
              type="number"
              min="1"
              max="15"
              value={newExerciseSets}
              onChange={(e) => setNewExerciseSets(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setAddExerciseModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAddExercise}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
            >
              Add Exercise
            </button>
          </div>
        </div>
      </Modal>

      {/* Finish Workout Summary Modal */}
      <Modal
        isOpen={finishModalOpen}
        onClose={() => setFinishModalOpen(false)}
        title="Complete Workout"
      >
        <div className="space-y-5">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">
              Workout Summary
            </h4>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-200/60 dark:border-emerald-800/60 text-sm">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Completed Sets</span>
                <span className="font-extrabold text-lg text-emerald-700 dark:text-emerald-300">
                  {completedSetsCount} / {plannedSetsCount}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Exercises</span>
                <span className="font-extrabold text-lg text-emerald-700 dark:text-emerald-300">
                  {session.exercises?.length || 0}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Final Notes / Reflections
            </label>
            <textarea
              rows={2}
              value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)}
              placeholder="Session notes..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFinishModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
            >
              Keep Training
            </button>
            <button
              type="button"
              onClick={handleFinishWorkout}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Save & Finish
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Workout Confirmation */}
      <ConfirmDialog
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelWorkout}
        title="Cancel Active Workout?"
        message="Are you sure you want to cancel this workout? It will be marked as cancelled in your history, but uncompleted sets will not count towards your stats."
        confirmText="Yes, Cancel Workout"
        cancelText="Continue Workout"
      />
    </div>
  );
};
