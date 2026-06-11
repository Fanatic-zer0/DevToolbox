import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { detectTools } from '../../services/detection';
import { toolRegistry } from '../../tools/registry';
import type { DetectionResult } from '../../tools/types';

export default function SmartDetectionModal() {
  const { detectionInput, setDetectionInput, recentTools, addRecentTool } = useAppStore();
  const [results, setResults] = useState<DetectionResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!detectionInput.trim()) { setResults([]); return; }
    const found = detectTools({ text: detectionInput, kind: 'text' }, toolRegistry, recentTools);
    setResults(found);
  }, [detectionInput, recentTools]);

  if (!results.length) return null;

  const openTool = (toolId: string) => {
    navigate(`/tools/${toolId}`);
    addRecentTool(toolId);
    setDetectionInput('');
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-40 rounded-xl shadow-2xl w-80 overflow-hidden fade-in"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
          <Sparkles size={14} />
          Suggested tools
        </div>
        <button onClick={() => setDetectionInput('')}>
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
      <div className="py-1.5">
        {results.map((r, i) => (
          <div
            key={r.toolId}
            className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-bg-tertiary transition-colors"
            style={{ background: i === 0 ? 'var(--accent-subtle)' : undefined }}
            onClick={() => openTool(r.toolId)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.tool.title}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.reason}</div>
            </div>
            <div className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              {Math.round(r.confidence * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
