import { useState, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Download, Upload, RefreshCw } from 'lucide-react';
import { downloadBlob } from '../../../lib/utils';

type Mode = 'generate' | 'scan';

export default function QrTool() {
  const [mode, setMode] = useState<Mode>('generate');
  const [input, setInput] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scannedText, setScannedText] = useState('');
  const [error, setError] = useState('');
  const [errorLevel, setErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [size, setSize] = useState(300);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = async () => {
    if (!input.trim()) return;
    setError('');
    try {
      const url = await QRCode.toDataURL(input, { width: size, errorCorrectionLevel: errorLevel, margin: 2 });
      setQrDataUrl(url);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
        if (code) {
          setScannedText(code.data);
          setError('');
        } else {
          setError('Could not detect a QR code in this image.');
        }
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  };

  const downloadPng = () => {
    if (!qrDataUrl) return;
    fetch(qrDataUrl).then((r) => r.blob()).then((b) => downloadBlob(b, 'qrcode.png'));
  };

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR Code Reader / Generator</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Generate QR codes from text or scan them from images</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-base text-xs py-1" style={{ width: 110 }} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="generate">Generate</option>
            <option value="scan">Scan</option>
          </select>
          {mode === 'generate' && (
            <>
              <select className="input-base text-xs py-1" style={{ width: 80 }} value={errorLevel} onChange={(e) => setErrorLevel(e.target.value as 'L' | 'M' | 'Q' | 'H')}>
                <option value="L">ECC: L</option>
                <option value="M">ECC: M</option>
                <option value="Q">ECC: Q</option>
                <option value="H">ECC: H</option>
              </select>
              <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Size <input type="number" min={100} max={1000} step={50} value={size} onChange={(e) => setSize(Number(e.target.value))} className="input-base text-xs py-1" style={{ width: 70 }} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {mode === 'generate' ? (
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-full">
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Enter text, URL, or any content to encode…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button className="btn btn-accent" onClick={generate}>
              <RefreshCw size={14} /> Generate QR Code
            </button>
            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-3">
                <img src={qrDataUrl} alt="QR Code" className="rounded-lg shadow" style={{ width: size / 2, height: size / 2 }} />
                <button className="btn btn-ghost btn-sm" onClick={downloadPng}>
                  <Download size={13} /> Download PNG
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div
              className="w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
            >
              <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Drop an image or click to upload</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <canvas ref={canvasRef} className="hidden" />
            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            {scannedText && (
              <div className="w-full p-4 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Scanned content:</p>
                <p className="text-sm font-mono break-all" style={{ color: 'var(--text-primary)' }}>{scannedText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
