import { Clipboard, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import InputEditor, { type LangMode } from './InputEditor';
import OutputViewer from './OutputViewer';
import { copyToClipboard } from '../../lib/utils';
import { useAppStore } from '../../store';
import { detectTools } from '../../services/detection';
import { toolRegistry } from '../../tools/registry';

export interface TwoColToolOption {
  id: string;
  label: string;
  type: 'select' | 'toggle' | 'number';
  options?: { label: string; value: string }[];
  default: unknown;
  min?: number;
  max?: number;
}

interface TwoColToolProps {
  title: string;
  description?: string;
  inputLang?: LangMode;
  outputLang?: LangMode;
  inputLabel?: string;
  outputLabel?: string;
  outputFilename?: string;
  options?: TwoColToolOption[];
  transform?: (input: string, options: Record<string, unknown>) => { output: string; error?: string };
  transformAsync?: (input: string, options: Record<string, unknown>) => Promise<{ output: string; error?: string }>;
  children?: React.ReactNode;
}

export default function TwoColTool({
  title,
  description,
  inputLang,
  outputLang,
  inputLabel = 'Input',
  outputLabel = 'Output',
  outputFilename,
  options = [],
  transform,
  transformAsync,
  children,
}: TwoColToolProps) {
  const [input, setInput] = useState('');
  const [opts, setOpts] = useState<Record<string, unknown>>(
    Object.fromEntries(options.map((o) => [o.id, o.default]))
  );
  const [asyncResult, setAsyncResult] = useState<{ output: string; error?: string }>({ output: '' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setDetectionInput } = useAppStore();
  const { recentTools } = useAppStore();

  // Sync transform result
  const syncResult = transform ? transform(input, opts) : null;

  // Async transform with debounce
  useEffect(() => {
    if (!transformAsync) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const result = await transformAsync(input, opts);
      setAsyncResult(result);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, opts, transformAsync]);

  const { output, error } = syncResult ?? asyncResult;

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setInput(text);
    if (text.trim()) {
      setDetectionInput(text);
    }
  };

  const setOpt = (id: string, value: unknown) => setOpts((prev) => ({ ...prev, [id]: value }));

  return (
    <div className="tool-panel">
      {/* Header */}
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Options inline */}
          {options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {opt.type === 'select' && (
                <>
                  <span>{opt.label}</span>
                  <select
                    className="input-base text-xs py-1"
                    style={{ width: 'auto', minWidth: 90 }}
                    value={String(opts[opt.id] ?? opt.default)}
                    onChange={(e) => setOpt(opt.id, e.target.value)}
                  >
                    {opt.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </>
              )}
              {opt.type === 'toggle' && (
                <>
                  <input type="checkbox" checked={Boolean(opts[opt.id])} onChange={(e) => setOpt(opt.id, e.target.checked)} />
                  <span>{opt.label}</span>
                </>
              )}
              {opt.type === 'number' && (
                <>
                  <span>{opt.label}</span>
                  <input
                    type="number"
                    className="input-base text-xs py-1"
                    style={{ width: 60 }}
                    value={String(opts[opt.id] ?? opt.default)}
                    min={opt.min}
                    max={opt.max}
                    onChange={(e) => setOpt(opt.id, Number(e.target.value))}
                  />
                </>
              )}
            </label>
          ))}
          {children}
          <button className="btn btn-ghost btn-sm" onClick={handlePaste} title="Paste from clipboard">
            <Clipboard size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setInput('')} title="Clear">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="tool-body">
        <div className="pane">
          <div className="pane-label">{inputLabel}</div>
          <div className="editor-fill">
            <InputEditor value={input} onChange={setInput} language={inputLang} />
          </div>
        </div>
        <div className="pane-divider" />
        <OutputViewer
          value={output}
          error={error}
          language={outputLang}
          label={outputLabel}
          filename={outputFilename ?? `${title.toLowerCase().replace(/\W+/g, '-')}.txt`}
        />
      </div>
    </div>
  );
}
