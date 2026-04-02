'use client';

import { useEffect } from 'react';
import { useDeviceStore } from '@/store/deviceStore';

export default function DashboardPage() {
  const { devices, stats, fetchDevices, fetchStats, loading } = useDeviceStore();

  useEffect(() => {
    fetchDevices();
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const recentDevices = devices.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Dashboard</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">Overview of your infrastructure</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={stats.total} icon="📊" color="primary" />
        <StatCard label="Online" value={stats.online} icon="🟢" color="green" />
        <StatCard label="Offline" value={stats.offline} icon="🔴" color="red" />
        <StatCard
          label="Avg CPU"
          value={
            devices.filter((d) => d.isOnline && d.latestStats).length > 0
              ? Math.round(
                  devices
                    .filter((d) => d.isOnline && d.latestStats)
                    .reduce((acc, d) => acc + (d.latestStats?.cpu || 0), 0) /
                    devices.filter((d) => d.isOnline && d.latestStats).length
                ) + '%'
              : 'N/A'
          }
          icon="⚡"
          color="yellow"
        />
      </div>

      {/* Recent Devices */}
      <div>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Recent Devices</h2>
        {loading && devices.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-5 animate-pulse">
                <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-surface-200 dark:bg-surface-800 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-surface-200 dark:bg-surface-800 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-12 text-center">
            <div className="text-4xl mb-3">🖥️</div>
            <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-1">No devices yet</h3>
            <p className="text-surface-500 dark:text-surface-400">Install the agent on a device to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDevices.map((device) => (
              <DeviceCard key={device.deviceId} device={device} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    yellow: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  };

  return (
    <div className={`rounded-xl border p-5 transition-all duration-200 ${colorClasses[color] || colorClasses.primary}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-surface-900 dark:text-white">{value}</p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{label}</p>
    </div>
  );
}

function DeviceCard({ device }: { device: any }) {
  const cpuPercent = device.latestStats?.cpu ?? 0;
  const ramPercent = device.latestStats?.ram?.percent ?? 0;
  const diskPercent = device.latestStats?.disk?.percent ?? 0;

  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-5 hover:shadow-lg hover:shadow-surface-200/50 dark:hover:shadow-surface-950/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-surface-300 dark:bg-surface-600'}`}></div>
            {device.isOnline && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-75"></div>}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{device.name}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{device.platform} • {device.hostname}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${device.isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400'}`}>
          {device.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Stats bars */}
      {device.isOnline && device.latestStats ? (
        <div className="space-y-2.5">
          <MiniBar label="CPU" value={cpuPercent} color="primary" />
          <MiniBar label="RAM" value={ramPercent} color="green" />
          <MiniBar label="Disk" value={diskPercent} color="amber" />
        </div>
      ) : (
        <p className="text-xs text-surface-400 dark:text-surface-500">
          Last seen: {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
        </p>
      )}
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  const barColors: Record<string, string> = {
    primary: 'bg-primary-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
  };
  const warnColor = value > 90 ? 'bg-red-500' : barColors[color] || barColors.primary;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-surface-500 dark:text-surface-400">{label}</span>
        <span className="text-xs font-medium text-surface-700 dark:text-surface-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${warnColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
