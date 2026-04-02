import { create } from 'zustand';
import { api } from '@/lib/api';

interface DeviceStats {
  cpu: number;
  ram: { total: number; used: number; percent: number };
  disk: { total: number; used: number; percent: number };
}

interface Device {
  _id: string;
  deviceId: string;
  name: string;
  hostname: string;
  platform: string;
  osVersion: string;
  isOnline: boolean;
  lastSeen: string;
  group: string;
  tags: string[];
  latestStats?: DeviceStats;
  systemInfo?: {
    cpuModel: string;
    cpuCores: number;
    totalRam: number;
    totalDisk: number;
  };
}

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  stats: { total: number; online: number; offline: number; platforms: any[] };
  loading: boolean;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  fetchDevices: (params?: Record<string, string>) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDevice: (id: string) => Promise<void>;
  updateDeviceStatus: (deviceId: string, isOnline: boolean) => void;
  updateDeviceStats: (deviceId: string, stats: DeviceStats) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  stats: { total: 0, online: 0, offline: 0, platforms: [] },
  loading: false,
  viewMode: 'grid',

  setViewMode: (mode) => set({ viewMode: mode }),

  fetchDevices: async (params) => {
    set({ loading: true });
    try {
      const data = await api.getDevices(params);
      set({ devices: data.devices, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const data = await api.getDeviceStats();
      set({ stats: data });
    } catch {}
  },

  fetchDevice: async (id) => {
    try {
      const data = await api.getDevice(id);
      set({ selectedDevice: data.device });
    } catch {}
  },

  updateDeviceStatus: (deviceId, isOnline) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.deviceId === deviceId ? { ...d, isOnline, lastSeen: new Date().toISOString() } : d
      ),
      stats: {
        ...state.stats,
        online: state.stats.online + (isOnline ? 1 : -1),
        offline: state.stats.offline + (isOnline ? -1 : 1),
      },
    }));
  },

  updateDeviceStats: (deviceId, stats) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.deviceId === deviceId ? { ...d, latestStats: { ...stats, timestamp: new Date().toISOString() } as any } : d
      ),
    }));
  },
}));
