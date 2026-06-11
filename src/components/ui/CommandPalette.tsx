import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import Fuse from 'fuse.js';
import { useAppStore } from '../../store';
import { toolRegistry } from '../../tools/registry';
import type { ToolDefinition } from '../../tools/types';

const ALL_TOOLS = Array.from(toolRegistry.values());

const fuse = new Fuse(ALL_TOOLS, {
  keys: ['title', 'description', 'keywords'],
  threshold: 0.35,
  includeScore: true,
});

export default function CommandPalette() {
  const { cmdPaletteOpen, setCmdPaletteOpen, addRecentTool } = useAppStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query
    ? fuse.search(query).map((r) => r.item)
    : ALL_TOOLS.slice(0, 12);

  useEffect(() => {
    if (cmdPaletteOpen) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [cmdPaletteOpen]);

  const choose = (tool: ToolDefinition) => {
    navigate(`/tools/${tool.id}`);
    addRecentTool(tool.id);
    setCmdPaletteOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') { if (results[selected]) choose(results[selected]); }
    if (e.key === 'Escape') setCmdPaletteOpen(false);
  };

  if (!cmdPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setCmdPaletteOpen(false); }}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Search tools…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKey}
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No tools found</p>
          )}
          {results.map((tool, i) => (
            <div
              key={tool.id}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
              style={{
                background: i === selected ? 'var(--accent-subtle)' : undefined,
                color: i === selected ? 'var(--accent)' : 'var(--text-primary)',
              }}
              onMouseEnter={() => setSelected(i)}
              onClick={() => choose(tool)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{tool.title}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{tool.description}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {tool.category}
                </span>
                {i === selected && <ArrowRight size={14} style={{ color: 'var(--accent)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
