import { useState } from 'react';
import cronstrue from 'cronstrue';

function nextRuns(expression: string, count = 5): Date[] {
  // Simple cron next-run calculator for standard 5-field cron
  const dates: Date[] = [];
  try {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) return [];
    let d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);

    for (let attempts = 0; attempts < 50000 && dates.length < count; attempts++) {
      if (matchesCron(d, parts)) {
        dates.push(new Date(d));
        d = new Date(d.getTime() + 60_000);
      } else {
        d = new Date(d.getTime() + 60_000);
      }
    }
  } catch { /* ignore */ }
  return dates;
}

function matchesCron(d: Date, parts: string[]): boolean {
  const [min, hour, dom, month, dow] = parts;
  return (
    matchField(min, d.getMinutes(), 0, 59) &&
    matchField(hour, d.getHours(), 0, 23) &&
    matchField(dom, d.getDate(), 1, 31) &&
    matchField(month, d.getMonth() + 1, 1, 12) &&
    matchField(dow, d.getDay(), 0, 7)
  );
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const stepNum = parseInt(step);
      const start = range === '*' ? min : parseInt(range.split('-')[0]);
      const end = range === '*' ? max : (range.includes('-') ? parseInt(range.split('-')[1]) : max);
      for (let i = start; i <= end; i += stepNum) { if (i === value) return true; }
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (value >= lo && value <= hi) return true;
    } else {
      if (parseInt(part) === value || (parseInt(part) === 7 && value === 0)) return true;
    }
  }
  return false;
}

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Every Sunday', value: '0 0 * * 0' },
  { label: 'First of month', value: '0 0 1 * *' },
];

export default function CronTool() {
  const [expression, setExpression] = useState('*/5 * * * *');

  let human = '';
  let error = '';
  try {
    human = cronstrue.toString(expression, { use24HourTimeFormat: true });
  } catch (e) {
    error = String(e);
  }

  const runs = nextRuns(expression);

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cron Expression Parser</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Decode cron expressions and preview next run times</p>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Cron expression</label>
          <input
            className="input-base font-mono"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="* * * * *"
          />
          {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.value} className="btn btn-ghost btn-sm" onClick={() => setExpression(p.value)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Field labels */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Fields</div>
          <div className="flex gap-1 font-mono">
            {expression.split(/\s+/).map((f, i) => (
              <div key={i} className="flex-1 text-center rounded p-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{f}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {['minute', 'hour', 'day', 'month', 'weekday'][i]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {human && (
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Human readable</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{human}</p>
          </div>
        )}

        {runs.length > 0 && (
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Next 5 runs</div>
            <ol className="space-y-1">
              {runs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{d.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
