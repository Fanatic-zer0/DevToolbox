import { useState } from 'react';
import TwoColTool from '../../../components/ui/TwoColTool';

const CASE_TRANSFORMS: Record<string, (s: string) => string> = {
  camelCase:  (s) => toCamel(s, false),
  PascalCase: (s) => toCamel(s, true),
  snake_case: (s) => toWords(s).join('_').toLowerCase(),
  SCREAMING_SNAKE: (s) => toWords(s).join('_').toUpperCase(),
  'kebab-case': (s) => toWords(s).join('-').toLowerCase(),
  'COBOL-CASE': (s) => toWords(s).join('-').toUpperCase(),
  'Title Case': (s) => toWords(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' '),
  lowercase:  (s) => s.toLowerCase(),
  UPPERCASE:  (s) => s.toUpperCase(),
};

function toWords(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-./]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

function toCamel(s: string, upperFirst: boolean): string {
  const words = toWords(s);
  return words.map((w, i) => (!upperFirst && i === 0) ? w : w[0].toUpperCase() + w.slice(1)).join('');
}

export default function StringCaseTool() {
  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>String Case Converter</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Convert strings between all common naming conventions</p>
        </div>
      </div>

      <StringCaseBody />
    </div>
  );
}

function StringCaseBody() {
  const [input, setInput] = useState('');

  const results = Object.entries(CASE_TRANSFORMS).map(([name, fn]) => {
    try { return { name, value: fn(input) }; }
    catch { return { name, value: '' }; }
  });

  return (
    <div className="flex-1 overflow-auto p-4 max-w-2xl space-y-4">
      <input
        className="input-base font-mono"
        placeholder="myVariableName or my-variable-name or MY_CONSTANT…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {input && (
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs w-36 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{r.name}</span>
              <code className="flex-1 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{r.value}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
