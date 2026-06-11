import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const TIMEZONES = [
  'local', 'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney',
  'Pacific/Auckland',
];

function formatInTz(date: Date, tz: string): string {
  if (tz === 'local') return date.toLocaleString();
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(date);
  } catch {
    return 'Invalid timezone';
  }
}

export default function UnixTimeTool() {
  const [input, setInput] = useState('');
  const [tz, setTz] = useState('local');

  const now = () => setInput(String(Math.floor(Date.now() / 1000)));

  const parsed = (() => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^\d{10}$/.test(trimmed)) return new Date(parseInt(trimmed) * 1000);
    if (/^\d{13}$/.test(trimmed)) return new Date(parseInt(trimmed));
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  })();

  const toUnix = (d: Date) => ({
    seconds: Math.floor(d.getTime() / 1000),
    milliseconds: d.getTime(),
    iso: d.toISOString(),
    relative: relativeTime(d),
    formatted: formatInTz(d, tz),
  });

  function relativeTime(d: Date): string {
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (Math.abs(diffSec) < 60) return `${diffSec}s ago`;
    if (Math.abs(diffSec) < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (Math.abs(diffSec) < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  const info = parsed ? toUnix(parsed) : null;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unix Time Converter</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Convert Unix timestamps to dates and vice versa</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-base text-xs py-1" style={{ width: 180 }} value={tz} onChange={(e) => setTz(e.target.value)}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={now} title="Use current time"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-xl">
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Unix timestamp (seconds or ms) or date string
          </label>
          <input
            className="input-base font-mono"
            placeholder="e.g. 1700000000 or 2024-01-15T10:30:00Z"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        {info && (
          <table className="w-full text-sm border-separate border-spacing-y-1">
            <tbody>
              {[
                ['Unix (seconds)', String(info.seconds)],
                ['Unix (milliseconds)', String(info.milliseconds)],
                ['ISO 8601', info.iso],
                ['Relative', info.relative],
                [`Formatted (${tz})`, info.formatted],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="pr-4 py-1.5 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{label}</td>
                  <td className="py-1.5 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {input && !info && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>Could not parse date/timestamp</p>
        )}
      </div>
    </div>
  );
}
