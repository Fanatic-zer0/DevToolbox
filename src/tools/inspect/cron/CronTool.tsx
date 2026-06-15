import { useState } from 'react';
import cronstrue from 'cronstrue';
import { Copy } from 'lucide-react';

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

// --- Generator helpers ---
type FieldMode = 'every' | 'specific' | 'range' | 'step';

interface FieldState {
  mode: FieldMode;
  specific: number[];
  rangeFrom: string;
  rangeTo: string;
  stepEvery: string;
  stepStart: string;
}

function buildField(f: FieldState): string {
  switch (f.mode) {
    case 'every': return '*';
    case 'specific': return f.specific.length ? f.specific.slice().sort((a, b) => a - b).join(',') : '*';
    case 'range': return `${f.rangeFrom}-${f.rangeTo}`;
    case 'step': return `${f.stepStart || '*'}/${f.stepEvery || '1'}`;
  }
}

function defaultField(): FieldState {
  return { mode: 'every', specific: [], rangeFrom: '0', rangeTo: '1', stepEvery: '5', stepStart: '*' };
}

const FIELD_META = [
  { name: 'minute', label: 'Minute', min: 0, max: 59 },
  { name: 'hour', label: 'Hour', min: 0, max: 23 },
  { name: 'day', label: 'Day', min: 1, max: 31 },
  { name: 'month', label: 'Month', min: 1, max: 12, names: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] },
  { name: 'weekday', label: 'Weekday', min: 0, max: 6, names: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] },
];

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily midnight', value: '0 0 * * *' },
  { label: 'Every Sunday', value: '0 0 * * 0' },
  { label: 'First of month', value: '0 0 1 * *' },
  { label: 'Weekdays 9am', value: '0 9 * * 1-5' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
];

function FieldEditor({ meta, value, onChange }: {
  meta: typeof FIELD_META[0];
  value: FieldState;
  onChange: (v: FieldState) => void;
}) {
  const { min, max, names } = meta;
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>
          {buildField(value)}
        </span>
      </div>
      {/* Mode selector */}
      <div className="flex gap-1 flex-wrap">
        {(['every', 'specific', 'range', 'step'] as FieldMode[]).map((m) => (
          <button
            key={m}
            className="btn btn-sm text-xs"
            style={value.mode === m ? { background: 'var(--accent)', color: 'white' } : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            onClick={() => onChange({ ...value, mode: m })}
          >
            {m === 'every' ? 'Every' : m === 'specific' ? 'Specific' : m === 'range' ? 'Range' : 'Step'}
          </button>
        ))}
      </div>

      {value.mode === 'specific' && (
        <div className="flex flex-wrap gap-1">
          {range.map((n) => (
            <button
              key={n}
              className="text-xs rounded px-1.5 py-0.5 font-mono"
              style={value.specific.includes(n)
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onClick={() => {
                const updated = value.specific.includes(n)
                  ? value.specific.filter(x => x !== n)
                  : [...value.specific, n];
                onChange({ ...value, specific: updated });
              }}
            >
              {names ? names[n - min] : n}
            </button>
          ))}
        </div>
      )}

      {value.mode === 'range' && (
        <div className="flex items-center gap-2">
          <input className="input-base w-16 text-center font-mono text-xs" type="number" min={min} max={max}
            value={value.rangeFrom} onChange={e => onChange({ ...value, rangeFrom: e.target.value })} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
          <input className="input-base w-16 text-center font-mono text-xs" type="number" min={min} max={max}
            value={value.rangeTo} onChange={e => onChange({ ...value, rangeTo: e.target.value })} />
        </div>
      )}

      {value.mode === 'step' && (
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Every</span>
          <input className="input-base w-16 text-center font-mono text-xs" type="number" min={1} max={max}
            value={value.stepEvery} onChange={e => onChange({ ...value, stepEvery: e.target.value })} />
          <span style={{ color: 'var(--text-muted)' }}>starting at</span>
          <input className="input-base w-16 text-center font-mono text-xs" placeholder="*"
            value={value.stepStart} onChange={e => onChange({ ...value, stepStart: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export default function CronTool() {
  const [tab, setTab] = useState<'parser' | 'generator'>('parser');

  // Parser state
  const [expression, setExpression] = useState('*/5 * * * *');

  // Generator state
  const [fields, setFields] = useState<FieldState[]>(FIELD_META.map(() => defaultField()));
  const [copied, setCopied] = useState(false);

  const generatedExpr = fields.map(buildField).join(' ');

  let human = '';
  let error = '';
  const parseExpr = tab === 'parser' ? expression : generatedExpr;
  try {
    human = cronstrue.toString(parseExpr, { use24HourTimeFormat: true });
  } catch (e) {
    error = String(e);
  }
  const runs = nextRuns(parseExpr);

  function updateField(i: number, v: FieldState) {
    setFields(prev => prev.map((f, idx) => idx === i ? v : f));
  }

  function copyExpr() {
    navigator.clipboard.writeText(generatedExpr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function applyPreset(val: string) {
    if (tab === 'parser') {
      setExpression(val);
    } else {
      // Parse preset into field states
      const parts = val.split(' ');
      setFields(FIELD_META.map((_, i) => {
        const p = parts[i] ?? '*';
        if (p === '*') return defaultField();
        if (p.includes('/')) {
          const [start, every] = p.split('/');
          return { ...defaultField(), mode: 'step', stepStart: start, stepEvery: every };
        }
        if (p.includes('-')) {
          const [from, to] = p.split('-');
          return { ...defaultField(), mode: 'range', rangeFrom: from, rangeTo: to };
        }
        if (p.includes(',') || !isNaN(Number(p))) {
          const nums = p.split(',').map(Number);
          return { ...defaultField(), mode: 'specific', specific: nums };
        }
        return defaultField();
      }));
    }
  }

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cron Expression</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Parse and generate cron expressions with next run preview</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-xl">
        {/* Tabs */}
        <div className="flex gap-1">
          {(['parser', 'generator'] as const).map((t) => (
            <button
              key={t}
              className="px-3 py-1.5 rounded text-xs font-medium capitalize"
              style={tab === t ? { background: 'var(--accent)', color: 'white' } : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              onClick={() => setTab(t)}
            >
              {t === 'parser' ? 'Parser' : 'Generator'}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.value} className="btn btn-ghost btn-sm" onClick={() => applyPreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Parser tab */}
        {tab === 'parser' && (
          <>
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
          </>
        )}

        {/* Generator tab */}
        {tab === 'generator' && (
          <>
            {FIELD_META.map((meta, i) => (
              <FieldEditor key={meta.name} meta={meta} value={fields[i]} onChange={(v) => updateField(i, v)} />
            ))}
            {/* Generated output */}
            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <code className="font-mono text-base flex-1" style={{ color: 'var(--accent)' }}>{generatedExpr}</code>
              <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={copyExpr}>
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </>
        )}

        {/* Human readable + next runs (shared) */}
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
