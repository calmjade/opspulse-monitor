import { getDb, persistDb, queryAll, queryOne, runSql } from './db';
import type {
  DashboardPayload,
  DashboardSummary,
  IncidentRow,
  MonitorRow,
  MonitorView,
  ProbeLogRow,
  ProbeResult,
  TimeSeriesMonitor,
} from './types';

const PROBE_TIMEOUT_MS = 3000;
const MAX_LOGS_PER_MONITOR = 100;
const HISTORY_WINDOW = 30;

function sendAlertWebhook(
  event: 'opened' | 'resolved',
  monitor: MonitorRow,
  severity: 'critical' | 'warning',
  reason: string,
  timestamp: string,
): void {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  void fetch(webhookUrl, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'OpsPulse',
      event,
      severity,
      monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
      reason,
      timestamp,
    }),
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  const clamped = Math.max(0, Math.min(sortedValues.length - 1, idx));
  return Math.round(sortedValues[clamped]);
}

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return `请求超时 (>${PROBE_TIMEOUT_MS}ms)`;
    }
    const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code === 'ECONNREFUSED') {
      return '连接被拒绝 (ECONNREFUSED)';
    }
    if (cause?.code === 'ENOTFOUND') {
      return '域名解析失败 (ENOTFOUND)';
    }
    if (cause?.code) {
      return `网络异常 (${cause.code})`;
    }
    return err.message;
  }
  return String(err);
}

export async function probeSingleMonitor(monitor: MonitorRow): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = performance.now();
  const checkedAt = new Date().toISOString();

  let statusCode: number | null = null;
  let latencyMs = 0;
  let healthy = false;
  let errorMsg: string | null = null;
  let severity: 'critical' | 'warning' = 'critical';

  try {
    const response = await fetch(monitor.url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpsPulse-Monitor/1.0',
        Accept: 'application/json,text/html,*/*',
      },
    });
    latencyMs = Math.max(1, Math.round(performance.now() - start));
    statusCode = response.status;

    // Drain body lightly to release socket cleanly
    try {
      await response.arrayBuffer();
    } catch {
      // Ignore body read failures after status received
    }

    if (response.status >= 200 && response.status < 400) {
      if (latencyMs <= monitor.threshold_ms) {
        healthy = true;
      } else {
        healthy = false;
        severity = 'warning';
        errorMsg = `响应延迟超阈值 (${latencyMs}ms > ${monitor.threshold_ms}ms)`;
      }
    } else {
      healthy = false;
      severity = 'critical';
      errorMsg = `HTTP 状态异常 (${response.status})`;
    }
  } catch (err) {
    latencyMs = Math.max(1, Math.round(performance.now() - start));
    healthy = false;
    severity = 'critical';
    errorMsg = formatErrorMessage(err);
  } finally {
    clearTimeout(timer);
  }

  // Persist log
  runSql(
    `INSERT INTO probe_logs (monitor_id, status_code, latency_ms, healthy, error_msg, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [monitor.id, statusCode, latencyMs, healthy ? 1 : 0, errorMsg, checkedAt],
  );

  // Prune old logs keeping last 100 per monitor
  const db = getDb();
  db.run(
    `DELETE FROM probe_logs
     WHERE monitor_id = ?
       AND id NOT IN (
         SELECT id FROM probe_logs
         WHERE monitor_id = ?
         ORDER BY id DESC
         LIMIT ?
       )`,
    [monitor.id, monitor.id, MAX_LOGS_PER_MONITOR],
  );

  // Auto-create or auto-resolve incidents
  const openIncident = queryOne<IncidentRow>(
    `SELECT * FROM incidents
     WHERE monitor_id = ? AND status = 'open'
     ORDER BY id DESC LIMIT 1`,
    [monitor.id],
  );

  if (!healthy) {
    const reason = errorMsg ?? '拨测异常';
    if (!openIncident) {
      runSql(
        `INSERT INTO incidents (monitor_id, monitor_name, severity, reason, status, acknowledged, started_at)
         VALUES (?, ?, ?, ?, 'open', 0, ?)`,
        [monitor.id, monitor.name, severity, reason, checkedAt],
      );
      sendAlertWebhook('opened', monitor, severity, reason, checkedAt);
    } else if (openIncident.reason !== reason || openIncident.severity !== severity) {
      db.run(
        `UPDATE incidents SET severity = ?, reason = ?, monitor_name = ? WHERE id = ?`,
        [severity, reason, monitor.name, openIncident.id],
      );
    }
  } else if (openIncident) {
    db.run(
      `UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE monitor_id = ? AND status = 'open'`,
      [checkedAt, monitor.id],
    );
    sendAlertWebhook('resolved', monitor, 'warning', '服务已恢复正常', checkedAt);
  }

  return {
    monitorId: monitor.id,
    name: monitor.name,
    url: monitor.url,
    groupName: monitor.group_name,
    thresholdMs: monitor.threshold_ms,
    statusCode,
    latencyMs,
    healthy,
    errorMsg,
    checkedAt,
  };
}

export async function runProbesForAllEnabled(): Promise<ProbeResult[]> {
  const monitors = queryAll<MonitorRow>(
    'SELECT * FROM monitors WHERE enabled = 1 ORDER BY id ASC',
  );
  if (monitors.length === 0) {
    return [];
  }
  const results = await Promise.all(monitors.map((m) => probeSingleMonitor(m)));
  persistDb();
  return results;
}

export async function runProbeById(monitorId: number): Promise<ProbeResult | null> {
  const monitor = queryOne<MonitorRow>('SELECT * FROM monitors WHERE id = ?', [
    monitorId,
  ]);
  if (!monitor) return null;
  const result = await probeSingleMonitor(monitor);
  persistDb();
  return result;
}

export function buildDashboardPayload(wsClients: number): DashboardPayload {
  const monitors = queryAll<MonitorRow>('SELECT * FROM monitors ORDER BY id ASC');
  const incidents = queryAll<IncidentRow>(
    `SELECT * FROM incidents
     ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END ASC, id DESC
     LIMIT 30`,
  );

  const monitorViews: MonitorView[] = [];
  const timeSeries: TimeSeriesMonitor[] = [];

  let enabledCount = 0;
  let healthyCount = 0;
  let degradedCount = 0;
  let downCount = 0;
  const slaValues: number[] = [];
  const p50Values: number[] = [];
  const p95Values: number[] = [];

  for (const m of monitors) {
    const recentDesc = queryAll<ProbeLogRow>(
      `SELECT * FROM probe_logs
       WHERE monitor_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [m.id, HISTORY_WINDOW],
    );
    const historyRows = [...recentDesc].reverse();

    const latencies = historyRows.map((l) => l.latency_ms).sort((a, b) => a - b);
    const healthyLogs = historyRows.filter((l) => l.healthy === 1).length;
    const slaPercent =
      historyRows.length > 0
        ? Number(((healthyLogs / historyRows.length) * 100).toFixed(2))
        : 100;
    const p50Latency = percentile(latencies, 50);
    const p95Latency = percentile(latencies, 95);

    const latest = recentDesc[0];
    let currentStatus: MonitorView['currentStatus'] = 'unknown';

    if (m.enabled !== 1) {
      currentStatus = 'paused';
    } else {
      enabledCount += 1;
      if (!latest) {
        currentStatus = 'unknown';
      } else if (latest.healthy === 1) {
        currentStatus = 'up';
        healthyCount += 1;
      } else if (latest.status_code !== null && latest.status_code >= 200 && latest.status_code < 400) {
        currentStatus = 'degraded';
        degradedCount += 1;
      } else {
        currentStatus = 'down';
        downCount += 1;
      }
    }

    if (historyRows.length > 0) {
      slaValues.push(slaPercent);
      p50Values.push(p50Latency);
      p95Values.push(p95Latency);
    }

    monitorViews.push({
      id: m.id,
      name: m.name,
      url: m.url,
      groupName: m.group_name,
      thresholdMs: m.threshold_ms,
      enabled: m.enabled === 1,
      createdAt: m.created_at,
      currentStatus,
      currentLatencyMs: latest ? latest.latency_ms : null,
      lastStatusCode: latest ? latest.status_code : null,
      slaPercent,
      p50Latency,
      p95Latency,
      lastCheckedAt: latest ? latest.checked_at : null,
      lastError: latest ? latest.error_msg : null,
      history: historyRows.map((h) => ({
        id: h.id,
        statusCode: h.status_code,
        latencyMs: h.latency_ms,
        healthy: h.healthy === 1,
        errorMsg: h.error_msg,
        checkedAt: h.checked_at,
      })),
    });

    timeSeries.push({
      monitorId: m.id,
      name: m.name,
      groupName: m.group_name,
      points: historyRows.map((h) => ({
        time: h.checked_at,
        latencyMs: h.latency_ms,
        healthy: h.healthy === 1,
      })),
    });
  }

  const openIncidents = incidents.filter((i) => i.status === 'open');
  const unackedIncidents = openIncidents.filter((i) => i.acknowledged === 0);

  const avg = (arr: number[]): number =>
    arr.length > 0 ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;

  const summary: DashboardSummary = {
    totalMonitors: monitors.length,
    enabledMonitors: enabledCount,
    healthyMonitors: healthyCount,
    degradedMonitors: degradedCount,
    downMonitors: downCount,
    overallSla:
      slaValues.length > 0 ? Number(avg(slaValues).toFixed(2)) : 100,
    avgP50Latency: Math.round(avg(p50Values)),
    avgP95Latency: Math.round(avg(p95Values)),
    openIncidentsCount: openIncidents.length,
    unackedIncidentsCount: unackedIncidents.length,
    wsClients,
  };

  return {
    timestamp: new Date().toISOString(),
    summary,
    monitors: monitorViews,
    incidents,
    timeSeries,
  };
}
