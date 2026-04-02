'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dashboardSocket } from '@/lib/ws';

interface Alert {
  _id: string;
  type: string;
  severity: string;
  message: string;
  value: number;
  acknowledged: boolean;
  createdAt: string;
  device?: { name: string; hostname: string; deviceId: string };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('unacknowledged');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filter === 'unacknowledged') params.acknowledged = 'false';
      const data = await api.getAlerts(params);
      setAlerts(data.alerts);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  // Real-time alerts
  useEffect(() => {
    const unsub = dashboardSocket.on('alert.new', (msg: any) => {
      setAlerts((prev) => [msg.alert, ...prev]);
    });
    return unsub;
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeAlert(id);
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, acknowledged: true } : a)));
    } catch {}
  };

  const severityBadge = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return classes[severity] || classes.info;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Alerts</h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">Monitor system alerts and notifications</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unacknowledged')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === 'unacknowledged' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            Unacknowledged
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === 'all' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-400">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-1">No alerts</h3>
          <p className="text-surface-500 dark:text-surface-400">Everything looks healthy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className={`bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-4 flex items-center justify-between transition-all duration-200 ${alert.acknowledged ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${severityBadge(alert.severity)}`}>
                  {alert.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{alert.message}</p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {alert.device?.name || 'Unknown device'} • {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {!alert.acknowledged && (
                <button
                  onClick={() => handleAcknowledge(alert._id)}
                  className="px-3 py-1.5 text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 rounded-lg transition-all duration-200 whitespace-nowrap"
                >
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
