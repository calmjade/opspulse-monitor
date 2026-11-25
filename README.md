# 脉搏智维 OpsPulse — 实时服务健康拨测与 DataV 可视化运维大屏

> **OpsPulse Monitor** 是一款面向微服务与全栈生态的实时健康拨测引擎与 **DataV 黑曜青（Obsidian/Cyan）运维指挥舱**，支持毫秒级 WebSocket 实时状态流推送、Uptime-Kuma 风格 30 格心跳脉搏条、P50/P95 时延统计、多序列 ECharts 实时趋势图与自动化故障事件闭环管理。

- **作者**：曹杰 / caojie (`calmjade`)
- **邮箱**：calmjade@foxmail.com
- **GitHub**：https://github.com/calmjade
- **Gitee**：https://gitee.com/jiejie12315
- **开源协议**：MIT License

---

## 核心特性

- **零原生依赖持久化引擎**：基于纯 WebAssembly 的 `sql.js` 持久化至 `./data/opspulse.sqlite`，无需 C++ 编译环境，开箱即用。
- **全栈生态预置拨测矩阵**：内置曹杰本地全栈服务生态（Nuxt 4 个人门户、Spring Boot 数据驿站、Fastify 星枢研发舱、Hono SSE 智问数舱、Next.js 易采协同台及脉搏智维自检节点），启动即开始真实 HTTP 拨测。
- **10 秒高频自动巡检 + 一键全量/单点触发**：内置 `AbortController` 3000ms 超时控制，自动计算 SLA 可用率、P50 / P95 延迟与最近 100 条历史记录清理。
- **WebSocket 毫秒级实时大屏推送**：服务端每完成一轮巡检或单点拨测，立即通过 `/ws` 广播 `probe_batch` 事件，前端 Zustand 状态树无感刷新 ECharts 与心跳条。
- **故障事件自动开单与自愈闭环**：当节点超时、报错或突破延迟阈值时自动生成 `incidents` 告警事件；服务恢复后自动标为 `resolved`，并支持运维人员手动确认（Acknowledge）。

---

## 技术栈与端口规划

| 模块 | 技术选型 | 默认端口 | 说明 |
| --- | --- | --- | --- |
| 后端引擎 (`backend/`) | Node.js 20 + TypeScript + Express + ws + sql.js | `8095` | HTTP `/api/*` 与 WebSocket `/ws` |
| 前端大屏 (`frontend/`) | React 18 + TypeScript + Vite 6 + Zustand + Tailwind CSS + ECharts | `9025` | Vite 代理 `/api` 与 `/ws` 至 `8095` |

---

## 快速启动

### 1. 启动后端引擎（端口 8095）

```bash
cd backend
pnpm install
pnpm dev
```

### 2. 启动前端运维大屏（端口 9025）

```bash
cd frontend
pnpm install
pnpm dev
```

访问 `http://localhost:9025` 即可进入 **脉搏智维 OpsPulse 运维指挥舱**。

---

## REST API & WebSocket 接口

- `GET /api/health`：返回服务健康状态、监控节点数及当前 WebSocket 客户端连接数
- `GET /api/dashboard`：返回完整大屏聚合视图（节点详情、近 30 次拨测日志、SLA %、P50/P95 延迟、事件列表、时延趋势序列）
- `GET /api/monitors` / `POST /api/monitors`：查询或新增监控端点
- `PATCH /api/monitors/:id` / `DELETE /api/monitors/:id`：启停监控、调整阈值或删除端点
- `POST /api/probes/run-all` / `POST /api/monitors/:id/probe`：立即全量拨测或单点拨测
- `GET /api/incidents` / `PATCH /api/incidents/:id/ack`：获取故障事件与确认告警
- `WS ws://localhost:8095/ws`：连接后接收 `snapshot` 初始快照，每次巡检/拨测推送 `probe_batch` 增量包
