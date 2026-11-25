import { create } from 'zustand';
import type {
  DashboardSummary,
  IncidentItem,
  MonitorView,
  TimeSeriesMonitor,
  WsDashboardMessage,
} from '../types/monitor';

export type WsConnectionState = 'connecting' | 'connected' | 'disconnected';

const BASE_PREFIX = import.meta.env.BASE_URL.replace(/\/$/, '');
const API_BASE = `${BASE_PREFIX}/api`;

interface CreateMonitorInput {
  name: string;
  url: string;
  groupName: string;
  thresholdMs: number;
}

interface OpsState {
  monitors: MonitorView[];
  summary: DashboardSummary;
  incidents: IncidentItem[];
  timeSeries: TimeSeriesMonitor[];
  lastHeartbeat: string | null;
  wsStatus: WsConnectionState;
  loading: boolean;
  probingAll: boolean;
  probingIds: Record<number, boolean>;
  selectedGroup: string;
  errorMsg: string | null;
  setSelectedGroup: (group: string) => void;
  clearError: () => void;
  fetchDashboard: () => Promise<void>;
  connectWebSocket: () => () => void;
  runAllProbes: () => Promise<void>;
  probeMonitor: (id: number) => Promise<void>;
  createMonitor: (input: CreateMonitorInput) => Promise<boolean>;
  toggleMonitor: (id: number, enabled: boolean) => Promise<void>;
  updateThreshold: (id: number, thresholdMs: number) => Promise<void>;
  deleteMonitor: (id: number) => Promise<void>;
  ackIncident: (id: number) => Promise<void>;
}

const DEFAULT_SUMMARY: DashboardSummary = {
  totalMonitors: 0,
  enabledMonitors: 0,
  healthyMonitors: 0,
  degradedMonitors: 0,
  downMonitors: 0,
  overallSla: 100,
  avgP50Latency: 0,
  avgP95Latency: 0,
  openIncidentsCount: 0,
  unackedIncidentsCount: 0,
  wsClients: 0,
};

export const useOpsStore = create<OpsState>((set, get) => ({
  monitors: [],
  summary: DEFAULT_SUMMARY,
  incidents: [],
  timeSeries: [],
  lastHeartbeat: null,
  wsStatus: 'connecting',
  loading: true,
  probingAll: false,
  probingIds: {},
  selectedGroup: '全部',
  errorMsg: null,

  setSelectedGroup: (group) => set({ selectedGroup: group }),
  clearError: () => set({ errorMsg: null }),

  fetchDashboard: async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        timestamp: string;
        summary: DashboardSummary;
        monitors: MonitorView[];
        incidents: IncidentItem[];
        timeSeries: TimeSeriesMonitor[];
      };
      set({
        monitors: data.monitors,
        summary: data.summary,
        incidents: data.incidents,
        timeSeries: data.timeSeries,
        lastHeartbeat: data.timestamp,
        loading: false,
        errorMsg: null,
      });
    } catch (err) {
      set({
        loading: false,
        errorMsg: err instanceof Error ? err.message : '拉取大屏数据失败',
      });
    }
  },

  connectWebSocket: () => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      set({ wsStatus: 'connecting' });
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${BASE_PREFIX}/ws`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!disposed) {
          set({ wsStatus: 'connected', errorMsg: null });
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsDashboardMessage;
          set((state) => ({
            summary: msg.summary ?? state.summary,
            incidents: msg.incidents ?? state.incidents,
            monitors: msg.monitors ?? state.monitors,
            timeSeries: msg.timeSeries ?? state.timeSeries,
            lastHeartbeat: msg.timestamp ?? new Date().toISOString(),
            loading: false,
          }));
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        set({ wsStatus: 'disconnected' });
        reconnectTimer = window.setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  },

  runAllProbes: async () => {
    set({ probingAll: true, errorMsg: null });
    try {
      const res = await fetch(`${API_BASE}/probes/run-all`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(`全量拨测失败 (HTTP ${res.status})`);
      }
      await get().fetchDashboard();
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '全量拨测请求异常',
      });
    } finally {
      set({ probingAll: false });
    }
  },

  probeMonitor: async (id) => {
    set((state) => ({
      probingIds: { ...state.probingIds, [id]: true },
      errorMsg: null,
    }));
    try {
      const res = await fetch(`${API_BASE}/monitors/${id}/probe`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(`单点拨测失败 (HTTP ${res.status})`);
      }
      await get().fetchDashboard();
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '单点拨测异常',
      });
    } finally {
      set((state) => {
        const next = { ...state.probingIds };
        delete next[id];
        return { probingIds: next };
      });
    }
  },

  createMonitor: async (input) => {
    set({ errorMsg: null });
    try {
      const res = await fetch(`${API_BASE}/monitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        set({ errorMsg: data.error ?? '创建监控节点失败' });
        return false;
      }
      await get().fetchDashboard();
      return true;
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '创建监控节点网络异常',
      });
      return false;
    }
  },

  toggleMonitor: async (id, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/monitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        throw new Error('更新监控状态失败');
      }
      await get().fetchDashboard();
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '切换监控状态失败',
      });
    }
  },

  updateThreshold: async (id, thresholdMs) => {
    try {
      const res = await fetch(`${API_BASE}/monitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholdMs }),
      });
      if (!res.ok) {
        throw new Error('更新延迟阈值失败');
      }
      await get().fetchDashboard();
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '更新延迟阈值失败',
      });
    }
  },

  deleteMonitor: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/monitors/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('删除监控节点失败');
      }
      await get().fetchDashboard();
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '删除监控节点失败',
      });
    }
  },

  ackIncident: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}/ack`, { method: 'PATCH' });
      if (!res.ok) {
        throw new Error('确认告警事件失败');
      }
      await get().fetchDashboard();
    } catch (err) {
      set({
        errorMsg: err instanceof Error ? err.message : '确认告警事件失败',
      });
    }
  },
}));
