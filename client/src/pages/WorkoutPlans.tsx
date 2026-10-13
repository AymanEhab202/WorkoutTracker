import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  WorkoutTemplate,
  TemplateExercise,
  Exercise,
  WeeklyScheduleConfig,
} from '@shared/types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  CalendarCheck,
  Plus,
  Play,
  Edit2,
  Trash2,
  Archive,
  ArrowUp,
  ArrowDown,
  Dumbbell,
  Clock,
  Save,
  CheckCircle2,
} from 'lucide-react';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const WorkoutPlans: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [schedule, setSchedule] = useState<WeeklyScheduleConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'schedule'>('templates');

  // Create/Edit Template Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [templateDesc, setTemplateDesc] = useState<string>('');
  const [templateExercises, setTemplateExercises] = useState<
    Array<{
      exercise_id: string;
      position: number;
      target_sets: number;
      target_reps_min: number | null;
      target_reps_max: number | null;
      target_duration_seconds: number | null;
      target_load_kg: number | null;
      rest_seconds: number;
      notes: string | null;
    }>
  >([]);

  // Selected exercise to add in modal
  const [exerciseToAdd, setExerciseToAdd] = useState<string>('');

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<WorkoutTemplate | null>(null);

  // Schedule editor state
  const [scheduleAssignments, setScheduleAssignments] = useState<Record<number, string | null>>({});
  const [targetFrequency, setTargetFrequency] = useState<number>(4);
  const [scheduleSavedFeedback, setScheduleSavedFeedback] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tpls, exList, sched] = await Promise.all([
        api.get<WorkoutTemplate[]>('/api/templates'),
        api.get<Exercise[]>('/api/exercises'),
        api.get<WeeklyScheduleConfig>('/api/schedule'),
      ]);
      setTemplates(tpls);
      setExercises(exList);
      setSchedule(sched);

      const assignMap: Record<number, string | null> = {};
      for (const entry of sched.entries) {
        assignMap[entry.weekday] = entry.template_id;
      }
      setScheduleAssignments(assignMap);
      setTargetFrequency(sched.target_frequency);
    } catch (err) {
      console.error('Failed to load templates and schedule', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDesc('');
    setTemplateExercises([]);
    if (exercises.length > 0) setExerciseToAdd(exercises[0].id);
    setModalOpen(true);
  };

  const handleOpenEditTemplate = (t: WorkoutTemplate) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateDesc(t.description || '');
    setTemplateExercises(
      (t.exercises || []).map((te, idx) => ({
        exercise_id: te.exercise_id,
        position: idx,
        target_sets: te.target_sets,
        target_reps_min: te.target_reps_min,
        target_reps_max: te.target_reps_max,
        target_duration_seconds: te.target_duration_seconds,
        target_load_kg: te.target_load_kg,
        rest_seconds: te.rest_seconds || 60,
        notes: te.notes,
      }))
    );
    if (exercises.length > 0) setExerciseToAdd(exercises[0].id);
    setModalOpen(true);
  };

  const handleAddExerciseToTemplate = () => {
    if (!exerciseToAdd) return;
    const exObj = exercises.find((e) => e.id === exerciseToAdd);
    if (!exObj) return;

    setTemplateExercises((prev) => [
      ...prev,
      {
        exercise_id: exObj.id,
        position: prev.length,
        target_sets: 3,
        target_reps_min: exObj.tracking_type === 'reps' ? 8 : null,
        target_reps_max: exObj.tracking_type === 'reps' ? 12 : null,
        target_duration_seconds: exObj.tracking_type === 'duration' ? 60 : null,
        target_load_kg: null,
        rest_seconds: 60,
        notes: null,
      },
    ]);
  };

  const handleRemoveExerciseFromTemplate = (idx: number) => {
    setTemplateExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveExercise = (idx: number, direction: 'up' | 'down') => {
    setTemplateExercises((prev) => {
      const copy = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= copy.length) return prev;
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((item, i) => ({ ...item, position: i }));
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      alert('Template name is required');
      return;
    }

    try {
      const payload = {
        name: templateName.trim(),
        description: templateDesc.trim() || null,
        exercises: templateExercises,
      };

      if (editingTemplate) {
        await api.put(`/api/templates/${editingTemplate.id}`, payload);
      } else {
        await api.post('/api/templates', payload);
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    }
  };

  const handleStartWorkoutFromTemplate = async (templateId: string) => {
    try {
      await api.post('/api/sessions/start', { template_id: templateId });
      navigate('/workout/active');
    } catch (err: any) {
      alert(err.message || 'Failed to start session');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/templates/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete template');
    }
  };

  const handleSaveSchedule = async () => {
    try {
      const entries = Object.entries(scheduleAssignments).map(([weekday, tplId]) => ({
        weekday: parseInt(weekday, 10),
        template_id: tplId || null,
        position: 0,
        active: 1,
      }));

      await api.put('/api/schedule', {
        entries,
        target_frequency: targetFrequency,
      });

      setScheduleSavedFeedback(true);
      setTimeout(() => setScheduleSavedFeedback(false), 2500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save schedule');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Workout Plans & Schedule
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Build routines and assign them to days of the week.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'templates' && (
            <button
              onClick={handleOpenCreateTemplate}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Template</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>Routines & Templates ({templates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === 'schedule'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Weekly Schedule</span>
        </button>
      </div>

      {/* Tab 1: Workout Templates List */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Loading templates...</div>
          ) : templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                          {t.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {t.description || 'No description provided.'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleStartWorkoutFromTemplate(t.id)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 flex-shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" /> Start
                      </button>
                    </div>

                    {/* Exercises Summary List */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Exercises ({t.exercises?.length || 0})
                      </span>

                      {t.exercises && t.exercises.length > 0 ? (
                        <div className="space-y-1.5">
                          {t.exercises.map((te, idx) => (
                            <div
                              key={te.id}
                              className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300"
                            >
                              <span className="font-medium truncate max-w-[200px]">
                                {idx + 1}. {te.exercise_name}
                              </span>
                              <span className="font-mono text-slate-500 text-[11px]">
                                {te.target_sets} sets •{' '}
                                {te.target_duration_seconds
                                  ? `${te.target_duration_seconds}s`
                                  : te.target_reps_min && te.target_reps_max
                                  ? `${te.target_reps_min}-${te.target_reps_max} reps`
                                  : `${te.target_reps_max || te.target_reps_min || 'Any'} reps`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No exercises added to this template.</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditTemplate(t)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
              <Dumbbell className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300">No workout templates yet</h3>
              <p className="text-xs text-slate-500 mt-1">Create routines like Push/Pull/Legs or Upper/Lower.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Weekly Schedule */}
      {activeTab === 'schedule' && (
        <div className="max-w-2xl bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Weekly Workout Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign routines to specific days. The Dashboard uses this to feature today's workout.
            </p>
          </div>

          {/* Weekly Frequency Target Goal */}
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                Weekly Frequency Goal
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                How many days per week do you plan to train?
              </span>
            </div>
            <select
              value={targetFrequency}
              onChange={(e) => setTargetFrequency(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 text-sm font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <option key={num} value={num}>
                  {num} workouts / week
                </option>
              ))}
            </select>
          </div>

          {/* Weekday Template Selectors */}
          <div className="space-y-3">
            {WEEKDAYS.map((dayName, weekdayIndex) => (
              <div
                key={weekdayIndex}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 gap-3"
              >
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 w-28">
                  {dayName}
                </span>

                <select
                  value={scheduleAssignments[weekdayIndex] || ''}
                  onChange={(e) =>
                    setScheduleAssignments({
                      ...scheduleAssignments,
                      [weekdayIndex]: e.target.value || null,
                    })
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Rest Day (No Workout)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
            {scheduleSavedFeedback ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Schedule saved successfully!
              </span>
            ) : (
              <span />
            )}

            <button
              onClick={handleSaveSchedule}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Schedule
            </button>
          </div>
        </div>
      )}

      {/* Template Create/Edit Modal with Interactive Exercise Builder */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? 'Edit Workout Template' : 'Create Workout Template'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTemplate} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Upper Body Strength"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Focus on chest pressing power and back hypertrophy."
            />
          </div>

          {/* Exercise Builder in Modal */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Exercises in this Routine ({templateExercises.length})
              </span>
            </div>

            {/* List of current exercises */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {templateExercises.map((te, idx) => {
                const exObj = exercises.find((e) => e.id === te.exercise_id);
                const isDuration = exObj?.tracking_type === 'duration';

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {idx + 1}. {exObj?.name || 'Exercise'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveExercise(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === templateExercises.length - 1}
                          onClick={() => handleMoveExercise(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveExerciseFromTemplate(idx)}
                          className="p-1 text-red-500 hover:text-red-700 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Exercise target inputs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Target Sets</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={te.target_sets}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setTemplateExercises((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, target_sets: val } : item))
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                        />
                      </div>

                      {isDuration ? (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Duration (s)</label>
                          <input
                            type="number"
                            min="1"
                            value={te.target_duration_seconds ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value, 10) : null;
                              setTemplateExercises((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, target_duration_seconds: val } : item))
                              );
                            }}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                            placeholder="60"
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Min Reps</label>
                            <input
                              type="number"
                              min="0"
                              value={te.target_reps_min ?? ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                                setTemplateExercises((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, target_reps_min: val } : item))
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                              placeholder="8"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Max Reps</label>
                            <input
                              type="number"
                              min="0"
                              value={te.target_reps_max ?? ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                                setTemplateExercises((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, target_reps_max: val } : item))
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                              placeholder="12"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Rest (s)</label>
                        <input
                          type="number"
                          min="0"
                          value={te.rest_seconds}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 60;
                            setTemplateExercises((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, rest_seconds: val } : item))
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selector to add exercise */}
            <div className="flex items-center gap-2 pt-2">
              <select
                value={exerciseToAdd}
                onChange={(e) => setExerciseToAdd(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.category})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddExerciseToTemplate}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
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
              Save Template
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete template dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Workout Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Historical workout records will preserve their data.`}
      />
    </div>
  );
};
