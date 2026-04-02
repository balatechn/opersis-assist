'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDeviceStore } from '@/store/deviceStore';
import { dashboardSocket } from '@/lib/ws';

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;
  const { selectedDevice, fetchDevice } = useDeviceStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'terminal'>('overview');

  useEffect(() => {
    fetchDevice(deviceId);
  }, [deviceId]);

  // Subscribe to real-time stats
  useEffect(() => {
    const unsub = dashboardSocket.on('device.stats', (msg: any) => {
      if (msg.deviceId === deviceId) {
        fetchDevice(deviceId);
      }
    });
    return unsub;
  }, [deviceId]);

  if (!selectedDevice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-surface-400">Loading device...</div>
      </div>
    );
  }

  const d = selectedDevice;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-surface-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{d.name}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${d.isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400'}`}>
              {d.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-surface-500 dark:text-surface-400 text-sm">{d.deviceId}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200 dark:border-surface-800">
        <div className="flex gap-6">
          {(['overview', 'terminal'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-all duration-200 border-b-2 ${activeTab === tab ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <OverviewTab device={d} />
      ) : (
        <TerminalTab deviceId={deviceId} isOnline={d.isOnline} />
      )}
    </div>
  );
}

function OverviewTab({ device }: { device: any }) {
  const stats = device.latestStats;
  const sysInfo = device.systemInfo;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* System info */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">System Information</h3>
        <dl className="space-y-3 text-sm">
          <InfoRow label="Hostname" value={device.hostname} />
          <InfoRow label="Platform" value={device.platform} />
          <InfoRow label="OS" value={device.osVersion} />
          <InfoRow label="CPU" value={sysInfo?.cpuModel || '-'} />
          <InfoRow label="Cores" value={sysInfo?.cpuCores || '-'} />
          <InfoRow label="Total RAM" value={sysInfo?.totalRam ? `${sysInfo.totalRam} GB` : '-'} />
          <InfoRow label="Total Disk" value={sysInfo?.totalDisk ? `${sysInfo.totalDisk} GB` : '-'} />
          <InfoRow label="Local IP" value={device.localIp || '-'} />
          <InfoRow label="Agent Version" value={device.agentVersion || '-'} />
          <InfoRow label="Last Seen" value={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '-'} />
        </dl>
      </div>

      {/* Live stats */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Live Statistics</h3>
        {stats ? (
          <div className="space-y-5">
            <GaugeBar label="CPU Usage" value={stats.cpu} unit="%" />
            <GaugeBar label="RAM Usage" value={stats.ram?.percent ?? 0} unit="%" subtitle={stats.ram ? `${Math.round(stats.ram.used)} / ${Math.round(stats.ram.total)} MB` : undefined} />
            <GaugeBar label="Disk Usage" value={stats.disk?.percent ?? 0} unit="%" subtitle={stats.disk ? `${Math.round(stats.disk.used)} / ${Math.round(stats.disk.total)} MB` : undefined} />
          </div>
        ) : (
          <p className="text-surface-400 text-sm">No live stats available. Device may be offline.</p>
        )}
      </div>
    </div>
  );
}

function TerminalTab({ deviceId, isOnline }: { deviceId: string; isOnline: boolean }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub1 = dashboardSocket.on('shell.started', (msg: any) => {
      if (msg.deviceId === deviceId) {
        setSessionId(msg.sessionId);
        setOutput(['[Connected to remote shell]\n']);
      }
    });

    const unsub2 = dashboardSocket.on('shell.output', (msg: any) => {
      if (msg.deviceId === deviceId) {
        setOutput((prev) => [...prev, msg.data]);
      }
    });

    return () => { unsub1(); unsub2(); };
  }, [deviceId]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const startShell = useCallback(() => {
    dashboardSocket.send({ type: 'shell.start', deviceId });
  }, [deviceId]);

  const sendInput = useCallback(() => {
    if (!sessionId || !input) return;
    dashboardSocket.send({ type: 'shell.input', deviceId, sessionId, data: input + '\n' });
    setInput('');
  }, [sessionId, deviceId, input]);

  const stopShell = useCallback(() => {
    if (sessionId) {
      dashboardSocket.send({ type: 'shell.stop', deviceId, sessionId });
      setSessionId(null);
      setOutput((prev) => [...prev, '\n[Session ended]\n']);
    }
  }, [sessionId, deviceId]);

  if (!isOnline) {
    return (
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-12 text-center">
        <p className="text-surface-400">Device is offline. Terminal not available.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-900 rounded-xl border border-surface-800 overflow-hidden">
      {/* Terminal toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-800 border-b border-surface-700">
        <span className="text-xs text-surface-400">Remote Terminal</span>
        <div className="flex items-center gap-2">
          {!sessionId ? (
            <button onClick={startShell} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
              Connect
            </button>
          ) : (
            <button onClick={stopShell} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Terminal output */}
      <div ref={outputRef} className="h-96 p-4 overflow-y-auto font-mono text-sm text-green-400 bg-surface-950">
        {output.length === 0 ? (
          <span className="text-surface-500">Click &quot;Connect&quot; to start a remote shell session.</span>
        ) : (
          output.map((line, i) => <pre key={i} className="whitespace-pre-wrap">{line}</pre>)
        )}
      </div>

      {/* Terminal input */}
      {sessionId && (
        <div className="flex border-t border-surface-800">
          <span className="px-3 py-2 text-green-500 font-mono text-sm">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendInput(); }}
            className="flex-1 bg-transparent text-green-400 font-mono text-sm outline-none py-2 pr-4"
            placeholder="Type a command..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <dt className="text-surface-500 dark:text-surface-400">{label}</dt>
      <dd className="text-surface-900 dark:text-white font-medium capitalize">{value}</dd>
    </div>
  );
}

function GaugeBar({ label, value, unit, subtitle }: { label: string; value: number; unit: string; subtitle?: string }) {
  const color = value > 90 ? 'bg-red-500' : value > 70 ? 'bg-amber-500' : 'bg-primary-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>
        <span className="text-sm font-semibold text-surface-900 dark:text-white">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      {subtitle && <p className="text-xs text-surface-400 mt-1">{subtitle}</p>}
    </div>
  );
}
