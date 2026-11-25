import { useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import type { IncidentItem } from '../types/monitor';

interface IncidentTimelineProps {
  incidents: IncidentItem[];
  onAckIncident: (id: number) => void;
}

type IncidentFilter = 'all' | 'open' | 'resolved';

function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function IncidentTimeline({
  incidents,
  onAckIncident,
}: IncidentTimelineProps) {
  const [filter, setFilter] = useState<IncidentFilter>('all');

  const filtered = incidents.filter((inc) => {
    if (filter === 'all') return true;
    return inc.status === filter;
  });

  const openCount = incidents.filter((i) => i.status === 'open').length;

  return (
    <section className="datav-panel flex flex-col rounded-xl p-5 shadow-datav-glow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              openCount > 0
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <BellRing className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-slate-100 sm:text-base">
              故障告警时间线
            </h2>
            <p className="text-[11px] text-slate-400">
              异常自动开单 · 恢复自动闭环 · 支持人工确认
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-0.5 text-[11px]">
          {(
            [
              { id: 'all', label: '全部' },
              { id: 'open', label: '告警中' },
              { id: 'resolved', label: '已恢复' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-2 py-1 font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[300px] flex-1 space-y-2.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-400/70" />
            <p className="text-xs font-medium text-slate-300">暂无匹配告警事件</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              服务运行健康，拨测异常时将自动生成事件记录
            </p>
          </div>
        ) : (
          filtered.map((inc) => {
            const isOpen = inc.status === 'open';
            const isCritical = inc.severity === 'critical';
            const isAcked = inc.acknowledged === 1;

            return (
              <div
                key={inc.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isOpen
                    ? isCritical
                      ? 'border-rose-500/40 bg-rose-950/20'
                      : 'border-amber-500/40 bg-amber-950/20'
                    : 'border-slate-800 bg-slate-900/50 opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isOpen ? (
                        isCritical ? (
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      )}
                      <span className="truncate text-xs font-semibold text-slate-100">
                        {inc.monitor_name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                          isOpen
                            ? isCritical
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {isOpen ? inc.severity : 'resolved'}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-[11px] text-slate-300">
                      {inc.reason}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        触发: {formatDateTime(inc.started_at)}
                      </span>
                      {inc.resolved_at && (
                        <span className="text-emerald-400/90">
                          恢复: {formatDateTime(inc.resolved_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isAcked ? (
                      <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] text-cyan-300">
                        <Check className="h-3 w-3" />
                        已确认
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAckIncident(inc.id)}
                        className="rounded border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/25"
                      >
                        确认告警
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
