import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { AlertTriangle, Gauge, ShieldCheck, Timer } from 'lucide-react';
import type { DashboardSummary } from '../types/monitor';

interface KpiRowProps {
  summary: DashboardSummary;
}

export function KpiRow({ summary }: KpiRowProps) {
  const gaugeRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!gaugeRef.current) return;
    const chart = echarts.init(gaugeRef.current);
    chartInstanceRef.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const total = Math.max(summary.totalMonitors, 1);
    const healthyRatio = Math.round((summary.healthyMonitors / total) * 100);

    chart.setOption({
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          radius: '92%',
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            itemStyle: {
              color:
                summary.downMonitors > 0
                  ? '#f59e0b'
                  : '#10b981',
            },
          },
          axisLine: {
            lineStyle: {
              width: 8,
              color: [[1, 'rgba(30, 41, 59, 0.9)']],
            },
          },
          splitLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          data: [
            {
              value: healthyRatio,
              name: '在线率',
            },
          ],
          title: {
            show: false,
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, 0],
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#e2e8f0',
            formatter: `${summary.healthyMonitors}/${summary.totalMonitors}`,
          },
        },
      ],
    });
  }, [summary.healthyMonitors, summary.totalMonitors, summary.downMonitors]);

  const slaColor =
    summary.overallSla >= 99
      ? 'text-emerald-300'
      : summary.overallSla >= 90
        ? 'text-amber-300'
        : 'text-rose-400';

  const hasOpenAlerts = summary.openIncidentsCount > 0;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1: Overall SLA Availability */}
      <div className="datav-panel rounded-xl p-4 shadow-datav-glow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              全局 SLA 可用率
            </p>
            <div className={`mt-2 font-mono text-3xl font-bold ${slaColor}`}>
              {summary.overallSla.toFixed(2)}%
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, summary.overallSla))}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>近 30 次窗口聚合</span>
            <span className="font-mono text-cyan-300">
              启用节点 {summary.enabledMonitors}/{summary.totalMonitors}
            </span>
          </div>
        </div>
      </div>

      {/* KPI 2: Avg P50 / P95 Latency */}
      <div className="datav-panel rounded-xl p-4 shadow-datav-glow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              平均 P50 / P95 响应时延
            </p>
            <div className="mt-2 flex items-baseline gap-2 font-mono">
              <span className="text-3xl font-bold text-cyan-300">
                {summary.avgP50Latency}
              </span>
              <span className="text-xs text-slate-400">ms</span>
              <span className="text-slate-600">/</span>
              <span className="text-xl font-semibold text-amber-300">
                {summary.avgP95Latency}
              </span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-cyan-300">
            <Timer className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
          <span>P50 中位响应 · P95 尾延迟</span>
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-cyan-300">
            超时熔断 3000ms
          </span>
        </div>
      </div>

      {/* KPI 3: Healthy / Total Nodes ECharts Ring Gauge */}
      <div className="datav-panel rounded-xl p-4 shadow-datav-glow">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
              <Gauge className="h-3.5 w-3.5 text-cyan-400" />
              <span>健康 / 总节点环图</span>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300">● 健康运行</span>
                <span className="font-mono font-semibold text-slate-200">
                  {summary.healthyMonitors}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-300">● 降级超时</span>
                <span className="font-mono font-semibold text-slate-200">
                  {summary.degradedMonitors}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-400">● 离线异常</span>
                <span className="font-mono font-semibold text-slate-200">
                  {summary.downMonitors}
                </span>
              </div>
            </div>
          </div>
          <div ref={gaugeRef} className="h-24 w-24 shrink-0" />
        </div>
      </div>

      {/* KPI 4: Active Alerts Count */}
      <div
        className={`datav-panel rounded-xl p-4 transition-shadow ${
          hasOpenAlerts ? 'shadow-datav-danger border-rose-500/40' : 'shadow-datav-emerald'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              活跃告警事件
            </p>
            <div className="mt-2 flex items-baseline gap-2.5 font-mono">
              <span
                className={`text-3xl font-bold ${
                  hasOpenAlerts ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {summary.openIncidentsCount}
              </span>
              <span className="text-xs text-slate-400">
                未确认 {summary.unackedIncidentsCount}
              </span>
            </div>
          </div>
          <div
            className={`rounded-lg border p-2.5 ${
              hasOpenAlerts
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <AlertTriangle className={`h-5 w-5 ${hasOpenAlerts ? 'animate-pulse' : ''}`} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">
            {hasOpenAlerts ? '存在异常端点，恢复后将自动闭环' : '所有拨测节点状态平稳'}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono ${
              hasOpenAlerts
                ? 'bg-rose-500/20 text-rose-300'
                : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {hasOpenAlerts ? 'ALERTING' : 'NOMINAL'}
          </span>
        </div>
      </div>
    </section>
  );
}
