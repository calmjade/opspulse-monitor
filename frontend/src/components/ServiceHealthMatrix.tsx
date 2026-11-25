import { useState } from 'react';
import {
  Activity,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { MonitorView, ProbeHistoryItem } from '../types/monitor';

interface ServiceHealthMatrixProps {
  monitors: MonitorView[];
  selectedGroup: string;
  probingIds: Record<number, boolean>;
  onSelectGroup: (group: string) => void;
  onProbeMonitor: (id: number) => void;
  onToggleMonitor: (id: number, enabled: boolean) => void;
  onUpdateThreshold: (id: number, thresholdMs: number) => void;
  onDeleteMonitor: (id: number) => void;
}

const TOTAL_HEARTBEAT_BARS = 30;

const STATUS_META: Record<
  MonitorView['currentStatus'],
  { label: string; badge: string; dot: string; border: string }
> = {
  up: {
    label: 'HEALTHY',
    badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    dot: 'bg-emerald-400',
    border: 'border-cyan-500/20 hover:border-cyan-400/45',
  },
  degraded: {
    label: 'DEGRADED',
    badge: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    dot: 'bg-amber-400',
    border: 'border-amber-500/35 hover:border-amber-400/60',
  },
  down: {
    label: 'DOWN',
    badge: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-500/40 hover:border-rose-400/70',
  },
  paused: {
    label: 'PAUSED',
    badge: 'border-slate-600/50 bg-slate-700/30 text-slate-400',
    dot: 'bg-slate-500',
    border: 'border-slate-700/60 hover:border-slate-500/60',
  },
  unknown: {
    label: 'PENDING',
    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
    border: 'border-slate-700/70 hover:border-cyan-400/40',
  },
};

function formatTimeShort(iso: string | null): string {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

function getBarStyle(item: ProbeHistoryItem | null, thresholdMs: number): string {
  if (!item) {
    return 'bg-slate-800/80 border border-slate-700/40';
  }
  if (item.healthy) {
    return 'bg-emerald-400/90 hover:bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.45)]';
  }
  if (item.statusCode !== null && item.statusCode >= 200 && item.statusCode < 400 && item.latencyMs > thresholdMs) {
    return 'bg-amber-400/90 hover:bg-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.45)]';
  }
  return 'bg-rose-500/90 hover:bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
}

function getBarTooltip(item: ProbeHistoryItem | null): string {
  if (!item) return '暂无拨测记录';
  const statusText = item.healthy ? '正常' : item.errorMsg ?? '异常';
  const codeText = item.statusCode !== null ? `HTTP ${item.statusCode}` : '无响应';
  return `${formatTimeShort(item.checkedAt)} | ${codeText} | ${item.latencyMs}ms | ${statusText}`;
}

export function ServiceHealthMatrix({
  monitors,
  selectedGroup,
  probingIds,
  onSelectGroup,
  onProbeMonitor,
  onToggleMonitor,
  onUpdateThreshold,
  onDeleteMonitor,
}: ServiceHealthMatrixProps) {
  const [editingThresholdId, setEditingThresholdId] = useState<number | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>('1000');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    monitorId: number;
    item: ProbeHistoryItem | null;
  } | null>(null);

  const groups = ['全部', ...Array.from(new Set(monitors.map((m) => m.groupName)))];
  const filteredMonitors =
    selectedGroup === '全部'
      ? monitors
      : monitors.filter((m) => m.groupName === selectedGroup);

  const startEditThreshold = (m: MonitorView) => {
    setEditingThresholdId(m.id);
    setThresholdDraft(String(m.thresholdMs));
  };

  const commitThreshold = (id: number) => {
    const parsed = Number(thresholdDraft);
    if (Number.isFinite(parsed) && parsed >= 50 && parsed <= 30000) {
      onUpdateThreshold(id, Math.round(parsed));
    }
    setEditingThresholdId(null);
  };

  return (
    <section className="datav-panel rounded-xl p-5 shadow-datav-glow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-slate-100 sm:text-base">
              服务健康拨测矩阵
            </h2>
            <p className="text-[11px] text-slate-400">
              Uptime-Kuma 风格 30 格实时脉搏心跳条 · 每 10 秒自动巡检
            </p>
          </div>
        </div>

        {/* Group Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {groups.map((group) => {
            const active = selectedGroup === group;
            const count =
              group === '全部'
                ? monitors.length
                : monitors.filter((m) => m.groupName === group).length;
            return (
              <button
                key={group}
                type="button"
                onClick={() => onSelectGroup(group)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-datav-glow'
                    : 'border-slate-700/70 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {group}
                <span className="ml-1.5 font-mono text-[10px] opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredMonitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 py-12 text-center">
          <Activity className="mb-2 h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-400">当前分组暂无监控端点</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredMonitors.map((m) => {
            const meta = STATUS_META[m.currentStatus];
            const isProbing = Boolean(probingIds[m.id]);
            const paddedHistory: (ProbeHistoryItem | null)[] = [
              ...Array.from(
                { length: Math.max(0, TOTAL_HEARTBEAT_BARS - m.history.length) },
                () => null,
              ),
              ...m.history.slice(-TOTAL_HEARTBEAT_BARS),
            ];
            const activeHover =
              hoveredSlot && hoveredSlot.monitorId === m.id ? hoveredSlot.item : null;

            return (
              <article
                key={m.id}
                className={`rounded-xl border bg-slate-950/75 p-4 transition-all ${meta.border}`}
              >
                {/* Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {m.currentStatus === 'up' && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      </span>
                      <h3 className="truncate text-sm font-semibold text-slate-100">
                        {m.name}
                      </h3>
                      <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {m.groupName}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-cyan-400/80 hover:text-cyan-300"
                      >
                        <span className="truncate">{m.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {m.lastStatusCode !== null && (
                      <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                        HTTP {m.lastStatusCode}
                      </span>
                    )}
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Metrics Strip */}
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-slate-800/90 bg-slate-900/60 px-3 py-2 font-mono text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-500">当前时延</span>
                    <span
                      className={`font-semibold ${
                        m.currentLatencyMs === null
                          ? 'text-slate-400'
                          : m.currentLatencyMs > m.thresholdMs
                            ? 'text-amber-300'
                            : 'text-cyan-300'
                      }`}
                    >
                      {m.currentLatencyMs !== null ? `${m.currentLatencyMs} ms` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">SLA 可用率</span>
                    <span
                      className={`font-semibold ${
                        m.slaPercent >= 99
                          ? 'text-emerald-300'
                          : m.slaPercent >= 90
                            ? 'text-amber-300'
                            : 'text-rose-400'
                      }`}
                    >
                      {m.slaPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">P50 / P95</span>
                    <span className="text-slate-200">
                      {m.p50Latency} / {m.p95Latency}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">告警阈值</span>
                    {editingThresholdId === m.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={50}
                          max={30000}
                          value={thresholdDraft}
                          onChange={(e) => setThresholdDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitThreshold(m.id);
                            if (e.key === 'Escape') setEditingThresholdId(null);
                          }}
                          onBlur={() => commitThreshold(m.id)}
                          autoFocus
                          className="w-16 rounded border border-cyan-500/60 bg-slate-950 px-1 py-0.5 text-[11px] text-cyan-200 outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditThreshold(m)}
                        title="点击修改延迟告警阈值"
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-cyan-300"
                      >
                        <span>{m.thresholdMs}ms</span>
                        <SlidersHorizontal className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 30-Bar Uptime-Kuma Heartbeat Strip */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>近 30 次拨测心跳</span>
                    <span className="max-w-[65%] truncate font-mono text-[10px] text-slate-300">
                      {activeHover
                        ? getBarTooltip(activeHover)
                        : `最近巡检: ${formatTimeShort(m.lastCheckedAt)}`}
                    </span>
                  </div>
                  <div
                    className="grid grid-cols-30 gap-1"
                    style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}
                    onMouseLeave={() => setHoveredSlot(null)}
                  >
                    {paddedHistory.map((item, idx) => (
                      <div
                        key={item ? item.id : `empty-${m.id}-${idx}`}
                        title={getBarTooltip(item)}
                        onMouseEnter={() => setHoveredSlot({ monitorId: m.id, item })}
                        className={`h-6 rounded-[3px] transition-transform duration-150 hover:scale-y-110 ${getBarStyle(
                          item,
                          m.thresholdMs,
                        )}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Last Error Message */}
                {m.lastError && m.enabled && (
                  <div className="mt-2.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 font-mono text-[11px] text-rose-300">
                    异常诊断：{m.lastError}
                  </div>
                )}

                {/* Action Footer */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs">
                  <span className="font-mono text-[10px] text-slate-500">
                    NODE #{m.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onProbeMonitor(m.id)}
                      disabled={isProbing}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${isProbing ? 'animate-spin' : ''}`} />
                      <span>{isProbing ? '探测中' : '单点拨测'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleMonitor(m.id, !m.enabled)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        m.enabled
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                      }`}
                    >
                      {m.enabled ? (
                        <>
                          <Pause className="h-3 w-3" />
                          <span>暂停</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          <span>恢复</span>
                        </>
                      )}
                    </button>

                    {confirmDeleteId === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMonitor(m.id);
                            setConfirmDeleteId(null);
                          }}
                          className="rounded-md border border-rose-500/60 bg-rose-500/25 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/35"
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(m.id)}
                        title="删除监控端点"
                        className="inline-flex items-center rounded-md border border-slate-700/80 bg-slate-900/80 p-1.5 text-slate-400 transition-colors hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
