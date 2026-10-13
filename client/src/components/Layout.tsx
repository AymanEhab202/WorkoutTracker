import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { RestTimer } from './RestTimer';
import { api } from '../lib/api';
import { WorkoutSession } from '@shared/types';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const location = useLocation();

  const checkActiveSession = async () => {
    try {
      const res = await api.get<WorkoutSession | null>('/api/sessions/active');
      setActiveSession(res);
    } catch {
      setActiveSession(null);
    }
  };

  useEffect(() => {
    checkActiveSession();
    // Check every 15s in background
    const interval = setInterval(checkActiveSession, 15000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSessionId={activeSession?.id}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          activeSessionId={activeSession?.id}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet context={{ activeSession, refreshActiveSession: checkActiveSession }} />
        </main>
      </div>

      {/* Floating Rest Timer (visible globally during workouts) */}
      {activeSession && <RestTimer />}
    </div>
  );
};
