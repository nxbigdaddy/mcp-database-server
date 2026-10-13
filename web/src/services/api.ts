import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => (response.data as any).data,
  (error) => {
    console.error('API Error:', error);
    throw error;
  }
);

export interface Connection {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  database: string;
  pool_min?: number;
  pool_max?: number;
  read_only?: boolean;
  ssl_enabled?: boolean;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

export const connectionsApi = {
  list: (): Promise<Connection[]> => api.get('/connections'),
  get: (id: string): Promise<Connection> => api.get(`/connections/${id}`),
  create: (data: any): Promise<Connection> => api.post('/connections', data),
  update: (id: string, data: any): Promise<Connection> => api.put(`/connections/${id}`, data),
  delete: (id: string): Promise<void> => api.delete(`/connections/${id}`),
  test: (id: string): Promise<{ connected: boolean; latency?: number; error?: string }> => api.post(`/connections/${id}/test`),
  ping: (id: string): Promise<{ connected: boolean; latency?: number }> => api.post(`/connections/${id}/ping`),
};

export const queryApi = {
  execute: (data: { connection: string; sql: string; params?: any[]; limit?: number; offset?: number }): Promise<QueryResult> =>
    api.post('/query', data),
};

export const metadataApi = {
  getTables: (connectionId: string): Promise<any[]> => api.get(`/${connectionId}/tables`),
  getSchema: (connectionId: string, table: string): Promise<any> => api.get(`/${connectionId}/schema/${table}`),
};

export const auditApi = {
  getLogs: (params?: any): Promise<{ logs: any[]; pagination: any }> => api.get('/audit/logs', { params }),
  getStats: (params?: any): Promise<any> => api.get('/audit/stats', { params }),
};

export const settingsApi = {
  get: (): Promise<any> => api.get('/settings'),
  update: (data: any): Promise<void> => api.put('/settings', data),
};

export default api;
