export interface MonitorRow {
  id: number;
  name: string;
  url: string;
  group_name: string;
  threshold_ms: number;
  enabled: number;
  created_at: string;
}

export interface ProbeLogRow {
  id: number;
  monitor_id: number;
  status_code: number | null;
  latency_ms: number;
  healthy: number;
  error_msg: string | null;
  checked_at: string;
}

export interface IncidentRow {
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

export interface ProbeResult {
  monitorId: number;
  name: string;
  url: string;
  groupName: string;
  thresholdMs: number;
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
  history: {
    id: number;
    statusCode: number | null;
    latencyMs: number;
    healthy: boolean;
    errorMsg: string | null;
    checkedAt: string;
  }[];
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

export interface DashboardPayload {
  timestamp: string;
  summary: DashboardSummary;
  monitors: MonitorView[];
  incidents: IncidentRow[];
  timeSeries: TimeSeriesMonitor[];
}
