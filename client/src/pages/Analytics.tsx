import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AnalyticsData, Exercise } from '@shared/types';
import { StatCard } from '../components/StatCard';
import {
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  Dumbbell,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      let query = `/api/analytics?range=${range}`;
      if (selectedExerciseId) {
        query += `&exerciseId=${selectedExerciseId}`;
      }

      const [analyticsRes, exList] = await Promise.all([
        api.get<AnalyticsData>(query),
        api.get<Exercise[]>('/api/exercises'),
      ]);

      setData(analyticsRes);
      setExercises(exList);

      if (!selectedExerciseId && exList.length > 0) {
        setSelectedExerciseId(exList[0].id);
      }
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [range, selectedExerciseId]);

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Training Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Data-driven tracking of consistency, training volume, and strength progression.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-semibold self-start sm:self-auto">
          {(['7d', '30d', '90d', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                range === r
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Workouts"
          value={data?.summary.total_workouts || 0}
          subtitle={`Completed in ${range.toUpperCase()}`}
          icon={<Activity className="w-5 h-5" />}
        />

        <StatCard
          title="Completed Sets"
          value={data?.summary.total_completed_sets || 0}
          subtitle="Quality repetitions logged"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />

        <StatCard
          title="Total Training Time"
          value={`${data?.summary.total_duration_minutes || 0} min`}
          subtitle="Elapsed exercise duration"
          icon={<Clock className="w-5 h-5" />}
        />

        <StatCard
          title="Avg Session Length"
          value={`${data?.summary.avg_workout_duration_minutes || 0} min`}
          subtitle="Per completed workout"
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Consistency Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Weekly Workout Consistency
            </h2>
            <p className="text-xs text-slate-500">
              Workouts completed per calendar week vs target weekly frequency.
            </p>
          </div>

          {data?.weekly_consistency && data.weekly_consistency.length > 0 ? (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly_consistency} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                  <XAxis
                    dataKey="week_start"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      `${val} sessions`,
                      name === 'completed_workouts' ? 'Completed Workouts' : 'Target Frequency',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(v) => (v === 'completed_workouts' ? 'Completed Workouts' : 'Target Frequency')}
                  />
                  <Bar dataKey="completed_workouts" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="target_frequency" fill="#cbd5e1" radius={[6, 6, 0, 0]} opacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                No consistency records in this period
              </p>
            </div>
          )}
        </div>

        {/* Training Volume Chart (Sets & Reps) */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Training Volume Over Time
            </h2>
            <p className="text-xs text-slate-500">
              Completed sets and total reps performed across workout sessions.
            </p>
          </div>

          {data?.volume_over_time && data.volume_over_time.length > 0 ? (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.volume_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="completed_sets"
                    name="Completed Sets"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="planned_sets"
                    name="Planned Sets"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                No session volume records in this period
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Exercise Performance Progression Inspector */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Exercise Performance & Strength Progression
            </h2>
            <p className="text-xs text-slate-500">
              Track the historical progression of best reps, hold duration, or weight load.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {data?.exercise_progress && data.exercise_progress.data.length > 0 ? (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.exercise_progress.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {data.exercise_progress.tracking_type === 'duration' ? (
                  <Line
                    type="monotone"
                    dataKey="best_duration_seconds"
                    name="Best Duration (s)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="best_reps"
                      name="Best Reps"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="best_load_kg"
                      name="Best Load (kg)"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No completed sets recorded for this exercise yet
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Include this exercise in your workouts to see strength progress over time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
