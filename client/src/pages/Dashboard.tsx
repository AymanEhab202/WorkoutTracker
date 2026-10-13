import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardData } from '@shared/types';
import { StatCard } from '../components/StatCard';
import {
  PlayCircle,
  Activity,
  Flame,
  CheckCircle2,
  Trophy,
  Scale,
  Calendar,
  ArrowRight,
  TrendingUp,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [starting, setStarting] = useState<boolean>(false);
  const navigate = useNavigate();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleStartTodayWorkout = async (templateId?: string | null) => {
    try {
      setStarting(true);
      const session = await api.post<any>('/api/sessions/start', {
        template_id: templateId || null,
      });
      navigate('/workout/active');
    } catch (err: any) {
      alert(err.message || 'Failed to start workout');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading your workout dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Could not load dashboard data.</p>
      </div>
    );
  }

  const { today_workout, weekly_stats, latest_weight, active_goals, recent_personal_records, recent_activity_chart } = data;
  const activeSession = today_workout.active_session;
  const scheduledTemplate = today_workout.scheduled_template;

  return (
    <div className="space-y-8">
      {/* Top Banner / Call To Action */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
              <Calendar className="w-3.5 h-3.5" />
              <span>Today's Focus</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {activeSession
                ? `In Progress: ${activeSession.template_name_snapshot}`
                : scheduledTemplate
                ? scheduledTemplate.name
                : 'No Scheduled Workout Today'}
            </h1>
            <p className="mt-2 text-indigo-100 text-sm sm:text-base leading-relaxed">
              {activeSession
                ? 'You have an active workout in progress. Keep up the intensity and log your sets!'
                : scheduledTemplate?.description ||
                  'Start an ad-hoc session or follow one of your custom workout templates.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeSession ? (
              <button
                onClick={() => navigate('/workout/active')}
                className="px-6 py-3.5 rounded-2xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-lg flex items-center gap-2.5 text-sm"
              >
                <Activity className="w-5 h-5 text-emerald-600 animate-pulse" />
                <span>Resume Active Session</span>
              </button>
            ) : scheduledTemplate ? (
              <button
                disabled={starting}
                onClick={() => handleStartTodayWorkout(scheduledTemplate.id)}
                className="px-6 py-3.5 rounded-2xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-lg flex items-center gap-2.5 text-sm disabled:opacity-75"
              >
                <PlayCircle className="w-5 h-5" />
                <span>{starting ? 'Starting...' : `Start ${scheduledTemplate.name}`}</span>
              </button>
            ) : (
              <button
                disabled={starting}
                onClick={() => handleStartTodayWorkout(null)}
                className="px-6 py-3.5 rounded-2xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-lg flex items-center gap-2.5 text-sm disabled:opacity-75"
              >
                <PlayCircle className="w-5 h-5" />
                <span>{starting ? 'Starting...' : 'Start Quick Workout'}</span>
              </button>
            )}

            <button
              onClick={() => navigate('/plans')}
              className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition backdrop-blur-sm"
            >
              Browse Plans
            </button>
          </div>
        </div>

        {/* Decorative backdrop shapes */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Weekly Frequency"
          value={`${weekly_stats.completed_workouts} / ${weekly_stats.target_frequency}`}
          subtitle={`${weekly_stats.completion_rate}% of weekly target`}
          icon={<Flame className="w-5 h-5" />}
          trend={weekly_stats.completed_workouts >= weekly_stats.target_frequency ? 'up' : 'steady'}
          trendLabel={`${weekly_stats.completed_workouts} workouts this week`}
        />

        <StatCard
          title="Sets Completed"
          value={`${weekly_stats.completed_sets} / ${weekly_stats.planned_sets}`}
          subtitle="Recent planned vs completed"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />

        <StatCard
          title="Body Weight"
          value={latest_weight.current ? `${latest_weight.current} kg` : 'No logs'}
          subtitle={
            latest_weight.change_last_30d !== null
              ? `${latest_weight.change_last_30d > 0 ? '+' : ''}${latest_weight.change_last_30d} kg in 30 days`
              : 'Record weight in Body Weight tab'
          }
          icon={<Scale className="w-5 h-5" />}
          trend={latest_weight.trend === 'insufficient_data' ? undefined : latest_weight.trend}
          trendLabel={latest_weight.trend}
        />

        <StatCard
          title="Active Goals"
          value={active_goals.length}
          subtitle={
            active_goals.filter((g) => g.is_achieved).length > 0
              ? `${active_goals.filter((g) => g.is_achieved).length} goals achieved!`
              : 'Track strength & weight milestones'
          }
          icon={<Target className="w-5 h-5" />}
        />
      </div>

      {/* Middle Grid: Activity Chart & Active Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Workout Activity Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Training Activity
              </h2>
              <p className="text-xs text-slate-500">Sets completed per workout (Past 14 days)</p>
            </div>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Full Analytics <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recent_activity_chart.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recent_activity_chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    formatter={(value: any, name: any) => [
                      `${value} sets`,
                      'Completed Sets',
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="completed_sets" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Activity className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No recent workout activity yet
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Start logging your workouts to see visual progression trends right here.
              </p>
            </div>
          )}
        </div>

        {/* Active Goals Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Active Goals
            </h2>
            <button
              onClick={() => navigate('/goals')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="space-y-4 flex-1">
            {active_goals.length > 0 ? (
              active_goals.slice(0, 4).map((goal) => (
                <div key={goal.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-900 dark:text-white truncate max-w-[170px]">
                      {goal.title}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {goal.progress_percent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        goal.is_achieved ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, goal.progress_percent || 0)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>Current: {goal.current_value}</span>
                    <span>Target: {goal.target_value}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <Target className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No active goals set
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Create strength or body weight goals to track your milestones.
                </p>
                <button
                  onClick={() => navigate('/goals')}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition"
                >
                  + Add Goal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent PRs */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Personal Records
            </h2>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View History
          </button>
        </div>

        {recent_personal_records.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent_personal_records.map((pr, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    {pr.exercise_name}
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {pr.record_type === 'duration'
                      ? `${pr.value}s`
                      : pr.record_type === 'load'
                      ? `${pr.value} kg`
                      : `${pr.value} reps`}
                  </div>
                </div>
                <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-slate-500">
            Complete workouts to automatically set and celebrate personal records!
          </div>
        )}
      </div>
    </div>
  );
};
