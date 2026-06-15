import { useState } from 'react';
import { Copy, Search, RefreshCw } from 'lucide-react';

type RecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS' | 'SOA' | 'PTR' | 'SRV' | 'CAA';

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DnsResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: { name: string; type: number }[];
  Answer?: DnsAnswer[];
  Authority?: DnsAnswer[];
  Comment?: string;
}

const TYPE_NUMBERS: Record<RecordType, number> = { A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, CAA: 257 };
const TYPE_NAMES: Record<number, string> = Object.fromEntries(Object.entries(TYPE_NUMBERS).map(([k, v]) => [v, k]));

const RECORD_TYPES: RecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'PTR', 'SRV', 'CAA'];

const STATUS_MESSAGES: Record<number, string> = {
  0: 'NOERROR — Query completed successfully',
  1: 'FORMERR — Format error in the query',
  2: 'SERVFAIL — Server failure',
  3: 'NXDOMAIN — Domain does not exist',
  4: 'NOTIMP — Not implemented',
  5: 'REFUSED — Query refused',
};

const EXAMPLES = ['google.com', 'cloudflare.com', 'github.com', 'example.com'];

function formatData(type: RecordType, data: string): string {
  if (type === 'TXT') return data.replace(/^"|"$/g, '').replace(/" "/g, '');
  return data;
}

function ttlToHuman(ttl: number): string {
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
  return `${Math.floor(ttl / 86400)}d`;
}

export default function DnsLookupTool() {
  const [domain, setDomain] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<RecordType[]>(['A', 'AAAA', 'MX', 'TXT', 'NS']);
  const [results, setResults] = useState<Record<RecordType, DnsResponse | null>>({} as Record<RecordType, DnsResponse | null>);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleType(t: RecordType) {
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function lookup(queryDomain = domain.trim()) {
    if (!queryDomain) return;
    setError('');
    setLoading(true);
    setResults({} as Record<RecordType, DnsResponse | null>);

    try {
      const responses = await Promise.all(
        selectedTypes.map(async (type) => {
          try {
            const res = await fetch(
              `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(queryDomain)}&type=${type}`,
              { headers: { Accept: 'application/dns-json' } }
            );
            if (!res.ok) return [type, null] as [RecordType, null];
            const data: DnsResponse = await res.json();
            return [type, data] as [RecordType, DnsResponse];
          } catch {
            return [type, null] as [RecordType, null];
          }
        })
      );
      setResults(Object.fromEntries(responses) as Record<RecordType, DnsResponse | null>);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const hasResults = Object.values(results).some((r) => r !== null);

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>DNS Record Lookup</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Query DNS records via Cloudflare DoH (1.1.1.1) — A, AAAA, MX, TXT, CNAME, NS, SOA, and more
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Input */}
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              className="input-base font-mono"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="e.g. google.com"
            />
          </div>
          <button
            className="btn btn-primary flex items-center gap-1.5"
            onClick={() => lookup()}
            disabled={loading || !domain.trim()}
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
            Lookup
          </button>
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="btn btn-ghost btn-sm font-mono" onClick={() => { setDomain(ex); lookup(ex); }}>{ex}</button>
          ))}
        </div>

        {/* Record type selector */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Record Types</div>
          <div className="flex flex-wrap gap-1.5">
            {RECORD_TYPES.map((t) => (
              <button
                key={t}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${selectedTypes.includes(t) ? 'text-white' : ''}`}
                style={selectedTypes.includes(t)
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onClick={() => toggleType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {hasResults && selectedTypes.map((type) => {
          const response = results[type];
          if (!response) return null;
          const answers = response.Answer ?? [];
          const status = STATUS_MESSAGES[response.Status] ?? `Status: ${response.Status}`;
          const isError = response.Status !== 0;

          return (
            <div key={type} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>{type}</span>
                  {isError && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{status}</span>
                  )}
                  {!isError && answers.length === 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No records found</span>
                  )}
                </div>
                {answers.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm flex items-center gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(answers.map((a) => a.data).join('\n'));
                    }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                )}
              </div>

              {answers.length > 0 && (
                <div className="divide-y">
                  {answers.map((ans, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2 font-mono text-xs">
                      <span className="shrink-0 w-16 text-right" style={{ color: 'var(--text-muted)' }}>
                        {ttlToHuman(ans.TTL)}
                      </span>
                      <span className="flex-1 break-all" style={{ color: 'var(--text-primary)' }}>
                        {formatData(type, ans.data)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
