import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { TrendingUp } from 'lucide-react';
import type { TimeSeriesMonitor } from '../types/monitor';

interface LatencyTrendChartProps {
  timeSeries: TimeSeriesMonitor[];
  selectedGroup: string;
}

const SERIES_PALETTE = [
  '#22d3ee', // cyan-400
  '#10b981', // emerald-500
  '#38bdf8', // sky-400
  '#a78bfa', // violet-400
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#2dd4bf', // teal-400
  '#fb923c', // orange-400
];

function formatAxisTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

export function LatencyTrendChart({
  timeSeries,
  selectedGroup,
}: LatencyTrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const visibleSeries = useMemo(() => {
    if (selectedGroup === '全部') return timeSeries;
    return timeSeries.filter((s) => s.groupName === selectedGroup);
  }, [timeSeries, selectedGroup]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const maxPoints = visibleSeries.reduce(
      (max, item) => Math.max(max, item.points.length),
      0,
    );

    const longestPoints =
      visibleSeries.find((s) => s.points.length === maxPoints)?.points ?? [];
    const xLabels = longestPoints.map((p) => formatAxisTime(p.time));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(7, 13, 28, 0.95)',
        borderColor: 'rgba(34, 211, 238, 0.4)',
        borderWidth: 1,
        textStyle: {
          color: '#e2e8f0',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(34, 211, 238, 0.45)',
            type: 'dashed',
          },
        },
      },
      legend: {
        type: 'scroll',
        top: 0,
        left: 0,
        right: 0,
        textStyle: {
          color: '#94a3b8',
          fontSize: 11,
        },
        pageTextStyle: {
          color: '#94a3b8',
        },
        pageIconColor: '#22d3ee',
        pageIconInactiveColor: '#334155',
      },
      grid: {
        top: 42,
        left: 46,
        right: 18,
        bottom: 26,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xLabels.length > 0 ? xLabels : ['等待首次巡检'],
        axisLine: {
          lineStyle: { color: 'rgba(51, 65, 85, 0.8)' },
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        },
      },
      yAxis: {
        type: 'value',
        name: 'ms',
        nameTextStyle: {
          color: '#64748b',
          fontSize: 10,
          padding: [0, 24, 0, 0],
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(30, 41, 59, 0.8)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        },
      },
      series: visibleSeries.map((item, idx) => {
        const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
        const padCount = Math.max(0, maxPoints - item.points.length);
        const alignedValues: (number | null)[] = [
          ...Array.from({ length: padCount }, () => null),
          ...item.points.map((p) => p.latencyMs),
        ];

        return {
          name: item.name,
          type: 'line',
          smooth: 0.32,
          showSymbol: false,
          symbolSize: 6,
          data: alignedValues,
          lineStyle: {
            width: 2,
            color,
          },
          itemStyle: {
            color,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${color}33` },
              { offset: 1, color: `${color}02` },
            ]),
          },
        };
      }),
    };

    chart.setOption(option, { notMerge: true });
  }, [visibleSeries]);

  return (
    <section className="datav-panel flex flex-col rounded-xl p-5 shadow-datav-glow">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-slate-100 sm:text-base">
              实时响应时延趋势图
            </h2>
            <p className="text-[11px] text-slate-400">
              多端点近 30 次探测毫秒级响应曲线（随分组过滤自动聚焦）
            </p>
          </div>
        </div>
        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
          {visibleSeries.length} 条序列
        </span>
      </div>

      <div ref={containerRef} className="h-72 w-full flex-1 min-h-[280px]" />
    </section>
  );
}
