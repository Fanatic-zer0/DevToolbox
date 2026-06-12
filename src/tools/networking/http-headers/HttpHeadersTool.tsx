import { useState } from 'react';
import { Copy, Search, RefreshCw, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

interface HeaderResult {
  url: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  timing: number;
}

// Security header definitions
interface SecurityHeader {
  name: string;
  present: boolean;
  value: string | null;
  grade: 'good' | 'warn' | 'missing';
  tip: string;
}

function analyzeSecurityHeaders(headers: [string, string][]): SecurityHeader[] {
  const map = new Map(headers.map(([k, v]) => [k.toLowerCase(), v]));

  return [
    {
      name: 'Strict-Transport-Security',
      present: map.has('strict-transport-security'),
      value: map.get('strict-transport-security') ?? null,
      grade: map.has('strict-transport-security')
        ? (map.get('strict-transport-security')!.includes('max-age') ? 'good' : 'warn')
        : 'missing',
      tip: 'Enforce HTTPS. Recommended: max-age=31536000; includeSubDomains; preload',
    },
    {
      name: 'Content-Security-Policy',
      present: map.has('content-security-policy'),
      value: map.get('content-security-policy') ?? null,
      grade: map.has('content-security-policy') ? 'good' : 'missing',
      tip: 'Prevent XSS by specifying trusted content sources.',
    },
    {
      name: 'X-Frame-Options',
      present: map.has('x-frame-options'),
      value: map.get('x-frame-options') ?? null,
      grade: map.has('x-frame-options') ? 'good' : 'missing',
      tip: 'Prevent clickjacking. Use DENY or SAMEORIGIN.',
    },
    {
      name: 'X-Content-Type-Options',
      present: map.has('x-content-type-options'),
      value: map.get('x-content-type-options') ?? null,
      grade: map.has('x-content-type-options') && map.get('x-content-type-options') === 'nosniff' ? 'good' : (map.has('x-content-type-options') ? 'warn' : 'missing'),
      tip: 'Prevent MIME sniffing. Set to: nosniff',
    },
    {
      name: 'Referrer-Policy',
      present: map.has('referrer-policy'),
      value: map.get('referrer-policy') ?? null,
      grade: map.has('referrer-policy') ? 'good' : 'warn',
      tip: 'Control referrer info sent with requests. Recommended: strict-origin-when-cross-origin',
    },
    {
      name: 'Permissions-Policy',
      present: map.has('permissions-policy'),
      value: map.get('permissions-policy') ?? null,
      grade: map.has('permissions-policy') ? 'good' : 'warn',
      tip: 'Restrict browser features (camera, mic, geolocation).',
    },
    {
      name: 'Cross-Origin-Opener-Policy',
      present: map.has('cross-origin-opener-policy'),
      value: map.get('cross-origin-opener-policy') ?? null,
      grade: map.has('cross-origin-opener-policy') ? 'good' : 'warn',
      tip: 'Isolate browsing context from cross-origin documents. Recommended: same-origin',
    },
    {
      name: 'X-XSS-Protection',
      present: map.has('x-xss-protection'),
      value: map.get('x-xss-protection') ?? null,
      grade: map.has('x-xss-protection') ? (map.get('x-xss-protection')?.startsWith('0') ? 'warn' : 'good') : 'warn',
      tip: 'Legacy XSS filter. Modern sites disable it (0) and rely on CSP instead.',
    },
  ];
}

function securityScore(headers: SecurityHeader[]): { score: number; grade: string; color: string } {
  const good = headers.filter((h) => h.grade === 'good').length;
  const score = Math.round((good / headers.length) * 100);
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#a78bfa' : score >= 40 ? '#f59e0b' : '#ef4444';
  return { score, grade, color };
}

const INTERESTING_HEADERS = new Set([
  'server', 'x-powered-by', 'x-aspnet-version', 'x-generator',
  'cache-control', 'pragma', 'expires', 'age', 'vary',
  'content-type', 'content-encoding', 'content-length',
  'transfer-encoding', 'connection',
  'access-control-allow-origin', 'access-control-allow-methods',
  'set-cookie', 'www-authenticate',
  'etag', 'last-modified',
  'cf-ray', 'x-amz-cf-id', 'x-vercel-id', 'x-cache',
]);

const EXAMPLES = ['https://cloudflare.com', 'https://github.com', 'https://example.com'];

export default function HttpHeadersTool() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<HeaderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'all' | 'security' | 'interesting'>('security');

  async function inspect(targetUrl = url.trim()) {
    if (!targetUrl) return;
    const finalUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    setError('');
    setResult(null);
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(finalUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
      const timing = Math.round(performance.now() - t0);
      const headers: [string, string][] = [];
      res.headers.forEach((value, key) => headers.push([key, value]));
      headers.sort((a, b) => a[0].localeCompare(b[0]));
      setResult({ url: res.url, status: res.status, statusText: res.statusText, headers, timing });
    } catch (e) {
      // Tauri desktop apps can usually fetch cross-origin; if it fails fall back gracefully
      setError(`Fetch failed: ${String(e)}. Note: some servers block CORS requests. Try a different URL.`);
    } finally {
      setLoading(false);
    }
  }

  const secHeaders = result ? analyzeSecurityHeaders(result.headers) : [];
  const { score, grade, color } = result ? securityScore(secHeaders) : { score: 0, grade: '', color: '' };
  const allHeaders = result?.headers ?? [];
  const interestingHeaders = allHeaders.filter(([k]) => INTERESTING_HEADERS.has(k.toLowerCase()));

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>HTTP Header Inspector</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Fetch and inspect HTTP response headers — security grading, cache, CORS, and server info
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Input */}
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              className="input-base"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inspect()}
              placeholder="https://example.com"
            />
          </div>
          <button className="btn btn-primary flex items-center gap-1.5" onClick={() => inspect()} disabled={loading || !url.trim()}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
            Inspect
          </button>
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="btn btn-ghost btn-sm" onClick={() => { setUrl(ex); inspect(ex); }}>{ex}</button>
          ))}
        </div>

        {error && (
          <div className="rounded p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {result && (
          <>
            {/* Status bar */}
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <span className="font-mono text-sm font-bold" style={{ color: result.status < 400 ? '#34d399' : '#ef4444' }}>
                {result.status} {result.statusText}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="text-xs font-mono truncate flex-1" style={{ color: 'var(--text-muted)' }}>{result.url}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{result.timing}ms</span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1">
              {([['security', 'Security'], ['interesting', 'Notable'], ['all', 'All Headers']] as const).map(([t, label]) => (
                <button
                  key={t}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={tab === t ? { background: 'var(--accent)', color: 'white' } : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  onClick={() => setTab(t)}
                >
                  {label} {t === 'all' ? `(${allHeaders.length})` : t === 'interesting' ? `(${interestingHeaders.length})` : ''}
                </button>
              ))}
            </div>

            {/* Security tab */}
            {tab === 'security' && (
              <>
                <div className="flex items-center gap-4 rounded-lg px-4 py-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="text-4xl font-bold" style={{ color }}>{grade}</div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Security Score: {score}/100</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {secHeaders.filter((h) => h.grade === 'good').length} of {secHeaders.length} security headers present
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {secHeaders.map((h) => (
                    <div key={h.name} className="rounded-lg p-3" style={{
                      background: h.grade === 'good' ? 'rgba(52,211,153,0.05)' : h.grade === 'warn' ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)',
                      border: `1px solid ${h.grade === 'good' ? 'rgba(52,211,153,0.2)' : h.grade === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      <div className="flex items-center gap-2 mb-1">
                        {h.grade === 'good' ? <ShieldCheck size={13} color="#34d399" /> : h.grade === 'warn' ? <Shield size={13} color="#f59e0b" /> : <ShieldAlert size={13} color="#ef4444" />}
                        <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                      </div>
                      {h.value && <div className="font-mono text-xs mb-1 break-all" style={{ color: 'var(--text-secondary)' }}>{h.value}</div>}
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{h.tip}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Interesting / All tabs */}
            {(tab === 'interesting' || tab === 'all') && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {tab === 'all' ? `All ${allHeaders.length} headers` : `${interestingHeaders.length} notable headers`}
                  </span>
                  <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={() => {
                    const text = (tab === 'all' ? allHeaders : interestingHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
                    navigator.clipboard.writeText(text);
                  }}>
                    <Copy size={11} /> Copy All
                  </button>
                </div>
                {(tab === 'all' ? allHeaders : interestingHeaders).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 px-3 py-2 font-mono text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="shrink-0 font-semibold" style={{ color: 'var(--accent)', minWidth: 200 }}>{key}</span>
                    <span className="flex-1 break-all" style={{ color: 'var(--text-secondary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
