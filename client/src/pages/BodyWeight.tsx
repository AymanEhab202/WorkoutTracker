import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { BodyWeightEntry, Goal } from '@shared/types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatCard } from '../components/StatCard';
import {
  Scale,
  Plus,
  TrendingDown,
  TrendingUp,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export const BodyWeight: React.FC = () => {
  const [entries, setEntries] = useState<BodyWeightEntry[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [weightGoal, setWeightGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<BodyWeightEntry | null>(null);
  const [weightInput, setWeightInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().slice(0, 16));
  const [notesInput, setNotesInput] = useState<string>('');

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<BodyWeightEntry | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [listRes, historyRes, statsRes, goalsRes] = await Promise.all([
        api.get<BodyWeightEntry[]>('/api/body-weight'),
        api.get<any[]>('/api/body-weight/history'),
        api.get<any>('/api/body-weight/stats'),
        api.get<Goal[]>('/api/goals'),
      ]);

      setEntries(listRes);
      setStats(statsRes);

      // Find active body weight goal if any
      const bwGoal = goalsRes.find((g) => g.goal_type === 'body_weight' && g.status === 'active');
      setWeightGoal(bwGoal || null);

      // Format chart data: oldest to newest
      const formattedChart = historyRes.map((item) => ({
        date: item.measured_at.split('T')[0],
        weight: item.weight_kg,
        rollingAvg: item.rolling_7d_avg,
      }));
      setChartData(formattedChart);
    } catch (err) {
      console.error('Failed to load body weight data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setWeightInput(stats?.current ? stats.current.toString() : '');
    setDateInput(new Date().toISOString().slice(0, 16));
    setNotesInput('');
    setModalOpen(true);
  };

  const handleOpenEdit = (entry: BodyWeightEntry) => {
    setEditingEntry(entry);
    setWeightInput(entry.weight_kg.toString());
    setDateInput(new Date(entry.measured_at).toISOString().slice(0, 16));
    setNotesInput(entry.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = parseFloat(weightInput);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      alert('Please enter a valid weight in kg');
      return;
    }

    try {
      const payload = {
        weight_kg: parsedWeight,
        measured_at: new Date(dateInput).toISOString(),
        notes: notesInput.trim() || null,
      };

      if (editingEntry) {
        await api.put(`/api/body-weight/${editingEntry.id}`, payload);
      } else {
        await api.post('/api/body-weight', payload);
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save measurement');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/body-weight/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete measurement');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Body Weight Tracker
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log morning weigh-ins, view rolling 7-day averages, and track goal milestones.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log Weight</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Weight"
          value={stats?.current ? `${stats.current} kg` : 'No data'}
          subtitle={stats?.current_date ? new Date(stats.current_date).toLocaleDateString() : undefined}
          icon={<Scale className="w-5 h-5" />}
        />

        <StatCard
          title="Change from Start"
          value={
            stats?.change_from_first !== null && stats?.change_from_first !== undefined
              ? `${stats.change_from_first > 0 ? '+' : ''}${stats.change_from_first} kg`
              : '—'
          }
          subtitle="Net change across all logs"
          icon={
            stats?.change_from_first < 0 ? (
              <TrendingDown className="w-5 h-5" />
            ) : (
              <TrendingUp className="w-5 h-5" />
            )
          }
          trend={stats?.trend === 'insufficient_data' ? undefined : stats?.trend}
          trendLabel={stats?.trend}
        />

        <StatCard
          title="7-Day Rolling Avg"
          value={stats?.rolling_7d_average ? `${stats.rolling_7d_average} kg` : 'Need 3+ logs'}
          subtitle="Smoothes daily water fluctuations"
          icon={<Clock className="w-5 h-5" />}
        />

        <StatCard
          title="Weight Goal Progress"
          value={
            weightGoal
              ? `${weightGoal.progress_percent}%`
              : 'No Active Goal'
          }
          subtitle={
            weightGoal
              ? `Target: ${weightGoal.target_value} kg`
              : 'Create one in Goals tab'
          }
          icon={<Target className="w-5 h-5" />}
        />
      </div>

      {/* Weight History Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Body Weight Progression & 7-Day Rolling Trend
          </h2>
          <p className="text-xs text-slate-500">
            Solid line shows actual daily weigh-ins; dashed line displays 7-day rolling average.
          </p>
        </div>

        {chartData.length > 0 ? (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  unit=" kg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    `${val} kg`,
                    name === 'weight' ? 'Measured Weight' : '7-Day Rolling Average',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  formatter={(value) =>
                    value === 'weight' ? 'Measured Weight (kg)' : '7-Day Rolling Average (kg)'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="rollingAvg"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Scale className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No weight measurements recorded yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Click "Log Weight" above to start building your body-weight history.
            </p>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Measurement Log ({entries.length})
        </h3>

        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Weight (kg)</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {new Date(entry.measured_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {entry.weight_kg} kg
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {entry.notes || '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Edit measurement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Delete measurement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No logs recorded yet.</p>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEntry ? 'Edit Weight Log' : 'Log Body Weight'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Weight (Kilograms)
            </label>
            <input
              type="number"
              step="0.1"
              min="20"
              max="400"
              required
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
              placeholder="e.g. 78.5"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Measurement Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Morning fasted weigh-in"
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
              Save Measurement
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Measurement"
        message={`Delete weigh-in record of ${deleteTarget?.weight_kg} kg on ${
          deleteTarget?.measured_at ? new Date(deleteTarget.measured_at).toLocaleDateString() : ''
        }?`}
      />
    </div>
  );
};
