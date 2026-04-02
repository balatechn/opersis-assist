'use client';

import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">Manage your preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Profile</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-surface-500 dark:text-surface-400">Name</dt>
            <dd className="text-surface-900 dark:text-white font-medium">{user?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-surface-500 dark:text-surface-400">Email</dt>
            <dd className="text-surface-900 dark:text-white font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-surface-500 dark:text-surface-400">Role</dt>
            <dd className="text-surface-900 dark:text-white font-medium capitalize">{user?.role}</dd>
          </div>
        </dl>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">Theme</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Switch between light and dark mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 text-sm bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-all duration-200"
          >
            {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
        </div>
      </div>

      {/* Agent Install */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Agent Installation</h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
          Install the Opersis Assist agent on your Windows machines to start monitoring.
        </p>
        <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 font-mono text-xs text-surface-700 dark:text-surface-300 overflow-x-auto">
          <p className="text-surface-400 mb-1"># 1. Clone agent on target machine</p>
          <p>git clone &lt;your-repo&gt;/agent</p>
          <p className="text-surface-400 mt-2 mb-1"># 2. Configure</p>
          <p>cp .env.example .env</p>
          <p>nano .env  # Set SERVER_URL and AGENT_SECRET</p>
          <p className="text-surface-400 mt-2 mb-1"># 3. Install dependencies</p>
          <p>npm install</p>
          <p className="text-surface-400 mt-2 mb-1"># 4. Run (or install as Windows service)</p>
          <p>npm start</p>
          <p>npm run install-service  # Windows service</p>
        </div>
      </div>
    </div>
  );
}
