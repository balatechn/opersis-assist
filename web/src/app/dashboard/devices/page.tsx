'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDeviceStore } from '@/store/deviceStore';

export default function DevicesPage() {
  const { devices, fetchDevices, loading, viewMode, setViewMode } = useDeviceStore();
  const [search, setSearch] = useState('');
  const [filterOnline, setFilterOnline] = useState<string>('all');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterOnline !== 'all') params.online = filterOnline;
    fetchDevices(params);
  }, [search, filterOnline]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Devices</h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">{devices.length} device(s) registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search devices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all duration-200 w-64"
        />
        <select
          value={filterOnline}
          onChange={(e) => setFilterOnline(e.target.value)}
          className="px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
      </div>

      {/* Device List */}
      {loading && devices.length === 0 ? (
        <div className="text-center py-12 text-surface-400">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-12 text-center">
          <div className="text-4xl mb-3">🖥️</div>
          <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-1">No devices found</h3>
          <p className="text-surface-500 dark:text-surface-400">Install the agent or adjust your filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((device) => (
            <Link key={device.deviceId} href={`/dashboard/devices/${device.deviceId}`}>
              <GridCard device={device} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800">
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">Platform</th>
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">CPU</th>
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">RAM</th>
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">Disk</th>
                <th className="text-left text-xs font-medium text-surface-500 dark:text-surface-400 px-4 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <Link key={device.deviceId} href={`/dashboard/devices/${device.deviceId}`} legacyBehavior>
                  <tr className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-surface-300'}`} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">{device.name}</p>
                      <p className="text-xs text-surface-400">{device.hostname}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300 capitalize">{device.platform}</td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">{device.latestStats?.cpu?.toFixed(1) ?? '-'}%</td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">{device.latestStats?.ram?.percent?.toFixed(1) ?? '-'}%</td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">{device.latestStats?.disk?.percent?.toFixed(1) ?? '-'}%</td>
                    <td className="px-4 py-3 text-xs text-surface-400">{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '-'}</td>
                  </tr>
                </Link>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GridCard({ device }: { device: any }) {
  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-5 hover:shadow-lg hover:shadow-surface-200/50 dark:hover:shadow-surface-950/50 transition-all duration-300 cursor-pointer">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-surface-300 dark:bg-surface-600'}`} />
          {device.isOnline && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-75" />}
        </div>
        <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{device.name}</p>
      </div>
      <p className="text-xs text-surface-500 dark:text-surface-400 mb-3 capitalize">{device.platform} • {device.hostname}</p>
      {device.isOnline && device.latestStats && (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-surface-400">CPU</span><span className="text-surface-700 dark:text-surface-300">{device.latestStats.cpu?.toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-surface-400">RAM</span><span className="text-surface-700 dark:text-surface-300">{device.latestStats.ram?.percent?.toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-surface-400">Disk</span><span className="text-surface-700 dark:text-surface-300">{device.latestStats.disk?.percent?.toFixed(1)}%</span></div>
        </div>
      )}
    </div>
  );
}
