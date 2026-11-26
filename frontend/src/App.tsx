import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AddMonitorModal } from './components/AddMonitorModal';
import { HeaderBar } from './components/HeaderBar';
import { IncidentTimeline } from './components/IncidentTimeline';
import { KpiRow } from './components/KpiRow';
import { LatencyTrendChart } from './components/LatencyTrendChart';
import { ServiceHealthMatrix } from './components/ServiceHealthMatrix';
import { useOpsStore } from './store/useOpsStore';

export function App() {
  const {
    monitors,
    summary,
    incidents,
    timeSeries,
    lastHeartbeat,
    wsStatus,
    loading,
    probingAll,
    probingIds,
    selectedGroup,
    errorMsg,
    setSelectedGroup,
    clearError,
    fetchDashboard,
    connectWebSocket,
    runAllProbes,
    probeMonitor,
    createMonitor,
    toggleMonitor,
    updateThreshold,
    deleteMonitor,
    ackIncident,
  } = useOpsStore();

  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    void fetchDashboard();
    const disconnect = connectWebSocket();
    return () => {
      disconnect();
    };
  }, [fetchDashboard, connectWebSocket]);

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1560px] space-y-5">
        <HeaderBar
          wsStatus={wsStatus}
          lastHeartbeat={lastHeartbeat}
          probingAll={probingAll}
          wsClients={summary.wsClients}
          onRunAll={() => void runAllProbes()}
          onOpenAddModal={() => {
            clearError();
            setAddModalOpen(true);
          }}
        />

        {errorMsg && !addModalOpen && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="rounded p-1 text-rose-300 hover:bg-rose-500/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <KpiRow summary={summary} />

        {loading && monitors.length === 0 ? (
          <div className="datav-panel flex h-48 items-center justify-center rounded-xl text-sm text-cyan-300">
            正在建立实时拨测通道并加载大屏快照...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <LatencyTrendChart
                  timeSeries={timeSeries}
                  selectedGroup={selectedGroup}
                />
              </div>
              <div className="xl:col-span-5">
                <IncidentTimeline
                  incidents={incidents}
                  onAckIncident={(id) => void ackIncident(id)}
                />
              </div>
            </div>

            <ServiceHealthMatrix
              monitors={monitors}
              selectedGroup={selectedGroup}
              probingIds={probingIds}
              onSelectGroup={setSelectedGroup}
              onProbeMonitor={(id) => void probeMonitor(id)}
              onToggleMonitor={(id, enabled) => void toggleMonitor(id, enabled)}
              onUpdateThreshold={(id, thresholdMs) =>
                void updateThreshold(id, thresholdMs)
              }
              onDeleteMonitor={(id) => void deleteMonitor(id)}
            />
          </>
        )}

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-800/70 pt-4 text-[11px] text-slate-500 sm:flex-row">
          <span>
            脉搏智维 OpsPulse · MIT License · Copyright © 2026 曹杰 (calmjade)
          </span>
          <div className="flex items-center gap-4 font-mono">
            <a
              href="https://github.com/calmjade"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-300"
            >
              GitHub: calmjade
            </a>
          </div>
        </footer>
      </div>

      <AddMonitorModal
        open={addModalOpen}
        serverError={errorMsg}
        onClose={() => {
          clearError();
          setAddModalOpen(false);
        }}
        onSubmit={createMonitor}
      />
    </div>
  );
}

export default App;
