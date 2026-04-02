const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('opersis-token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('opersis-token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  getMe: () => request<{ user: any }>('/api/auth/me'),

  // Devices
  getDevices: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ devices: any[]; pagination: any }>(`/api/devices${query}`);
  },

  getDeviceStats: () => request<{ total: number; online: number; offline: number; platforms: any[] }>('/api/devices/stats'),

  getDevice: (id: string) => request<{ device: any }>(`/api/devices/${id}`),

  updateDevice: (id: string, data: any) =>
    request<{ device: any }>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDevice: (id: string) => request<{ message: string }>(`/api/devices/${id}`, { method: 'DELETE' }),

  // Alerts
  getAlerts: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ alerts: any[]; pagination: any }>(`/api/alerts${query}`);
  },

  acknowledgeAlert: (id: string) =>
    request<{ alert: any }>(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' }),
};
