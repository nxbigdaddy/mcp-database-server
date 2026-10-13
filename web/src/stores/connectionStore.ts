import { create } from 'zustand';
import type { Connection } from '@/services/api';

interface ConnectionStore {
  connections: Connection[];
  selectedConnection: string | null;
  setConnections: (connections: Connection[]) => void;
  setSelectedConnection: (id: string | null) => void;
  addConnection: (connection: Connection) => void;
  updateConnection: (id: string, connection: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  selectedConnection: null,
  setConnections: (connections) => set({ connections }),
  setSelectedConnection: (id) => set({ selectedConnection: id }),
  addConnection: (connection) =>
    set((state) => ({ connections: [...state.connections, connection] })),
  updateConnection: (id, updates) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removeConnection: (id) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    })),
}));
