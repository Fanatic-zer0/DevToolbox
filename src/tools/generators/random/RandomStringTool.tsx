import { useState, useRef } from 'react';
import { RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { copyToClipboard } from '../../../lib/utils';

const CHARSETS: Record<string, string> = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  alpha:        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  numeric:      '0123456789',
  hex:          '0123456789abcdef',
  lowercase:    'abcdefghijklmnopqrstuvwxyz',
  uppercase:    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  symbols:      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?',
};

function generateRandom(length: number, charset: string, count: number): string[] {
  const arr = new Uint32Array(length * count);
  crypto.getRandomValues(arr);
  return Array.from({ length: count }, (_, i) =>
    Array.from({ length }, (_, j) => charset[arr[i * length + j] % charset.length]).join('')
  );
}

export default function RandomStringTool() {
  const [length, setLength] = useState(32);
  const [charset, setCharset] = useState('alphanumeric');
  const [custom, setCustom] = useState('');
  const [count, setCount] = useState(1);
  const [values, setValues] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = () => {
    const cs = charset === 'custom' ? (custom || CHARSETS.alphanumeric) : CHARSETS[charset];
    setValues(generateRandom(length, cs, count));
  };

  const handleCopy = async (v: string) => {
    await copyToClipboard(v);
    setCopied(v);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Random String Generator</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Generate cryptographically random strings and passwords</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Length
            <input type="number" min={1} max={256} value={length} onChange={(e) => setLength(Number(e.target.value))} className="input-base text-xs py-1" style={{ width: 60 }} />
          </label>
          <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Count
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className="input-base text-xs py-1" style={{ width: 56 }} />
          </label>
          <select className="input-base text-xs py-1" style={{ width: 130 }} value={charset} onChange={(e) => setCharset(e.target.value)}>
            <option value="alphanumeric">Alphanumeric</option>
            <option value="alpha">Alpha only</option>
            <option value="lowercase">Lowercase</option>
            <option value="uppercase">Uppercase</option>
            <option value="numeric">Numeric</option>
            <option value="hex">Hex</option>
            <option value="symbols">With symbols</option>
            <option value="custom">Custom…</option>
          </select>
          <button className="btn btn-accent btn-sm" onClick={generate}>
            <RefreshCw size={12} /> Generate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {charset === 'custom' && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Custom characters</label>
            <input className="input-base font-mono" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. ABCDEF0123456789" />
          </div>
        )}
        {values.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Click Generate to create random strings</p>
        )}
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <code className="flex-1 break-all text-sm p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</code>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-ghost btn-sm flex-shrink-0" onClick={() => handleCopy(v)}>
              {copied === v ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
