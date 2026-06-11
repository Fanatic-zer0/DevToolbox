import { useState, useRef } from 'react';
import InputEditor from '../../../components/ui/InputEditor';

export default function HtmlPreviewTool() {
  const [html, setHtml] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = html || '<p style="color:#94a3b8;font-family:sans-serif;padding:20px">Enter HTML on the left to see a live preview</p>';

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>HTML Preview</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Renders in a sandboxed iframe — no scripts execute</p>
      </div>
      <div className="tool-body">
        <div className="pane">
          <div className="pane-label">HTML</div>
          <div className="editor-fill">
            <InputEditor value={html} onChange={setHtml} language="html" />
          </div>
        </div>
        <div className="pane-divider" />
        <div className="pane">
          <div className="pane-label">Preview</div>
          <iframe
            ref={iframeRef}
            className="flex-1 w-full"
            style={{ border: 'none', background: 'white' }}
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            title="HTML Preview"
          />
        </div>
      </div>
    </div>
  );
}
