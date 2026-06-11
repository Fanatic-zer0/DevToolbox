import { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';

interface Match { index: number; end: number; groups: Record<string, string> }

function execMatches(pattern: string, flags: string, input: string): Match[] | string {
  try {
    const re = new RegExp(pattern, flags.replace(/[^gimsuy]/g, ''));
    const matches: Match[] = [];
    let m: RegExpExecArray | null;
    if (flags.includes('g')) {
      while ((m = re.exec(input)) !== null) {
        matches.push({ index: m.index, end: m.index + m[0].length, groups: m.groups ?? {} });
        if (!flags.includes('g')) break;
      }
    } else {
      m = re.exec(input);
      if (m) matches.push({ index: m.index, end: m.index + m[0].length, groups: m.groups ?? {} });
    }
    return matches;
  } catch (e) {
    return String(e);
  }
}

function highlightedParts(text: string, matches: Match[]): JSX.Element[] {
  const parts: JSX.Element[] = [];
  let pos = 0;
  for (const { index, end } of matches) {
    if (pos < index) parts.push(<span key={`t${pos}`}>{text.slice(pos, index)}</span>);
    parts.push(
      <mark key={`m${index}`} className="rounded px-0.5" style={{ background: 'rgba(250,204,21,0.4)', color: 'inherit' }}>
        {text.slice(index, end)}
      </mark>
    );
    pos = end;
  }
  if (pos < text.length) parts.push(<span key={`tail${pos}`}>{text.slice(pos)}</span>);
  return parts;
}

export default function RegExpTool() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testStr, setTestStr] = useState('');

  const result = useMemo(() => {
    if (!pattern || !testStr) return { matches: [], error: '' };
    const out = execMatches(pattern, flags, testStr);
    if (typeof out === 'string') return { matches: [], error: out };
    return { matches: out, error: '' };
  }, [pattern, flags, testStr]);

  const highlighted = useMemo(
    () => result.matches.length > 0 ? highlightedParts(testStr, result.matches) : null,
    [testStr, result.matches]
  );

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>RegExp Tester</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Test regular expressions with live match highlighting</p>
        </div>
        {result.matches.length > 0 && (
          <span className="badge badge-success">{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl">
        {/* Pattern input */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pattern</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>/</span>
              <input
                className="input-base font-mono pl-6 pr-6"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="[a-z]+"
                style={{ letterSpacing: '0.02em' }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>/</span>
            </div>
            <input
              className="input-base font-mono"
              style={{ width: 80 }}
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="flags"
              title="Flags: g i m s u y"
            />
          </div>
          {result.error && (
            <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={11} /> {result.error}
            </div>
          )}
        </div>

        {/* Test string */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Test string</label>
          <textarea
            className="input-base font-mono resize-none"
            rows={5}
            value={testStr}
            onChange={(e) => setTestStr(e.target.value)}
            placeholder="Enter your test text here…"
          />
        </div>

        {/* Highlighted result */}
        {testStr && highlighted && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Result</label>
            <div className="p-3 rounded-lg font-mono text-sm whitespace-pre-wrap leading-relaxed" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {highlighted}
            </div>
          </div>
        )}

        {/* Match details */}
        {result.matches.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Match details</label>
            <div className="space-y-1">
              {result.matches.map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded text-xs font-mono" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(250,204,21,0.3)', color: 'var(--text-primary)' }}>#{i + 1}</span>
                  <span style={{ color: 'var(--accent)' }}>index {m.index}–{m.end}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{testStr.slice(m.index, m.end)}</span>
                  {Object.keys(m.groups).length > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>{JSON.stringify(m.groups)}</span>
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
