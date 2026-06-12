import { useState } from 'react';
import { Copy } from 'lucide-react';

// ── IPv4 helpers ─────────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

function ipToBinary(ip: string): string {
  return ip.split('.').map((o) => parseInt(o).toString(2).padStart(8, '0')).join('.');
}

function calcIPv4(cidr: string) {
  const [ipStr, prefixStr] = cidr.trim().split('/');
  const prefix = parseInt(prefixStr, 10);

  if (!ipStr || isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const octets = ipStr.split('.');
  if (octets.length !== 4 || octets.some((o) => isNaN(parseInt(o)) || parseInt(o) < 0 || parseInt(o) > 255)) return null;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const ipInt = ipToInt(ipStr);
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const firstHost = prefix < 31 ? network + 1 : network;
  const lastHost = prefix < 31 ? broadcast - 1 : broadcast;
  const hostCount = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;

  // Subnets breakdown: next 4 valid subnet sizes
  const subnets = [];
  for (let p = prefix + 1; p <= Math.min(prefix + 4, 30); p++) {
    const count = Math.pow(2, 32 - p) - 2;
    subnets.push({ prefix: p, count, perSubnet: Math.pow(2, 32 - p) });
  }

  return {
    ip: ipStr,
    prefix,
    networkAddress: intToIp(network),
    broadcastAddress: intToIp(broadcast),
    subnetMask: intToIp(mask),
    wildcardMask: intToIp(~mask >>> 0),
    firstHost: intToIp(firstHost),
    lastHost: intToIp(lastHost),
    hostCount: Math.max(0, hostCount),
    totalAddresses: Math.pow(2, 32 - prefix),
    ipBinary: ipToBinary(ipStr),
    maskBinary: ipToBinary(intToIp(mask)),
    networkBinary: ipToBinary(intToIp(network)),
    cidrClass: cidrClass(prefix),
    subnets,
  };
}

function cidrClass(prefix: number): string {
  if (prefix <= 8) return 'A';
  if (prefix <= 16) return 'B';
  if (prefix <= 24) return 'C';
  return 'D/E or host route';
}

// ── IPv6 helpers ─────────────────────────────────────────────────────────────

function expandIPv6(ip: string): string {
  const parts = ip.split('::');
  let left = parts[0] ? parts[0].split(':') : [];
  let right = parts[1] ? parts[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  const middle = Array(missing).fill('0000');
  return [...left, ...middle, ...right].map((g) => g.padStart(4, '0')).join(':');
}

function calcIPv6(cidr: string) {
  const [ipStr, prefixStr] = cidr.trim().split('/');
  const prefix = parseInt(prefixStr, 10);
  if (!ipStr || isNaN(prefix) || prefix < 0 || prefix > 128) return null;
  try {
    const expanded = expandIPv6(ipStr);
    const groups = expanded.split(':');
    if (groups.length !== 8) return null;
    const hostBits = 128 - prefix;
    return {
      ip: ipStr,
      expanded,
      prefix,
      hostBits,
      addressCount: hostBits >= 64 ? `2^${hostBits} (≈${(2 ** Math.min(hostBits, 53)).toExponential(2)})` : `${Math.pow(2, hostBits)}`,
      networkPrefix: groups.slice(0, Math.ceil(prefix / 16)).join(':') + '::/' + prefix,
    };
  } catch { return null; }
}

function isIPv6(s: string) { return s.includes(':'); }

const EXAMPLES = [
  '192.168.1.0/24',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.100/28',
  '10.10.0.0/20',
  '2001:db8::/32',
];

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }
  return (
    <div className="flex items-center justify-between py-2 px-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 160 }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>{value}</span>
        <button onClick={copy} className="btn btn-ghost p-0.5 opacity-50 hover:opacity-100">
          <Copy size={11} />
        </button>
      </div>
    </div>
  );
}

export default function CidrTool() {
  const [cidr, setCidr] = useState('192.168.1.0/24');

  const v6 = cidr.includes(':');
  const result4 = !v6 ? calcIPv4(cidr) : null;
  const result6 = v6 ? calcIPv6(cidr) : null;
  const hasError = cidr.trim() && !result4 && !result6;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CIDR / Subnet Calculator</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Calculate network address, broadcast, usable range, host count and subnetting for IPv4 and IPv6
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Input */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>CIDR Notation</label>
          <input
            className="input-base font-mono"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="e.g. 192.168.1.0/24 or 2001:db8::/32"
          />
          {hasError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Invalid CIDR — check IP address and prefix length.</p>}
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="btn btn-ghost btn-sm font-mono" onClick={() => setCidr(ex)}>{ex}</button>
          ))}
        </div>

        {/* IPv4 Results */}
        {result4 && (
          <>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                IPv4 — /{result4.prefix} (Class {result4.cidrClass})
              </div>
              <Row label="IP Address" value={result4.ip} />
              <Row label="Network Address" value={result4.networkAddress} />
              <Row label="Broadcast Address" value={result4.broadcastAddress} />
              <Row label="Subnet Mask" value={result4.subnetMask} />
              <Row label="Wildcard Mask" value={result4.wildcardMask} />
              <Row label="First Usable Host" value={result4.firstHost} />
              <Row label="Last Usable Host" value={result4.lastHost} />
              <Row label="Usable Hosts" value={result4.hostCount.toLocaleString()} mono={false} />
              <Row label="Total Addresses" value={result4.totalAddresses.toLocaleString()} mono={false} />
            </div>

            {/* Binary */}
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                Binary Representation
              </div>
              {[
                { label: 'IP Address', value: result4.ipBinary },
                { label: 'Subnet Mask', value: result4.maskBinary },
                { label: 'Network', value: result4.networkBinary },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2 px-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs w-28 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Subnetting */}
            {result4.subnets.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  Subnetting Options
                </div>
                <div className="divide-y">
                  {result4.subnets.map((s) => (
                    <div key={s.prefix} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-mono" style={{ color: 'var(--accent)' }}>/{s.prefix}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {Math.pow(2, s.prefix - result4.prefix)} subnets × {Math.max(0, s.count).toLocaleString()} hosts each
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* IPv6 Results */}
        {result6 && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
              IPv6 — /{result6.prefix}
            </div>
            <Row label="Abbreviated" value={result6.ip} />
            <Row label="Expanded" value={result6.expanded} />
            <Row label="Prefix Length" value={`/${result6.prefix}`} />
            <Row label="Host Bits" value={String(result6.hostBits)} mono={false} />
            <Row label="Address Count" value={result6.addressCount} mono={false} />
            <Row label="Network Prefix" value={result6.networkPrefix} />
          </div>
        )}
      </div>
    </div>
  );
}
