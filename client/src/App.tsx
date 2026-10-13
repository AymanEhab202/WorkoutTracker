import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SetupOwner } from './pages/SetupOwner';
import { Dashboard } from './pages/Dashboard';
import { ActiveWorkout } from './pages/ActiveWorkout';
import { Exercises } from './pages/Exercises';
import { WorkoutPlans } from './pages/WorkoutPlans';
import { WorkoutHistory } from './pages/WorkoutHistory';
import { BodyWeight } from './pages/BodyWeight';
import { Goals } from './pages/Goals';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  const { isConfigured, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Starting Workout Tracker...</p>
        </div>
      </div>
    );
  }

  // First run owner creation
  if (!isConfigured) {
    return <SetupOwner />;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="workout/active" element={<ActiveWorkout />} />
        <Route path="plans" element={<WorkoutPlans />} />
        <Route path="history" element={<WorkoutHistory />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="weight" element={<BodyWeight />} />
        <Route path="goals" element={<Goals />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};
