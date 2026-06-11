import { useState } from 'react';

function toBase(n: bigint, base: number): string {
  if (n === 0n) return '0';
  const digits = '0123456789ABCDEF';
  let result = '';
  const neg = n < 0n;
  let val = neg ? -n : n;
  const b = BigInt(base);
  while (val > 0n) {
    result = digits[Number(val % b)] + result;
    val /= b;
  }
  return (neg ? '-' : '') + result;
}

function fromBase(s: string, base: number): bigint {
  return BigInt(parseInt(s.trim(), base));
}

export default function NumberBaseTool() {
  const [input, setInput] = useState('');
  const [inputBase, setInputBase] = useState(10);
  const [error, setError] = useState('');
  const [parsedNum, setParsedNum] = useState<bigint | null>(null);

  const handleInput = (value: string, base: number) => {
    setInput(value);
    if (!value.trim()) { setParsedNum(null); setError(''); return; }
    try {
      const n = BigInt(parseInt(value.trim(), base));
      if (isNaN(parseInt(value.trim(), base))) throw new Error('Invalid');
      setParsedNum(n);
      setError('');
    } catch {
      setParsedNum(null);
      setError('Invalid number for the selected base');
    }
  };

  const results = parsedNum !== null ? [
    { label: 'Binary (base 2)', value: toBase(parsedNum, 2), base: 2 },
    { label: 'Octal (base 8)', value: toBase(parsedNum, 8), base: 8 },
    { label: 'Decimal (base 10)', value: toBase(parsedNum, 10), base: 10 },
    { label: 'Hexadecimal (base 16)', value: toBase(parsedNum, 16), base: 16 },
  ] : [];

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Number Base Converter</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Convert between binary, octal, decimal, and hex</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            Input base
            <select className="input-base text-xs py-1" style={{ width: 120 }} value={inputBase} onChange={(e) => { const b = Number(e.target.value); setInputBase(b); handleInput(input, b); }}>
              <option value={2}>Binary (2)</option>
              <option value={8}>Octal (8)</option>
              <option value={10}>Decimal (10)</option>
              <option value={16}>Hexadecimal (16)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-xl space-y-4">
        <input
          className="input-base font-mono"
          placeholder="Enter a number…"
          value={input}
          onChange={(e) => handleInput(e.target.value, inputBase)}
        />
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        {results.length > 0 && (
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {results.map((r) => (
              <div key={r.base} className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs w-36 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <code className="flex-1 font-mono text-sm" style={{ color: r.base === inputBase ? 'var(--accent)' : 'var(--text-primary)' }}>{r.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
