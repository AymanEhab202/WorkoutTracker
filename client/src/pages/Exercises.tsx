import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Exercise, TrackingType, LoadMode, LoadBasis } from '@shared/types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Dumbbell,
  Plus,
  Search,
  Filter,
  Archive,
  RotateCcw,
  Trash2,
  Edit2,
  Info,
  Check,
} from 'lucide-react';

export const Exercises: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Create/Edit Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Chest',
    tracking_type: 'reps' as TrackingType,
    load_mode: 'none' as LoadMode,
    load_basis: 'total' as LoadBasis,
    instructions: '',
  });

  // Delete Confirm Dialog state
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [exList, catList] = await Promise.all([
        api.get<Exercise[]>(`/api/exercises?includeArchived=${showArchived}`),
        api.get<string[]>('/api/exercises/categories'),
      ]);
      setExercises(exList);
      setCategories(catList);
    } catch (err) {
      console.error('Failed to load exercises', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [showArchived]);

  const handleOpenCreate = () => {
    setEditingExercise(null);
    setFormData({
      name: '',
      category: categories[0] || 'Chest',
      tracking_type: 'reps',
      load_mode: 'none',
      load_basis: 'total',
      instructions: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (ex: Exercise) => {
    setEditingExercise(ex);
    setFormData({
      name: ex.name,
      category: ex.category,
      tracking_type: ex.tracking_type,
      load_mode: ex.load_mode,
      load_basis: ex.load_basis,
      instructions: ex.instructions || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExercise) {
        await api.put(`/api/exercises/${editingExercise.id}`, formData);
      } else {
        await api.post('/api/exercises', formData);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save exercise');
    }
  };

  const handleArchiveToggle = async (ex: Exercise) => {
    try {
      if (ex.archived_at) {
        await api.post(`/api/exercises/${ex.id}/unarchive`);
      } else {
        await api.post(`/api/exercises/${ex.id}/archive`);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update exercise archive status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteError(null);
      await api.delete(`/api/exercises/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      setDeleteError(err.message);
    }
  };

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Exercise Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Define tracking parameters, muscle groups, and movement instructions.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Exercise</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises by name..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Show Archived Toggle */}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none px-2 py-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span>Show Archived</span>
        </label>
      </div>

      {/* Exercise Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading exercises...</div>
      ) : filteredExercises.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((ex) => (
            <div
              key={ex.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                ex.archived_at
                  ? 'bg-slate-100/60 dark:bg-slate-800/40 border-dashed border-slate-300 dark:border-slate-700 opacity-75'
                  : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                    {ex.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                    {ex.category}
                  </span>
                </div>

                {/* Metadata badges */}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Tracks: {ex.tracking_type === 'reps' ? 'Repetitions' : 'Duration (seconds)'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Load: {ex.load_mode} ({ex.load_basis === 'per_hand' ? 'per hand' : 'total'})
                  </span>
                </div>

                {ex.instructions && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-3">
                    {ex.instructions}
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {ex.archived_at ? 'Archived' : 'Active'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(ex)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    title="Edit exercise"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleArchiveToggle(ex)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    title={ex.archived_at ? 'Restore exercise' : 'Archive exercise'}
                  >
                    {ex.archived_at ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(ex);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                    title="Delete exercise"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <Dumbbell className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300">No exercises found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search or category filter.</p>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExercise ? 'Edit Exercise' : 'Add New Exercise'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Exercise Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Incline Dumbbell Press"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Muscle Group / Category
            </label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Chest, Back, Legs, Core"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Tracking Type
              </label>
              <select
                value={formData.tracking_type}
                onChange={(e) => setFormData({ ...formData, tracking_type: e.target.value as TrackingType })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="reps">Reps (Repetitions)</option>
                <option value="duration">Duration (Hold/Time in seconds)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                External Load
              </label>
              <select
                value={formData.load_mode}
                onChange={(e) => setFormData({ ...formData, load_mode: e.target.value as LoadMode })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="none">None (Bodyweight)</option>
                <option value="optional">Optional (e.g. Weighted Pull-ups)</option>
                <option value="required">Required (e.g. Dumbbells, Barbell)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Load Measurement Basis
            </label>
            <select
              value={formData.load_basis}
              onChange={(e) => setFormData({ ...formData, load_basis: e.target.value as LoadBasis })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="total">Total Weight (e.g. Barbell or total plate load)</option>
              <option value="per_hand">Per Hand (e.g. 20kg dumbbell in each hand)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Instructions & Form Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Cue neutral spine, elbow angles, foot placement..."
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
              Save Exercise
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Archive Warning Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Exercise"
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete "${deleteTarget?.name}"? If this exercise is referenced in any workout history, deletion is blocked and it should be archived instead.`
        }
        confirmText="Attempt Delete"
        cancelText="Cancel"
      />
    </div>
  );
};
