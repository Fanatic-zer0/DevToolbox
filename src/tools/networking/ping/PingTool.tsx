import { useState, useRef } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';

interface PingResult {
  seq: number;
  rtt: number | null;
  error?: string;
}

interface PingSummary {
  sent: number;
  received: number;
  min: number;
  max: number;
  avg: number;
  jitter: number;
}

const EXAMPLES = ['https://cloudflare.com', 'https://google.com', 'https://github.com', 'https://1.1.1.1'];
const DEFAULT_COUNT = 10;

function computeSummary(results: PingResult[]): PingSummary {
  const rtts = results.filter((r) => r.rtt !== null).map((r) => r.rtt as number);
  if (rtts.length === 0) return { sent: results.length, received: 0, min: 0, max: 0, avg: 0, jitter: 0 };
  const min = Math.min(...rtts);
  const max = Math.max(...rtts);
  const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
  const jitter = rtts.length > 1
    ? Math.sqrt(rtts.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / rtts.length)
    : 0;
  return { sent: results.length, received: rtts.length, min, max, avg: Math.round(avg), jitter: Math.round(jitter) };
}

function rttColor(rtt: number): string {
  if (rtt < 50) return '#34d399';
  if (rtt < 150) return '#a78bfa';
  if (rtt < 300) return '#f59e0b';
  return '#ef4444';
}

function Bar({ rtt, max }: { rtt: number; max: number }) {
  const pct = Math.min(100, Math.round((rtt / Math.max(max, 1)) * 100));
  return (
    <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: 'var(--bg-tertiary)', minWidth: 60 }}>
      <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: rttColor(rtt) }} />
    </div>
  );
}

export default function PingTool() {
  const [url, setUrl] = useState('https://cloudflare.com');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [interval, setIntervalMs] = useState(500);
  const [results, setResults] = useState<PingResult[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  async function start(targetUrl = url.trim()) {
    if (!targetUrl) return;
    const finalUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    stopRef.current = false;
    setResults([]);
    setRunning(true);

    for (let seq = 1; seq <= count; seq++) {
      if (stopRef.current) break;
      const t0 = performance.now();
      try {
        await fetch(finalUrl, {
          method: 'HEAD',
          mode: 'no-cors', // no-cors avoids CORS errors but still measures latency
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        });
        const rtt = Math.round(performance.now() - t0);
        setResults((prev) => [...prev, { seq, rtt }]);
      } catch (e) {
        setResults((prev) => [...prev, { seq, rtt: null, error: String(e) }]);
      }
      if (seq < count && !stopRef.current) {
        await new Promise((res) => setTimeout(res, interval));
      }
    }
    setRunning(false);
  }

  function stop() {
    stopRef.current = true;
    setRunning(false);
  }

  const summary = computeSummary(results);
  const maxRtt = Math.max(...results.filter((r) => r.rtt !== null).map((r) => r.rtt as number), 1);
  const lossRate = results.length > 0 ? Math.round(((results.length - summary.received) / results.length) * 100) : 0;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ping / Latency Test</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Measure HTTP round-trip latency to any URL — min, avg, max, jitter and packet loss
          <span className="ml-1 opacity-60">(uses HTTP HEAD requests, not ICMP ping)</span>
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Config */}
        <div className="flex gap-2">
          <input
            className="input-base flex-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !running && start()}
            placeholder="https://example.com"
            disabled={running}
          />
          <div className="flex items-center gap-1.5">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Count</label>
            <input
              type="number"
              className="input-base w-16 text-center"
              value={count}
              min={1} max={50}
              onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
              disabled={running}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Interval (ms)</label>
            <input
              type="number"
              className="input-base w-20 text-center"
              value={interval}
              min={100} max={5000} step={100}
              onChange={(e) => setIntervalMs(Math.max(100, parseInt(e.target.value) || 500))}
              disabled={running}
            />
          </div>
          {!running ? (
            <button className="btn btn-primary flex items-center gap-1.5" onClick={() => start()} disabled={!url.trim()}>
              <Play size={13} /> Start
            </button>
          ) : (
            <button className="btn flex items-center gap-1.5" style={{ background: '#ef4444', color: 'white' }} onClick={stop}>
              <Square size={13} /> Stop
            </button>
          )}
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="btn btn-ghost btn-sm" onClick={() => setUrl(ex)} disabled={running}>{ex}</button>
          ))}
        </div>

        {/* Live summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Sent', value: String(summary.sent) },
              { label: 'Received', value: String(summary.received) },
              { label: 'Loss', value: `${lossRate}%`, color: lossRate > 0 ? '#ef4444' : '#34d399' },
              { label: 'Avg RTT', value: `${summary.avg}ms`, color: rttColor(summary.avg) },
              { label: 'Jitter', value: `${summary.jitter}ms` },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg text-center py-2 px-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="text-base font-bold font-mono" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* RTT stats */}
        {summary.received > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Min', value: summary.min },
              { label: 'Avg', value: summary.avg },
              { label: 'Max', value: summary.max },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg text-center py-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-bold font-mono" style={{ color: rttColor(value) }}>{value}ms</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Running indicator */}
        {running && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={11} className="animate-spin" />
            Pinging {url}… ({results.length}/{count})
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Probe Results
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {results.map((r) => (
                <div key={r.seq} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="font-mono text-xs w-12 shrink-0" style={{ color: 'var(--text-muted)' }}>#{r.seq}</span>
                  {r.rtt !== null ? (
                    <>
                      <span className="font-mono text-xs w-16 shrink-0 text-right" style={{ color: rttColor(r.rtt) }}>{r.rtt}ms</span>
                      <Bar rtt={r.rtt} max={maxRtt} />
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: '#ef4444' }}>timeout — {r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
