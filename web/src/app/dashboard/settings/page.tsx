'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';

export default function SettingsPage() {
  const { user, token } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [downloading, setDownloading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${apiUrl}/api/agent/download/windows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'opersis-assist-agent-installer.ps1';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download agent installer. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

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

      {/* Agent Download */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Agent Download</h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
          Download and install the Opersis Assist agent on your machines to start monitoring.
        </p>

        {/* Windows Agent Card */}
        <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">Windows Agent</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              v1.0.0 &middot; Windows 10/11, Server 2016+ &middot; PowerShell Installer
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {downloading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Downloading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </>
            )}
          </button>
        </div>

        {/* Installation Instructions */}
        <div className="mt-4 bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
          <p className="text-xs font-semibold text-surface-700 dark:text-surface-300 mb-2">Installation Steps</p>
          <ol className="text-xs text-surface-600 dark:text-surface-400 space-y-1.5 list-decimal list-inside">
            <li>Click <strong>Download</strong> to get the pre-configured installer</li>
            <li>On the target machine, right-click the downloaded file → <strong>Run with PowerShell</strong> (as Administrator)</li>
            <li>Or open PowerShell as Admin and run: <code className="bg-surface-200 dark:bg-surface-700 px-1 rounded">powershell -ExecutionPolicy Bypass -File .\opersis-assist-agent-installer.ps1</code></li>
            <li>The agent will install as a Windows service and auto-connect to this server</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
