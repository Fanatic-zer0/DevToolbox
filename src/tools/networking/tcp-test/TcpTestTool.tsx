import { useState } from 'react';
import { Play, CheckCircle, XCircle, RefreshCw, Plus, Trash2 } from 'lucide-react';

interface TestTarget {
  id: string;
  host: string;
  port: string;
}

interface TestResult {
  id: string;
  host: string;
  port: number;
  status: 'pending' | 'open' | 'closed' | 'timeout' | 'error';
  rtt: number | null;
  error?: string;
}

// Strategy: attempt an HTTP fetch to the host:port with a timeout.
// For HTTP ports this gives a definitive answer; for non-HTTP ports we'll
// get a network error that differs from a clean connection-refused.
async function testPort(host: string, port: number, timeoutMs = 5000): Promise<{ status: 'open' | 'closed' | 'timeout' | 'error'; rtt: number | null; error?: string }> {
  const t0 = performance.now();
  const scheme = port === 443 || port === 8443 ? 'https' : 'http';
  const url = `${scheme}://${host}:${port}`;
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    // If fetch completes (even with no-cors opaque response), the port is open/reachable
    return { status: 'open', rtt: Math.round(performance.now() - t0) };
  } catch (e: unknown) {
    const rtt = Math.round(performance.now() - t0);
    const msg = String(e);
    // AbortError after full timeout → timeout
    if (msg.includes('AbortError') || msg.includes('timeout') || rtt >= timeoutMs - 50) {
      return { status: 'timeout', rtt: null, error: 'Connection timed out' };
    }
    // Network error that resolved quickly can mean "connection refused"
    if (rtt < 1000 && (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION_REFUSED'))) {
      return { status: 'closed', rtt, error: 'Connection refused' };
    }
    // For non-HTTP protocols, a "protocol error" still means the port responded → open
    if (msg.includes('ERR_INVALID_HTTP_RESPONSE') || msg.includes('net::ERR') && !msg.includes('REFUSED') && !msg.includes('UNREACHABLE')) {
      return { status: 'open', rtt, error: 'Port open (non-HTTP response)' };
    }
    return { status: 'error', rtt, error: msg };
  }
}

const COMMON_TARGETS: { host: string; port: number; label: string }[] = [
  { host: '1.1.1.1', port: 53, label: 'Cloudflare DNS' },
  { host: '8.8.8.8', port: 53, label: 'Google DNS' },
  { host: 'github.com', port: 443, label: 'GitHub HTTPS' },
  { host: 'github.com', port: 22, label: 'GitHub SSH' },
  { host: 'smtp.gmail.com', port: 587, label: 'Gmail SMTP' },
];

function genId() { return Math.random().toString(36).slice(2); }

function StatusIcon({ status }: { status: TestResult['status'] }) {
  if (status === 'pending') return <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />;
  if (status === 'open') return <CheckCircle size={14} color="#34d399" />;
  if (status === 'closed') return <XCircle size={14} color="#ef4444" />;
  if (status === 'timeout') return <XCircle size={14} color="#f59e0b" />;
  return <XCircle size={14} color="#64748b" />;
}

function statusLabel(status: TestResult['status']): { text: string; color: string } {
  switch (status) {
    case 'open':    return { text: 'Open',    color: '#34d399' };
    case 'closed':  return { text: 'Closed',  color: '#ef4444' };
    case 'timeout': return { text: 'Timeout', color: '#f59e0b' };
    case 'error':   return { text: 'Error',   color: '#64748b' };
    default:        return { text: 'Testing…', color: 'var(--text-muted)' };
  }
}

export default function TcpTestTool() {
  const [targets, setTargets] = useState<TestTarget[]>([
    { id: genId(), host: 'github.com', port: '443' },
    { id: genId(), host: 'github.com', port: '22' },
  ]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeout, setTimeoutMs] = useState(5000);

  function addTarget() {
    setTargets((prev) => [...prev, { id: genId(), host: '', port: '' }]);
  }

  function removeTarget(id: string) {
    setTargets((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTarget(id: string, field: 'host' | 'port', value: string) {
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  }

  function loadPreset(preset: typeof COMMON_TARGETS[0]) {
    const exists = targets.find((t) => t.host === preset.host && t.port === String(preset.port));
    if (!exists) {
      setTargets((prev) => [...prev, { id: genId(), host: preset.host, port: String(preset.port) }]);
    }
  }

  async function runTests() {
    const valid = targets.filter((t) => t.host.trim() && t.port.trim() && !isNaN(parseInt(t.port)));
    if (valid.length === 0) return;

    setLoading(true);
    const initial: TestResult[] = valid.map((t) => ({
      id: t.id, host: t.host.trim(), port: parseInt(t.port), status: 'pending', rtt: null,
    }));
    setResults(initial);

    await Promise.all(
      valid.map(async (t) => {
        const port = parseInt(t.port);
        const result = await testPort(t.host.trim(), port, timeout);
        setResults((prev) => prev.map((r) => r.id === t.id ? { ...r, ...result } : r));
      })
    );
    setLoading(false);
  }

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>TCP Connection Tester</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Test if a host:port is reachable from your machine — replaces <code>nc -zv host port</code> or <code>telnet host port</code>
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Targets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hosts to test</label>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Timeout (ms)</label>
              <input
                type="number"
                className="input-base w-20 text-center text-xs"
                value={timeout}
                min={500} max={30000} step={500}
                onChange={(e) => setTimeoutMs(Math.max(500, parseInt(e.target.value) || 5000))}
              />
            </div>
          </div>

          {targets.map((t) => (
            <div key={t.id} className="flex gap-2">
              <input
                className="input-base flex-1 font-mono text-sm"
                value={t.host}
                onChange={(e) => updateTarget(t.id, 'host', e.target.value)}
                placeholder="hostname or IP"
              />
              <input
                className="input-base w-24 font-mono text-sm text-center"
                value={t.port}
                onChange={(e) => updateTarget(t.id, 'port', e.target.value)}
                placeholder="port"
                type="number"
                min={1}
                max={65535}
              />
              <button className="btn btn-ghost p-2" onClick={() => removeTarget(t.id)} disabled={targets.length === 1}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <button className="btn btn-ghost btn-sm flex items-center gap-1.5" onClick={addTarget}>
            <Plus size={12} /> Add host
          </button>
        </div>

        {/* Quick presets */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Quick presets</div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_TARGETS.map((p) => (
              <button key={`${p.host}:${p.port}`} className="btn btn-ghost btn-sm" onClick={() => loadPreset(p)}>
                {p.label} <span className="font-mono ml-1 opacity-60">:{p.port}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          className="btn btn-primary w-full flex items-center justify-center gap-2"
          onClick={runTests}
          disabled={loading || targets.every((t) => !t.host.trim() || !t.port.trim())}
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? 'Testing…' : `Test ${targets.filter((t) => t.host.trim() && t.port.trim()).length} connection(s)`}
        </button>

        {/* Results */}
        {results.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Results
            </div>
            <div className="divide-y">
              {results.map((r) => {
                const { text, color } = statusLabel(r.status);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <StatusIcon status={r.status} />
                    <span className="font-mono text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                      {r.host}:<span style={{ color: 'var(--accent)' }}>{r.port}</span>
                    </span>
                    <span className="font-semibold text-xs" style={{ color }}>{text}</span>
                    {r.rtt !== null && (
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{r.rtt}ms</span>
                    )}
                    {r.error && r.status !== 'closed' && r.status !== 'timeout' && (
                      <span className="text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>{r.error}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="rounded p-3 text-xs" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> Uses HTTP requests to test reachability. HTTP/HTTPS ports give the most reliable results. 
          Non-HTTP ports (like 22, 25, 5432) may show as "open" if the server responds or "error" with a protocol mismatch — both indicate the port is reachable.
          True ICMP/TCP connection testing requires native access (see your terminal: <code className="font-mono">nc -zv host port</code>).
        </div>
      </div>
    </div>
  );
}
