import { useState } from 'react';
import * as yaml from 'js-yaml';
import { Copy, GitCompare, List } from 'lucide-react';

type Mode = 'inspect' | 'diff';
type FlatEntry = { path: string; value: unknown; type: string };

function flatten(obj: unknown, prefix = ''): FlatEntry[] {
  if (obj === null || obj === undefined) return [{ path: prefix, value: obj, type: 'null' }];
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return [{ path: prefix, value: obj, type: Array.isArray(obj) ? 'array' : typeof obj }];
  }
  const entries: FlatEntry[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...flatten(v, key));
    } else {
      entries.push({ path: key, value: v, type: Array.isArray(v) ? 'array' : typeof v });
    }
  }
  return entries;
}

function typeColor(t: string): string {
  switch (t) {
    case 'string': return 'var(--accent)';
    case 'number': return '#f59e0b';
    case 'boolean': return '#a78bfa';
    case 'array': return '#34d399';
    case 'null': return 'var(--text-muted)';
    default: return 'var(--text-secondary)';
  }
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (Array.isArray(v)) return `[${v.length} items]`;
  return String(v);
}

function DiffView({ left, right }: { left: FlatEntry[]; right: FlatEntry[] }) {
  const leftMap = new Map(left.map((e) => [e.path, e]));
  const rightMap = new Map(right.map((e) => [e.path, e]));
  const allKeys = Array.from(new Set([...left.map((e) => e.path), ...right.map((e) => e.path)])).sort();

  const rows = allKeys.map((k) => {
    const l = leftMap.get(k);
    const r = rightMap.get(k);
    if (!l) return { key: k, status: 'added' as const, l: null, r: r! };
    if (!r) return { key: k, status: 'removed' as const, l: l!, r: null };
    const lv = renderValue(l.value);
    const rv = renderValue(r.value);
    if (lv !== rv) return { key: k, status: 'changed' as const, l: l!, r: r! };
    return { key: k, status: 'same' as const, l: l!, r: r! };
  }).filter((row) => row.status !== 'same');

  if (rows.length === 0) {
    return (
      <div className="rounded-lg p-4 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No differences found — values are identical.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        {rows.filter((r) => r.status === 'changed').length} changed,{' '}
        {rows.filter((r) => r.status === 'added').length} added,{' '}
        {rows.filter((r) => r.status === 'removed').length} removed
      </div>
      {rows.map((row) => (
        <div key={row.key} className="rounded p-2 text-xs font-mono" style={{
          background: row.status === 'added' ? 'rgba(52,211,153,0.08)' : row.status === 'removed' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${row.status === 'added' ? 'rgba(52,211,153,0.3)' : row.status === 'removed' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          <div className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{row.key}</div>
          {row.status === 'changed' && (
            <>
              <div style={{ color: '#ef4444' }}>− {renderValue(row.l!.value)}</div>
              <div style={{ color: '#34d399' }}>+ {renderValue(row.r!.value)}</div>
            </>
          )}
          {row.status === 'added' && <div style={{ color: '#34d399' }}>+ {renderValue(row.r!.value)}</div>}
          {row.status === 'removed' && <div style={{ color: '#ef4444' }}>− {renderValue(row.l!.value)}</div>}
        </div>
      ))}
    </div>
  );
}

export default function HelmValuesTool() {
  const [mode, setMode] = useState<Mode>('inspect');
  const [input, setInput] = useState('');
  const [inputB, setInputB] = useState('');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  let parsed: unknown = null;
  let parseError = '';
  let parsedB: unknown = null;
  let parseErrorB = '';

  try { parsed = input.trim() ? yaml.load(input) : null; } catch (e) { parseError = String(e); }
  try { parsedB = inputB.trim() ? yaml.load(inputB) : null; } catch (e) { parseErrorB = String(e); }

  const entries: FlatEntry[] = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? flatten(parsed) : [];
  const entriesB: FlatEntry[] = parsedB && typeof parsedB === 'object' && !Array.isArray(parsedB)
    ? flatten(parsedB) : [];

  const filtered = search
    ? entries.filter((e) => e.path.toLowerCase().includes(search.toLowerCase()) || renderValue(e.value).toLowerCase().includes(search.toLowerCase()))
    : entries;

  function copyFlat() {
    const text = entries.map((e) => `${e.path}: ${renderValue(e.value)}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Helm Values Helper</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Inspect and diff Helm <code>values.yaml</code> files — flatten keys, inspect types, compare releases
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'inspect' ? 'text-white' : ''}`}
          style={mode === 'inspect' ? { background: 'var(--accent)' } : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          onClick={() => setMode('inspect')}
        >
          <List size={12} /> Inspect
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'diff' ? 'text-white' : ''}`}
          style={mode === 'diff' ? { background: 'var(--accent)' } : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          onClick={() => setMode('diff')}
        >
          <GitCompare size={12} /> Diff
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {mode === 'inspect' ? (
          <>
            {/* Input */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                values.yaml
              </label>
              <textarea
                className="input-base font-mono text-xs resize-none"
                rows={10}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your values.yaml here..."
                spellCheck={false}
              />
              {parseError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{parseError}</p>}
            </div>

            {entries.length > 0 && (
              <>
                {/* Stats */}
                <div className="flex gap-3 flex-wrap">
                  {(['string', 'number', 'boolean', 'array', 'object'] as const).map((t) => {
                    const count = entries.filter((e) => e.type === t).length;
                    if (!count) return null;
                    return (
                      <div key={t} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ background: typeColor(t) }} />
                        <span style={{ color: 'var(--text-muted)' }}>{count} {t}</span>
                      </div>
                    );
                  })}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {entries.length} total keys</span>
                </div>

                {/* Search */}
                <input
                  className="input-base text-xs"
                  placeholder="Filter keys or values..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {/* Flat key table */}
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {filtered.length} keys {search ? `matching "${search}"` : ''}
                    </span>
                    <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={copyFlat}>
                      <Copy size={11} /> {copied ? 'Copied!' : 'Copy flat'}
                    </button>
                  </div>
                  <div className="divide-y">
                    {filtered.slice(0, 200).map((e) => (
                      <div key={e.path} className="flex items-center gap-3 px-3 py-1.5 font-mono text-xs">
                        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{e.path}</span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: typeColor(e.type), fontSize: '10px' }}>{e.type}</span>
                        <span className="shrink-0 max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>{renderValue(e.value)}</span>
                      </div>
                    ))}
                    {filtered.length > 200 && (
                      <div className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                        Showing 200 of {filtered.length} keys — refine your filter
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Diff mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>values.yaml (A)</label>
                <textarea
                  className="input-base font-mono text-xs resize-none"
                  rows={10}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste first values.yaml..."
                  spellCheck={false}
                />
                {parseError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{parseError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>values.yaml (B)</label>
                <textarea
                  className="input-base font-mono text-xs resize-none"
                  rows={10}
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                  placeholder="Paste second values.yaml..."
                  spellCheck={false}
                />
                {parseErrorB && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{parseErrorB}</p>}
              </div>
            </div>

            {(entries.length > 0 || entriesB.length > 0) && (
              <DiffView left={entries} right={entriesB} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
