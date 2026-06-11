import { useState } from 'react';
import { v1, v4 } from 'uuid';
import { monotonicFactory } from 'ulidx';
import { Copy, RefreshCw, CheckCircle } from 'lucide-react';
import { copyToClipboard } from '../../../lib/utils';

const ulid = monotonicFactory();

type Mode = 'uuid1' | 'uuid4' | 'ulid' | 'decode';

function generateIds(type: Exclude<Mode, 'decode'>, count: number): string[] {
  return Array.from({ length: count }, () => {
    if (type === 'uuid1') return v1();
    if (type === 'ulid') return ulid();
    return v4();
  });
}

function decodeUuid(id: string) {
  const trimmed = id.trim();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ulidRe = /^[0-9A-Z]{26}$/;
  if (uuidRe.test(trimmed)) {
    const version = trimmed[14];
    return `Type: UUID v${version}\nValue: ${trimmed}\nVariant: RFC 4122`;
  }
  if (ulidRe.test(trimmed)) {
    const ts = parseInt(trimmed.slice(0, 10), 32);
    return `Type: ULID\nValue: ${trimmed}\nTimestamp: ${new Date(ts).toISOString()}`;
  }
  return 'Not a valid UUID or ULID';
}

export default function UuidTool() {
  const [mode, setMode] = useState<Mode>('uuid4');
  const [count, setCount] = useState(1);
  const [input, setInput] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = () => {
    if (mode === 'decode') return;
    setIds(generateIds(mode, count));
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const decodeResult = mode === 'decode' && input ? decodeUuid(input) : null;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>UUID / ULID Generator</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Generate and decode UUID v1/v4 and ULID identifiers</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-base text-xs py-1" style={{ width: 110 }} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="uuid4">UUID v4</option>
            <option value="uuid1">UUID v1</option>
            <option value="ulid">ULID</option>
            <option value="decode">Decode</option>
          </select>
          {mode !== 'decode' && (
            <>
              <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Count
                <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className="input-base text-xs py-1" style={{ width: 56 }} />
              </label>
              <button className="btn btn-accent btn-sm" onClick={generate}>
                <RefreshCw size={12} /> Generate
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {mode === 'decode' ? (
          <div className="space-y-3 max-w-xl">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>UUID or ULID to decode</label>
              <input
                className="input-base font-mono"
                placeholder="Paste UUID or ULID here…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            {decodeResult && (
              <pre className="p-3 rounded-lg text-sm font-mono whitespace-pre-wrap" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {decodeResult}
              </pre>
            )}
          </div>
        ) : (
          <div className="space-y-1 max-w-xl">
            {ids.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Click Generate to create identifiers</p>
            )}
            {ids.map((id) => (
              <div key={id} className="flex items-center gap-2 group px-3 py-2 rounded-md hover:bg-bg-tertiary" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="flex-1 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{id}</span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-ghost btn-sm" onClick={() => handleCopy(id)}>
                  {copied === id ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                </button>
              </div>
            ))}
            {ids.length > 0 && (
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => handleCopy(ids.join('\n'))}>
                <Copy size={12} /> Copy all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
