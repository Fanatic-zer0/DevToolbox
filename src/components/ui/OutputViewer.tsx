import { Copy, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { copyToClipboard, downloadText } from '../../lib/utils';
import InputEditor, { type LangMode } from './InputEditor';

interface OutputViewerProps {
  value: string;
  error?: string;
  language?: LangMode;
  filename?: string;
  label?: string;
  metadata?: React.ReactNode;
}

export default function OutputViewer({ value, error, language = 'text', filename = 'output.txt', label = 'Output', metadata }: OutputViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pane">
      <div className="pane-label">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          {metadata}
          <button className="btn btn-ghost btn-sm" onClick={() => downloadText(value, filename)}>
            <Download size={12} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      {error ? (
        <div className="flex items-start gap-2 p-3 m-2 rounded-md text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
        </div>
      ) : (
        <div className="editor-fill">
          <InputEditor value={value} readOnly language={language} />
        </div>
      )}
    </div>
  );
}
