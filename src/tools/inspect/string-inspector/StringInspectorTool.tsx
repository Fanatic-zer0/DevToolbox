import { useState } from 'react';

function byteLength(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}

function getCharInfo(s: string): { char: string; cp: number; utf8: string }[] {
  const result: { char: string; cp: number; utf8: string }[] = [];
  for (const char of s.slice(0, 200)) {
    const cp = char.codePointAt(0) ?? 0;
    const bytes = Array.from(new TextEncoder().encode(char)).map((b) => b.toString(16).padStart(2, '0'));
    result.push({ char, cp, utf8: bytes.join(' ') });
  }
  return result;
}

export default function StringInspectorTool() {
  const [input, setInput] = useState('');

  const chars = getCharInfo(input);
  const utf8Len = byteLength(input);
  const utf16Len = input.length * 2;
  const lines = input ? input.split('\n').length : 0;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>String Inspector</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Analyze characters, byte lengths, and encoding info</p>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Input string</label>
          <textarea
            className="input-base font-mono resize-none"
            rows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste any string…"
          />
        </div>

        {input && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Characters', value: input.length },
                { label: 'UTF-8 bytes', value: utf8Len },
                { label: 'UTF-16 bytes', value: utf16Len },
                { label: 'Words', value: words },
                { label: 'Lines', value: lines },
                { label: 'Unique chars', value: new Set(input).size },
                { label: 'Printable', value: (input.match(/[\x20-\x7E]/g) ?? []).length },
                { label: 'Non-ASCII', value: (input.match(/[^\x00-\x7F]/g) ?? []).length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Character table {input.length > 200 && <span>(first 200 chars)</span>}
              </label>
              <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border)', maxHeight: 300 }}>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      <th className="px-3 py-2 text-left">Char</th>
                      <th className="px-3 py-2 text-left">Dec</th>
                      <th className="px-3 py-2 text-left">Hex</th>
                      <th className="px-3 py-2 text-left">UTF-8 bytes</th>
                      <th className="px-3 py-2 text-left">HTML entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chars.map(({ char, cp, utf8 }, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                        <td className="px-3 py-1.5">
                          {char === ' ' ? <span style={{ color: 'var(--text-muted)' }}>·</span> : char === '\n' ? <span style={{ color: 'var(--text-muted)' }}>↵</span> : char}
                        </td>
                        <td className="px-3 py-1.5">{cp}</td>
                        <td className="px-3 py-1.5">U+{cp.toString(16).toUpperCase().padStart(4, '0')}</td>
                        <td className="px-3 py-1.5">{utf8}</td>
                        <td className="px-3 py-1.5">&#x{cp.toString(16)};</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
