import http from 'node:http';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { getDb, initDatabase, persistDb, queryAll, queryOne, runSql } from './db';
import {
  buildDashboardPayload,
  runProbeById,
  runProbesForAllEnabled,
} from './probe';
import type { IncidentRow, MonitorRow, ProbeResult } from './types';

const PORT = Number(process.env.PORT ?? 8095);
const HOST = process.env.HOST ?? '0.0.0.0';
const PROBE_INTERVAL_MS = Number(process.env.PROBE_INTERVAL_MS ?? 10_000);

async function bootstrap(): Promise<void> {
  await initDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const getWsClientCount = (): number => {
    let count = 0;
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        count += 1;
      }
    }
    return count;
  };

  const broadcastWs = (
    type: 'snapshot' | 'probe_batch',
    results: ProbeResult[] = [],
  ): void => {
    const dashboard = buildDashboardPayload(getWsClientCount());
    const payload = JSON.stringify({
      type,
      timestamp: dashboard.timestamp,
      results,
      summary: dashboard.summary,
      incidents: dashboard.incidents,
      monitors: dashboard.monitors,
      timeSeries: dashboard.timeSeries,
    });

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  wss.on('connection', (socket) => {
    const dashboard = buildDashboardPayload(getWsClientCount());
    socket.send(
      JSON.stringify({
        type: 'snapshot',
        timestamp: dashboard.timestamp,
        results: [],
        summary: dashboard.summary,
        incidents: dashboard.incidents,
        monitors: dashboard.monitors,
        timeSeries: dashboard.timeSeries,
      }),
    );
  });

  let cycleInProgress = false;
  const triggerFullCycle = async (): Promise<ProbeResult[]> => {
    if (cycleInProgress) {
      return [];
    }
    cycleInProgress = true;
    try {
      const results = await runProbesForAllEnabled();
      broadcastWs('probe_batch', results);
      return results;
    } finally {
      cycleInProgress = false;
    }
  };

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    const row = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM monitors');
    res.json({
      status: 'UP',
      service: 'opspulse-monitor',
      monitorsCount: row?.count ?? 0,
      wsClients: getWsClientCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // Dashboard Aggregated Payload
  app.get('/api/dashboard', (_req: Request, res: Response) => {
    res.json(buildDashboardPayload(getWsClientCount()));
  });

  // Monitors CRUD
  app.get('/api/monitors', (_req: Request, res: Response) => {
    const rows = queryAll<MonitorRow>('SELECT * FROM monitors ORDER BY id ASC');
    res.json(
      rows.map((m) => ({
        id: m.id,
        name: m.name,
        url: m.url,
        groupName: m.group_name,
        thresholdMs: m.threshold_ms,
        enabled: m.enabled === 1,
        createdAt: m.created_at,
      })),
    );
  });

  app.post('/api/monitors', async (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      url?: string;
      groupName?: string;
      group_name?: string;
      thresholdMs?: number;
      threshold_ms?: number;
    };

    const name = body.name?.trim();
    const url = body.url?.trim();
    const groupName = (body.groupName ?? body.group_name ?? '自定义服务').trim();
    const thresholdRaw = body.thresholdMs ?? body.threshold_ms ?? 1000;
    const thresholdMs = Math.max(50, Math.min(30000, Number(thresholdRaw) || 1000));

    if (!name || !url) {
      res.status(400).json({ error: '服务名称和探测 URL 不能为空' });
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).json({ error: '仅支持 http:// 或 https:// 协议端点' });
        return;
      }
    } catch {
      res.status(400).json({ error: '无效的 URL 格式' });
      return;
    }

    const existing = queryOne<{ id: number }>('SELECT id FROM monitors WHERE url = ?', [url]);
    if (existing) {
      res.status(409).json({ error: '该监控 URL 已存在' });
      return;
    }

    const createdAt = new Date().toISOString();
    const id = runSql(
      `INSERT INTO monitors (name, url, group_name, threshold_ms, enabled, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [name, url, groupName, thresholdMs, createdAt],
    );
    persistDb();

    const probeResult = await runProbeById(id);
    broadcastWs('probe_batch', probeResult ? [probeResult] : []);

    const created = queryOne<MonitorRow>('SELECT * FROM monitors WHERE id = ?', [id]);
    res.status(201).json({
      id: created?.id ?? id,
      name,
      url,
      groupName,
      thresholdMs,
      enabled: true,
      createdAt,
      initialProbe: probeResult,
    });
  });

  app.patch('/api/monitors/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = queryOne<MonitorRow>('SELECT * FROM monitors WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: '监控节点不存在' });
      return;
    }

    const body = req.body as {
      name?: string;
      url?: string;
      groupName?: string;
      thresholdMs?: number;
      enabled?: boolean;
    };

    const nextName = body.name !== undefined ? body.name.trim() : existing.name;
    const nextUrl = body.url !== undefined ? body.url.trim() : existing.url;
    const nextGroup = body.groupName !== undefined ? body.groupName.trim() : existing.group_name;
    const nextThreshold =
      body.thresholdMs !== undefined
        ? Math.max(50, Math.min(30000, Number(body.thresholdMs) || existing.threshold_ms))
        : existing.threshold_ms;
    const nextEnabled =
      body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled;

    getDb().run(
      `UPDATE monitors
       SET name = ?, url = ?, group_name = ?, threshold_ms = ?, enabled = ?
       WHERE id = ?`,
      [nextName, nextUrl, nextGroup, nextThreshold, nextEnabled, id],
    );
    persistDb();

    broadcastWs('snapshot');
    res.json({
      id,
      name: nextName,
      url: nextUrl,
      groupName: nextGroup,
      thresholdMs: nextThreshold,
      enabled: nextEnabled === 1,
      createdAt: existing.created_at,
    });
  });

  app.delete('/api/monitors/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = queryOne<MonitorRow>('SELECT * FROM monitors WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: '监控节点不存在' });
      return;
    }

    const db = getDb();
    db.run('DELETE FROM probe_logs WHERE monitor_id = ?', [id]);
    db.run('DELETE FROM incidents WHERE monitor_id = ?', [id]);
    db.run('DELETE FROM monitors WHERE id = ?', [id]);
    persistDb();

    broadcastWs('snapshot');
    res.json({ deleted: true, id });
  });

  // Probe Triggers
  app.post('/api/probes/run-all', async (_req: Request, res: Response) => {
    const results = await runProbesForAllEnabled();
    broadcastWs('probe_batch', results);
    const dashboard = buildDashboardPayload(getWsClientCount());
    res.json({
      timestamp: dashboard.timestamp,
      results,
      summary: dashboard.summary,
      incidents: dashboard.incidents,
    });
  });

  app.post('/api/monitors/:id/probe', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await runProbeById(id);
    if (!result) {
      res.status(404).json({ error: '监控节点不存在' });
      return;
    }
    broadcastWs('probe_batch', [result]);
    const dashboard = buildDashboardPayload(getWsClientCount());
    res.json({
      timestamp: dashboard.timestamp,
      result,
      summary: dashboard.summary,
      incidents: dashboard.incidents,
    });
  });

  // Incidents
  app.get('/api/incidents', (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = status
      ? queryAll<IncidentRow>(
          'SELECT * FROM incidents WHERE status = ? ORDER BY id DESC LIMIT 50',
          [status],
        )
      : queryAll<IncidentRow>('SELECT * FROM incidents ORDER BY id DESC LIMIT 50');
    res.json(rows);
  });

  app.patch('/api/incidents/:id/ack', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = queryOne<IncidentRow>('SELECT * FROM incidents WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: '告警事件不存在' });
      return;
    }
    const ackedAt = new Date().toISOString();
    getDb().run(
      'UPDATE incidents SET acknowledged = 1, acked_at = ? WHERE id = ?',
      [ackedAt, id],
    );
    persistDb();
    broadcastWs('snapshot');
    const updated = queryOne<IncidentRow>('SELECT * FROM incidents WHERE id = ?', [id]);
    res.json(updated);
  });

  const intervalId = setInterval(() => {
    void triggerFullCycle();
  }, PROBE_INTERVAL_MS);

  const shutdown = (): void => {
    clearInterval(intervalId);
    persistDb();
    wss.close();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(PORT, HOST, () => {
    console.log(
      `[OpsPulse] Probe Engine listening on http://${HOST}:${PORT} (WS: ws://${HOST}:${PORT}/ws)`,
    );
    // Run initial probe shortly after listen so self-check /api/health succeeds
    setTimeout(() => {
      void triggerFullCycle();
    }, 250);
  });
}

bootstrap().catch((err) => {
  console.error('[OpsPulse] Fatal startup error:', err);
  process.exit(1);
});
