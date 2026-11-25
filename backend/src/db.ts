import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type BindParams } from 'sql.js';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'opspulse.sqlite');

let dbInstance: Database | null = null;

interface SeedMonitor {
  name: string;
  url: string;
  groupName: string;
  thresholdMs: number;
}

const SEED_MONITORS: SeedMonitor[] = [
  {
    name: '个人主页 Portfolio (Nuxt 4)',
    url: 'http://localhost:3000',
    groupName: '展示门户',
    thresholdMs: 1500,
  },
  {
    name: '数据驿站 Lite API (Spring Boot)',
    url: 'http://localhost:8091/api/health',
    groupName: 'Java 微服务',
    thresholdMs: 800,
  },
  {
    name: '星枢研发舱 API (Fastify)',
    url: 'http://localhost:8092/api/health',
    groupName: 'Node 微服务',
    thresholdMs: 500,
  },
  {
    name: '智问数舱 API (Hono SSE)',
    url: 'http://localhost:8093/api/health',
    groupName: 'AI 引擎',
    thresholdMs: 500,
  },
  {
    name: '易采协同台全栈 (Next.js)',
    url: 'http://localhost:9024/api/health',
    groupName: '全栈 BFF',
    thresholdMs: 1000,
  },
  {
    name: '脉搏智维核心节点 (Express WS)',
    url: 'http://localhost:8095/api/health',
    groupName: '监控引擎',
    thresholdMs: 300,
  },
];

const PROD_SEED_MONITORS: SeedMonitor[] = [
  {
    name: '个人主页与作品集 (calmjade.cn)',
    url: 'https://calmjade.cn/',
    groupName: '展示门户',
    thresholdMs: 1500,
  },
  {
    name: '油养记生产站 (fuelcare.cloud)',
    url: 'https://fuelcare.cloud/',
    groupName: '核心产品',
    thresholdMs: 1500,
  },
  {
    name: '数据驿站 Lite API (Spring Boot)',
    url: 'http://127.0.0.1:8091/api/health',
    groupName: 'Java 微服务',
    thresholdMs: 800,
  },
  {
    name: '星枢研发舱 API (Fastify)',
    url: 'http://127.0.0.1:8092/api/health',
    groupName: 'Node 微服务',
    thresholdMs: 500,
  },
  {
    name: '智问数舱 API (Hono SSE)',
    url: 'http://127.0.0.1:8093/api/health',
    groupName: 'AI 引擎',
    thresholdMs: 500,
  },
  {
    name: '易采协同台全栈 (Next.js)',
    url: 'http://127.0.0.1:9024/supplyflow/api/health',
    groupName: '全栈 BFF',
    thresholdMs: 1000,
  },
  {
    name: '脉搏智维核心节点 (Express WS)',
    url: 'http://127.0.0.1:8095/api/health',
    groupName: '监控引擎',
    thresholdMs: 300,
  },
];

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL,
      threshold_ms INTEGER NOT NULL DEFAULT 1000,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS probe_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      status_code INTEGER,
      latency_ms INTEGER NOT NULL,
      healthy INTEGER NOT NULL,
      error_msg TEXT,
      checked_at TEXT NOT NULL,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_probe_logs_monitor_id
      ON probe_logs(monitor_id, id DESC);

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      monitor_name TEXT NOT NULL,
      severity TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      resolved_at TEXT,
      acked_at TEXT,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_status_started
      ON incidents(status, started_at DESC);
  `);

  const activeSeeds =
    process.env.OPSPULSE_ENV === 'production' ? PROD_SEED_MONITORS : SEED_MONITORS;
  const now = new Date().toISOString();
  for (const seed of activeSeeds) {
    const existing = queryOne<{ id: number }>(
      'SELECT id FROM monitors WHERE url = ?',
      [seed.url],
    );
    if (!existing) {
      dbInstance.run(
        `INSERT INTO monitors (name, url, group_name, threshold_ms, enabled, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [seed.name, seed.url, seed.groupName, seed.thresholdMs, now],
      );
    }
  }

  persistDb();
  return dbInstance;
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function persistDb(): void {
  if (!dbInstance) return;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const binary = dbInstance.export();
  fs.writeFileSync(DB_PATH, Buffer.from(binary));
}

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: BindParams = [],
): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    if (
      params !== null &&
      (Array.isArray(params) ? params.length > 0 : Object.keys(params).length > 0)
    ) {
      stmt.bind(params);
    }
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: BindParams = [],
): T | undefined {
  const rows = queryAll<T>(sql, params);
  return rows[0];
}

export function runSql(sql: string, params: BindParams = []): number {
  const db = getDb();
  db.run(sql, params);
  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  return row?.id ?? 0;
}
