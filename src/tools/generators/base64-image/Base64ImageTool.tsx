import { useState, useRef } from 'react';
import { Upload, Download, Copy, CheckCircle } from 'lucide-react';
import { copyToClipboard, downloadText } from '../../../lib/utils';

export default function Base64ImageTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [dataUrl, setDataUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [mime, setMime] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target!.result as string;
      setDataUrl(result);
      setMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleDecode = () => {
    const trimmed = textInput.trim();
    if (trimmed.startsWith('data:')) {
      setPreviewSrc(trimmed);
    } else {
      // Try adding a generic data URL prefix
      setPreviewSrc(`data:image/png;base64,${trimmed}`);
    }
  };

  const handleCopy = async () => {
    await copyToClipboard(dataUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Base64 Image Encode / Decode</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Encode images to Base64 data URLs or decode them back</p>
        </div>
        <select className="input-base text-xs py-1" style={{ width: 110 }} value={mode} onChange={(e) => setMode(e.target.value as 'encode' | 'decode')}>
          <option value="encode">Encode</option>
          <option value="decode">Decode</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {mode === 'encode' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer mb-3"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Drop image or click to upload</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {dataUrl && <img src={dataUrl} alt="Preview" className="rounded-lg max-h-48 w-full object-contain" style={{ background: 'var(--bg-tertiary)' }} />}
            </div>
            <div className="flex flex-col gap-2">
              {dataUrl ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Data URL ({mime})</span>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                        {copied ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => downloadText(dataUrl, 'image-base64.txt')}>
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                  <textarea className="input-base flex-1 font-mono text-xs resize-none" readOnly value={dataUrl} rows={10} />
                </>
              ) : (
                <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                  <p className="text-sm">Upload an image to encode</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Base64 data URL or raw base64</label>
              <textarea
                className="input-base font-mono text-xs resize-none flex-1"
                rows={10}
                placeholder="data:image/png;base64,iVBORw0K..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button className="btn btn-accent btn-sm self-start" onClick={handleDecode}>Decode & Preview</button>
            </div>
            <div className="flex flex-col gap-2">
              {previewSrc && (
                <>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Preview</span>
                  <img src={previewSrc} alt="Decoded" className="rounded-lg max-h-64 object-contain" style={{ background: 'var(--bg-tertiary)' }} onError={() => setPreviewSrc('')} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
