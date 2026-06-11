import { useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import { copyToClipboard } from '../../../lib/utils';

function parseUrl(raw: string) {
  try {
    const url = new URL(raw.trim());
    const params: [string, string][] = [];
    url.searchParams.forEach((v, k) => params.push([k, v]));
    return {
      href: url.href,
      protocol: url.protocol.replace(':', ''),
      username: url.username,
      password: url.password,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash.replace('#', ''),
      params,
      origin: url.origin,
    };
  } catch {
    return null;
  }
}

export default function UrlParserTool() {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const parsed = input.trim() ? parseUrl(input) : null;

  const handleCopy = async (v: string) => {
    await copyToClipboard(v);
    setCopied(v);
    setTimeout(() => setCopied(null), 1500);
  };

  const fields = parsed ? [
    ['Protocol', parsed.protocol],
    ['Origin', parsed.origin],
    ['Hostname', parsed.hostname],
    ['Port', parsed.port || '(default)'],
    ['Pathname', parsed.pathname],
    ['Search', parsed.search],
    ['Hash', parsed.hash],
    ...(parsed.username ? [['Username', parsed.username]] : []),
    ...(parsed.password ? [['Password', parsed.password]] : []),
  ] : [];

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>URL Parser</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Decompose a URL into its components</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-2xl space-y-4">
        <input
          className="input-base font-mono"
          placeholder="https://example.com/path?foo=bar&baz=qux#section"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        {parsed ? (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <tbody>
                  {fields.map(([label, value]) => (
                    <tr key={label} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-3 py-2 text-xs font-medium w-28" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>{label}</td>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center gap-2 group">
                          <span className="flex-1 break-all">{value}</span>
                          {value && (
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-ghost btn-sm" onClick={() => handleCopy(value)}>
                              {copied === value ? <CheckCircle size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsed.params.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Query Parameters</h2>
                <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        <th className="px-3 py-2 text-xs font-medium text-left" style={{ color: 'var(--text-muted)' }}>Key</th>
                        <th className="px-3 py-2 text-xs font-medium text-left" style={{ color: 'var(--text-muted)' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.params.map(([k, v], i) => (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-3 py-2 font-mono text-xs font-medium" style={{ color: 'var(--accent)' }}>{k}</td>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{decodeURIComponent(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : input.trim() ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>Invalid URL</p>
        ) : null}
      </div>
    </div>
  );
}
