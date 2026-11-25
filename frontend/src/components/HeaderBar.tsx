import { Activity, Plus, Radio, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { WsConnectionState } from '../store/useOpsStore';

interface HeaderBarProps {
  wsStatus: WsConnectionState;
  lastHeartbeat: string | null;
  probingAll: boolean;
  wsClients: number;
  onRunAll: () => void;
  onOpenAddModal: () => void;
}

function formatHeartbeat(iso: string | null): string {
  if (!iso) return '--:--:--.---';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--.---';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function HeaderBar({
  wsStatus,
  lastHeartbeat,
  probingAll,
  wsClients,
  onRunAll,
  onOpenAddModal,
}: HeaderBarProps) {
  const isConnected = wsStatus === 'connected';
  const isConnecting = wsStatus === 'connecting';

  return (
    <header className="datav-panel rounded-xl px-5 py-4 shadow-datav-glow">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Brand & Title */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 shadow-datav-glow">
            <Activity className="h-6 w-6 text-cyan-300" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-xl font-bold tracking-wide text-transparent sm:text-2xl">
                脉搏智维 OPSPULSE
              </h1>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                DataV Command Cockpit
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              全栈生态服务实时健康拨测 · 毫秒级 WebSocket 流式推送与故障自愈监控台
            </p>
          </div>
        </div>

        {/* Status Badges & Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* WebSocket Live Stream Badge */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              isConnected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : isConnecting
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <Wifi className="h-3.5 w-3.5" />
                <span>WS 实时流已连接 · 毫秒级推送</span>
                <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
                  {wsClients} 在线
                </span>
              </>
            ) : isConnecting ? (
              <>
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                <span>WS 通道握手中...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>WS 连接断开 · 自动重连中</span>
              </>
            )}
          </div>

          {/* Last Heartbeat */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs">
            <span className="text-slate-400">上次心跳</span>
            <span className="font-mono font-semibold text-cyan-300">
              {formatHeartbeat(lastHeartbeat)}
            </span>
          </div>

          {/* Run All Probes Button */}
          <button
            type="button"
            onClick={onRunAll}
            disabled={probingAll}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-datav-glow transition-all hover:border-cyan-300 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probingAll ? 'animate-spin' : ''}`} />
            <span>{probingAll ? '全量拨测中...' : '一键立即全量拨测'}</span>
          </button>

          {/* Add Monitor Modal Trigger */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition-all hover:border-emerald-300 hover:bg-emerald-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>新增监控端点</span>
          </button>
        </div>
      </div>
    </header>
  );
}
