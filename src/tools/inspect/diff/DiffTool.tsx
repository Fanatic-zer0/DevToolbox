import { useMemo, useState } from 'react';
import { diffChars, diffWords, diffLines, type Change } from 'diff';
import InputEditor from '../../../components/ui/InputEditor';

type DiffMode = 'chars' | 'words' | 'lines';

function computeDiff(a: string, b: string, mode: DiffMode): Change[] {
  if (mode === 'chars') return diffChars(a, b);
  if (mode === 'words') return diffWords(a, b);
  return diffLines(a, b);
}

function DiffViewer({ changes }: { changes: Change[] }) {
  return (
    <pre className="p-3 text-sm font-mono whitespace-pre-wrap leading-relaxed overflow-auto flex-1"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
      {changes.map((c, i) => (
        <span
          key={i}
          style={{
            background: c.added ? 'rgba(74,222,128,0.25)' : c.removed ? 'rgba(248,113,113,0.25)' : undefined,
            color: c.added ? 'var(--success)' : c.removed ? 'var(--danger)' : undefined,
            textDecoration: c.removed ? 'line-through' : undefined,
          }}
        >
          {c.value}
        </span>
      ))}
    </pre>
  );
}

export default function DiffTool() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [mode, setMode] = useState<DiffMode>('lines');

  const changes = useMemo(() => (left || right ? computeDiff(left, right, mode) : []), [left, right, mode]);
  const added = changes.filter((c) => c.added).length;
  const removed = changes.filter((c) => c.removed).length;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Text Diff Checker</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Compare two blocks of text and highlight differences</p>
        </div>
        <div className="flex items-center gap-2">
          {(added || removed) ? (
            <>
              <span className="badge badge-success">+{added}</span>
              <span className="badge badge-danger">-{removed}</span>
            </>
          ) : null}
          <select className="input-base text-xs py-1" style={{ width: 90 }} value={mode} onChange={(e) => setMode(e.target.value as DiffMode)}>
            <option value="lines">Lines</option>
            <option value="words">Words</option>
            <option value="chars">Chars</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Input row */}
        <div className="flex flex-1 overflow-hidden border-b" style={{ borderColor: 'var(--border)', maxHeight: '40%' }}>
          <div className="pane">
            <div className="pane-label">Original</div>
            <div className="editor-fill">
              <InputEditor value={left} onChange={setLeft} />
            </div>
          </div>
          <div className="pane-divider" />
          <div className="pane">
            <div className="pane-label">Modified</div>
            <div className="editor-fill">
              <InputEditor value={right} onChange={setRight} />
            </div>
          </div>
        </div>

        {/* Diff result */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="pane-label">Diff</div>
          <DiffViewer changes={changes} />
        </div>
      </div>
    </div>
  );
}
