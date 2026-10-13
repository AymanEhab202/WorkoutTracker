import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [backupsList, setBackupsList] = useState<Array<{ filename: string; created_at: string; size_bytes: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [backupActionStatus, setBackupActionStatus] = useState<string | null>(null);

  // Integrity status
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState<boolean>(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState<boolean>(false);

  // JSON Restore state
  const [restoreJsonPayload, setRestoreJsonPayload] = useState<any | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const list = await api.get<any[]>('/api/backup/list');
      setBackupsList(list);
    } catch (err) {
      console.error('Failed to load backups list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateSqliteBackup = async () => {
    try {
      setBackupActionStatus('Creating safe SQLite backup...');
      const res = await api.post<any>('/api/backup/sqlite');
      setBackupActionStatus(`Backup created: ${res.backup.filename}`);
      setTimeout(() => setBackupActionStatus(null), 3500);
      loadBackups();
    } catch (err: any) {
      alert(err.message || 'Failed to create backup');
      setBackupActionStatus(null);
    }
  };

  const handleExportJson = () => {
    window.location.href = '/api/backup/export';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.version || !parsed.exercises || !parsed.workout_sessions) {
          alert('Invalid workout tracker backup JSON format.');
          return;
        }
        setRestoreJsonPayload(parsed);
        setRestoreConfirmOpen(true);
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreJsonPayload) return;
    try {
      setRestoring(true);
      const res = await api.post<any>('/api/backup/restore', restoreJsonPayload);
      setRestoreConfirmOpen(false);
      setRestoreJsonPayload(null);
      setRestoreSuccess(`Restored successfully! Automatic pre-restore snapshot saved: ${res.pre_restore_backup}`);
      loadBackups();
    } catch (err: any) {
      alert(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleCheckIntegrity = async () => {
    try {
      setCheckingIntegrity(true);
      const res = await api.get<any>('/api/backup/integrity');
      setIntegrityStatus(res.integrity_check ? 'Database is healthy (PRAGMA integrity_check: ok)' : 'Warning: Database integrity issues detected.');
    } catch (err: any) {
      setIntegrityStatus('Error checking database integrity');
    } finally {
      setCheckingIntegrity(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    try {
      setPasswordLoading(true);
      await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Settings & Data Backup
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your local database, create snapshots, export records, and configure network access.
        </p>
      </div>

      {/* Backup and Restore Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Database Snapshots & Exports
            </h2>
            <p className="text-xs text-slate-500">
              Your database is stored locally at <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[11px]">data/workout_tracker.db</code>.
            </p>
          </div>
        </div>

        {backupActionStatus && (
          <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{backupActionStatus}</span>
          </div>
        )}

        {restoreSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Create SQLite Backup */}
          <button
            onClick={handleCreateSqliteBackup}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left transition flex flex-col justify-between"
          >
            <div>
              <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Create SQLite Backup
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Creates an atomic, consistent SQLite snapshot in <code className="text-[11px]">data/backups/</code>.
              </p>
            </div>
            <span className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Snapshot Database →
            </span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left transition flex flex-col justify-between"
          >
            <div>
              <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Export Data (JSON)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Download a clean, structured JSON file of all exercises, routines, sessions, and logs.
              </p>
            </div>
            <span className="mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Download JSON →
            </span>
          </button>

          {/* Restore JSON */}
          <label className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-left transition flex flex-col justify-between cursor-pointer">
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <div>
              <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Restore From JSON
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload a JSON backup file. Automatically takes a safety backup before applying.
              </p>
            </div>
            <span className="mt-4 text-xs font-bold text-amber-600 dark:text-amber-400">
              Select Backup File →
            </span>
          </label>
        </div>

        {/* Database Integrity Check */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Database Health Check
            </span>
            <span className="text-slate-500">
              {integrityStatus || 'Run SQLite verification to confirm index and page consistency.'}
            </span>
          </div>

          <button
            onClick={handleCheckIntegrity}
            disabled={checkingIntegrity}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} />
            <span>{checkingIntegrity ? 'Verifying...' : 'Verify SQLite Integrity'}</span>
          </button>
        </div>

        {/* Backups List */}
        {backupsList.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Existing Snapshots in data/backups/
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {backupsList.map((b) => (
                <div
                  key={b.filename}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs font-mono"
                >
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-sm">
                    {b.filename}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {(b.size_bytes / 1024).toFixed(1)} KB • {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Local Network Access Guide */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Trusted Local-Network Access (LAN)
            </h2>
            <p className="text-xs text-slate-500">
              Access Workout Tracker from your smartphone or tablet on the same home Wi-Fi network.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            By default, the server binds to <code className="font-mono font-bold text-indigo-600">127.0.0.1</code> (accessible only from this PC).
          </p>
          <div className="space-y-2">
            <p className="font-bold text-slate-900 dark:text-white">
              To enable trusted network access:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                Set the environment variable <code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">HOST=0.0.0.0</code> in your <code className="font-mono">.env</code> file.
              </li>
              <li>
                Find this PC's local Wi-Fi/Ethernet IPv4 address (e.g. run <code className="font-mono">ipconfig</code> in PowerShell, usually looks like <code className="font-mono">192.168.1.X</code>).
              </li>
              <li>
                Ensure Windows Defender Firewall allows incoming connections on port <code className="font-mono">3000</code> for <strong>Private Networks</strong>.
              </li>
              <li>
                On your phone or tablet connected to the same Wi-Fi, open <code className="font-mono font-bold text-indigo-600">http://&lt;YOUR-PC-IP&gt;:3000</code>.
              </li>
              <li>
                Log in using your owner username and password. Sessions are securely authenticated across your LAN.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Account & Password Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Owner Security & Password
            </h2>
            <p className="text-xs text-slate-500">
              Logged in as <strong className="text-slate-900 dark:text-white">{user?.username}</strong>.
            </p>
          </div>
        </div>

        {passwordMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300'
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
          >
            {passwordLoading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Restore confirmation dialog */}
      <ConfirmDialog
        isOpen={restoreConfirmOpen}
        onClose={() => {
          setRestoreConfirmOpen(false);
          setRestoreJsonPayload(null);
        }}
        onConfirm={handleConfirmRestore}
        isLoading={restoring}
        title="Restore Personal Workout Data?"
        message="Restoring from backup will replace your current workout records with the data from this backup file. An automated recovery snapshot will be created immediately before restore so you can always roll back."
        confirmText="Confirm & Restore Data"
        cancelText="Cancel"
      />
    </div>
  );
};
