export interface ProbeHistoryItem {
  id: number;
  statusCode: number | null;
  latencyMs: number;
  healthy: boolean;
  errorMsg: string | null;
  checkedAt: string;
}

export interface MonitorView {
  id: number;
  name: string;
  url: string;
  groupName: string;
  thresholdMs: number;
  enabled: boolean;
  createdAt: string;
  currentStatus: 'up' | 'degraded' | 'down' | 'paused' | 'unknown';
  currentLatencyMs: number | null;
  lastStatusCode: number | null;
  slaPercent: number;
  p50Latency: number;
  p95Latency: number;
  lastCheckedAt: string | null;
  lastError: string | null;
  history: ProbeHistoryItem[];
}

export interface IncidentItem {
  id: number;
  monitor_id: number;
  monitor_name: string;
  severity: 'critical' | 'warning';
  reason: string;
  status: 'open' | 'resolved';
  acknowledged: number;
  started_at: string;
  resolved_at: string | null;
  acked_at: string | null;
}

export interface DashboardSummary {
  totalMonitors: number;
  enabledMonitors: number;
  healthyMonitors: number;
  degradedMonitors: number;
  downMonitors: number;
  overallSla: number;
  avgP50Latency: number;
  avgP95Latency: number;
  openIncidentsCount: number;
  unackedIncidentsCount: number;
  wsClients: number;
}

export interface TimeSeriesMonitor {
  monitorId: number;
  name: string;
  groupName: string;
  points: {
    time: string;
    latencyMs: number;
    healthy: boolean;
  }[];
}

export interface WsDashboardMessage {
  type: 'snapshot' | 'probe_batch';
  timestamp: string;
  summary: DashboardSummary;
  incidents: IncidentItem[];
  monitors?: MonitorView[];
  timeSeries?: TimeSeriesMonitor[];
}
