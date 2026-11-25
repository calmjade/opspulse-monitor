import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

interface AddMonitorModalProps {
  open: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    url: string;
    groupName: string;
    thresholdMs: number;
  }) => Promise<boolean>;
}

const PRESET_GROUPS = [
  '展示门户',
  'Java 微服务',
  'Node 微服务',
  'AI 引擎',
  '全栈 BFF',
  '监控引擎',
  '自定义服务',
];

export function AddMonitorModal({
  open,
  serverError,
  onClose,
  onSubmit,
}: AddMonitorModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('http://localhost:');
  const [groupName, setGroupName] = useState('自定义服务');
  const [thresholdMs, setThresholdMs] = useState('800');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedGroup = groupName.trim() || '自定义服务';
    const parsedThreshold = Number(thresholdMs);

    if (!trimmedName) {
      setLocalError('请输入服务名称');
      return;
    }

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setLocalError('仅支持 http:// 或 https:// 协议');
        return;
      }
    } catch {
      setLocalError('请输入有效的 HTTP/HTTPS 探测 URL');
      return;
    }

    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 50 || parsedThreshold > 30000) {
      setLocalError('延迟告警阈值须在 50 ~ 30000 ms 之间');
      return;
    }

    setSubmitting(true);
    const ok = await onSubmit({
      name: trimmedName,
      url: trimmedUrl,
      groupName: trimmedGroup,
      thresholdMs: Math.round(parsedThreshold),
    });
    setSubmitting(false);

    if (ok) {
      setName('');
      setUrl('http://localhost:');
      setGroupName('自定义服务');
      setThresholdMs('800');
      onClose();
    }
  };

  const displayError = localError ?? serverError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="datav-panel w-full max-w-lg rounded-xl p-6 shadow-datav-glow">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              新增服务监控端点
            </h3>
            <p className="text-xs text-slate-400">
              提交后立即触发首次 HTTP 健康拨测并纳入 10s 巡检队列
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              服务名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：订单网关 API (NestJS)"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              探测 URL (HTTP / HTTPS) *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8080/api/health"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 font-mono text-sm text-cyan-200 placeholder-slate-500 outline-none focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                所属分组
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                list="opspulse-group-presets"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
              <datalist id="opspulse-group-presets">
                {PRESET_GROUPS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                延迟告警阈值 (ms)
              </label>
              <input
                type="number"
                min={50}
                max={30000}
                step={50}
                value={thresholdMs}
                onChange={(e) => setThresholdMs(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {displayError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
              {displayError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-datav-glow hover:bg-cyan-500/30 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{submitting ? '添加并拨测中...' : '确认添加并拨测'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
