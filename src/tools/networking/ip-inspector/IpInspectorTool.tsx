import { useState } from 'react';
import { Copy } from 'lucide-react';

// ── IPv4 classification ───────────────────────────────────────────────────────

interface IpRange { cidr: string; label: string; rfc: string; description: string }

const IPV4_RANGES: IpRange[] = [
  { cidr: '0.0.0.0/8',        label: 'This network',         rfc: 'RFC 1122', description: '"This" network; used as source address before assignment' },
  { cidr: '10.0.0.0/8',       label: 'Private',              rfc: 'RFC 1918', description: 'Private network — not routable on the internet' },
  { cidr: '100.64.0.0/10',    label: 'Shared Address Space', rfc: 'RFC 6598', description: 'Carrier-grade NAT / shared address space' },
  { cidr: '127.0.0.0/8',      label: 'Loopback',             rfc: 'RFC 1122', description: 'Loopback address — never leaves the host' },
  { cidr: '169.254.0.0/16',   label: 'Link-local',           rfc: 'RFC 3927', description: 'APIPA / link-local — no DHCP server found' },
  { cidr: '172.16.0.0/12',    label: 'Private',              rfc: 'RFC 1918', description: 'Private network — not routable on the internet' },
  { cidr: '192.0.0.0/24',     label: 'IETF Protocol',        rfc: 'RFC 6890', description: 'IETF protocol assignments' },
  { cidr: '192.0.2.0/24',     label: 'Documentation',        rfc: 'RFC 5737', description: 'TEST-NET-1 — for documentation and examples only' },
  { cidr: '192.88.99.0/24',   label: '6to4 Relay (depr.)',   rfc: 'RFC 7526', description: '6to4 anycast relay (deprecated)' },
  { cidr: '192.168.0.0/16',   label: 'Private',              rfc: 'RFC 1918', description: 'Private network — not routable on the internet' },
  { cidr: '198.18.0.0/15',    label: 'Benchmarking',         rfc: 'RFC 2544', description: 'Network benchmarking' },
  { cidr: '198.51.100.0/24',  label: 'Documentation',        rfc: 'RFC 5737', description: 'TEST-NET-2 — for documentation only' },
  { cidr: '203.0.113.0/24',   label: 'Documentation',        rfc: 'RFC 5737', description: 'TEST-NET-3 — for documentation only' },
  { cidr: '224.0.0.0/4',      label: 'Multicast',            rfc: 'RFC 5771', description: 'IPv4 multicast addresses' },
  { cidr: '233.252.0.0/24',   label: 'Documentation',        rfc: 'RFC 5771', description: 'MCAST-TEST-NET' },
  { cidr: '240.0.0.0/4',      label: 'Reserved',             rfc: 'RFC 1112', description: 'Reserved / future use' },
  { cidr: '255.255.255.255/32', label: 'Broadcast',          rfc: 'RFC 919',  description: 'Limited broadcast address' },
];

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) | parseInt(o, 10), 0) >>> 0;
}

function ipv4InRange(ip: string, cidr: string): boolean {
  const [net, bits] = cidr.split('/');
  const prefix = parseInt(bits, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToInt(ip) & mask) >>> 0 === (ipToInt(net) & mask) >>> 0;
}

function classifyIPv4(ip: string) {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null;

  const matches = IPV4_RANGES.filter((r) => ipv4InRange(ip, r.cidr));
  const isPrivate = matches.some((m) => m.label === 'Private');
  const isLoopback = matches.some((m) => m.label === 'Loopback');
  const isLinkLocal = matches.some((m) => m.label === 'Link-local');
  const isMulticast = matches.some((m) => m.label === 'Multicast');
  const isPublic = !isPrivate && !isLoopback && !isLinkLocal && !isMulticast && matches.length === 0;

  const scope = isLoopback ? 'Host' : isLinkLocal ? 'Link' : isPrivate ? 'Private' : isMulticast ? 'Multicast' : 'Global';

  // Legacy class
  const first = octets[0];
  const legacyClass = first < 128 ? 'A' : first < 192 ? 'B' : first < 224 ? 'C' : first < 240 ? 'D' : 'E';

  // Binary
  const binary = octets.map((o) => o.toString(2).padStart(8, '0')).join('.');
  const hex = octets.map((o) => o.toString(16).padStart(2, '0')).join(':');
  const decimal = ipToInt(ip).toString();

  return { ip, version: 4, scope, isPublic, isPrivate, isLoopback, isLinkLocal, isMulticast, legacyClass, binary, hex, decimal, rfcMatches: matches };
}

// ── IPv6 classification ───────────────────────────────────────────────────────

function expandIPv6(ip: string): string | null {
  try {
    const parts = ip.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    const expanded = [...left, ...Array(missing).fill('0000'), ...right].map((g) => g.padStart(4, '0'));
    if (expanded.length !== 8) return null;
    return expanded.join(':');
  } catch { return null; }
}

function classifyIPv6(ip: string) {
  const expanded = expandIPv6(ip);
  if (!expanded) return null;
  const groups = expanded.split(':').map((g) => parseInt(g, 16));

  const first16 = groups[0];
  const first32 = (groups[0] << 16) | groups[1];

  let scope = 'Global Unicast';
  let label = 'Global Unicast';
  let rfc = 'RFC 4291';
  let description = 'Globally routable unicast address';

  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') { label = 'Unspecified'; rfc = 'RFC 4291'; description = 'Unspecified address (::)'; scope = 'None'; }
  else if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') { label = 'Loopback'; rfc = 'RFC 4291'; description = 'Loopback address (::1)'; scope = 'Host'; }
  else if (expanded.startsWith('fe80:')) { label = 'Link-Local'; rfc = 'RFC 4291'; description = 'Link-local unicast'; scope = 'Link'; }
  else if (expanded.startsWith('fc') || expanded.startsWith('fd')) { label = 'Unique Local (ULA)'; rfc = 'RFC 4193'; description = 'Unique local address — analogous to IPv4 private'; scope = 'Site'; }
  else if ((first16 & 0xff00) === 0xff00) { label = 'Multicast'; rfc = 'RFC 4291'; description = 'IPv6 multicast'; scope = 'Variable'; }
  else if (expanded.startsWith('2002:')) { label = '6to4'; rfc = 'RFC 3056'; description = '6to4 tunneling prefix'; }
  else if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) { label = 'IPv4-Mapped'; rfc = 'RFC 4291'; description = 'IPv4-mapped IPv6 address (::ffff:x.x.x.x)'; }
  else if (expanded.startsWith('2001:0db8:')) { label = 'Documentation'; rfc = 'RFC 3849'; description = 'Documentation/examples only (2001:db8::/32)'; }
  else if (expanded.startsWith('2001:0000:')) { label = 'Teredo'; rfc = 'RFC 4380'; description = 'Teredo tunneling'; }

  // IPv4 embedded?
  let embeddedIPv4: string | null = null;
  if (label === 'IPv4-Mapped') {
    const last32 = `${groups[6]}.`.replace(/(\d+)\./, (_, n) => `${(n >> 8) & 0xff}.${n & 0xff}.`) + `${(groups[7] >> 8) & 0xff}.${groups[7] & 0xff}`;
    embeddedIPv4 = last32;
  }

  return { ip, expanded, version: 6, label, scope, rfc, description, embeddedIPv4 };
}

function isIPv6(s: string) { return s.includes(':'); }

function isIPv4(s: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s.trim());
}

const EXAMPLES = ['192.168.1.1', '10.0.0.1', '172.16.50.4', '127.0.0.1', '169.254.1.1', '224.0.0.1', '8.8.8.8', '::1', 'fe80::1', 'fd00::1', '2001:db8::1', '::ffff:192.0.2.1'];

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${color}22`, color }}>
      {label}
    </span>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between py-2 px-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 140 }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{value}</span>
        <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="btn btn-ghost p-0.5 opacity-50 hover:opacity-100">
          <Copy size={11} />
        </button>
      </div>
    </div>
  );
}

export default function IpInspectorTool() {
  const [ip, setIp] = useState('192.168.1.1');

  const trimmed = ip.trim();
  const v6 = isIPv6(trimmed);
  const v4 = isIPv4(trimmed);

  const result4 = v4 ? classifyIPv4(trimmed) : null;
  const result6 = v6 ? classifyIPv6(trimmed) : null;
  const hasError = trimmed && !result4 && !result6;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>IP Address Inspector</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Classify any IPv4 or IPv6 address — scope, RFC category, binary, and hex representations
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Input */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>IP Address</label>
          <input
            className="input-base font-mono"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g. 192.168.1.1 or ::1"
          />
          {hasError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Invalid IP address format.</p>}
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="btn btn-ghost btn-sm font-mono" onClick={() => setIp(ex)}>{ex}</button>
          ))}
        </div>

        {/* IPv4 Result */}
        {result4 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge color={result4.isPublic ? '#34d399' : '#f59e0b'} label={result4.isPublic ? 'Public' : 'Private/Special'} />
              <Badge color="var(--accent)" label={`Scope: ${result4.scope}`} />
              <Badge color="#a78bfa" label={`IPv4`} />
              <Badge color="var(--text-secondary)" label={`Class ${result4.legacyClass}`} />
              {result4.isLoopback && <Badge color="#64748b" label="Loopback" />}
              {result4.isLinkLocal && <Badge color="#f59e0b" label="Link-Local" />}
              {result4.isMulticast && <Badge color="#ec4899" label="Multicast" />}
            </div>

            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                Representations
              </div>
              <CopyRow label="Dotted Decimal" value={result4.ip} />
              <CopyRow label="Binary" value={result4.binary} />
              <CopyRow label="Hexadecimal" value={result4.hex} />
              <CopyRow label="32-bit Integer" value={result4.decimal} />
            </div>

            {result4.rfcMatches.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  RFC Matches
                </div>
                {result4.rfcMatches.map((r) => (
                  <div key={r.cidr} className="flex items-start gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="font-mono text-xs shrink-0 pt-0.5" style={{ color: 'var(--accent)', minWidth: 120 }}>{r.cidr}</span>
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.label} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({r.rfc})</span></div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result4.rfcMatches.length === 0 && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <p className="text-xs" style={{ color: '#34d399' }}>
                  ✓ This is a <strong>public, globally routable</strong> IPv4 address — no special RFC designation.
                </p>
              </div>
            )}
          </>
        )}

        {/* IPv6 Result */}
        {result6 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge color="var(--accent)" label="IPv6" />
              <Badge color="#a78bfa" label={result6.label} />
              {result6.scope !== 'Global Unicast' && <Badge color="#f59e0b" label={`Scope: ${result6.scope}`} />}
            </div>

            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                Classification
              </div>
              <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{result6.label} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({result6.rfc})</span></div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{result6.description}</div>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                Representations
              </div>
              <CopyRow label="Abbreviated" value={result6.ip} />
              <CopyRow label="Expanded" value={result6.expanded} />
              {result6.embeddedIPv4 && <CopyRow label="Embedded IPv4" value={result6.embeddedIPv4} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
