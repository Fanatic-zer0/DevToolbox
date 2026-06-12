import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, ArrowLeftRight, Search, Code2, Server, Network, Pin, Clock, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store';
import { toolsByCategory, categoryMeta, toolRegistry } from '../../tools/registry';
import { cn } from '../../lib/utils';
import type { ToolDefinition } from '../../tools/types';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  generators: Zap,
  converters: ArrowLeftRight,
  inspect: Search,
  formatters: Code2,
  devops: Server,
  networking: Network,
};

function ToolItem({ tool, onClick }: { tool: ToolDefinition; onClick: () => void }) {
  const location = useLocation();
  const active = location.hash === `#/tools/${tool.id}` || location.pathname === `/tools/${tool.id}`;
  const { pinnedTools, togglePin } = useAppStore();
  const isPinned = pinnedTools.includes(tool.id);

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm transition-colors relative',
        active ? 'bg-accent text-white' : 'hover:bg-bg-tertiary text-text-secondary'
      )}
      style={active ? { background: 'var(--accent)', color: 'white' } : undefined}
      onClick={onClick}
    >
      <span className="flex-1 truncate">{tool.title}</span>
      <button
        className={cn('opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded', isPinned && 'opacity-100')}
        style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
        onClick={(e) => { e.stopPropagation(); togglePin(tool.id); }}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        <Pin size={11} className={isPinned ? 'fill-current' : ''} />
      </button>
    </div>
  );
}

function CategorySection({ category }: { category: string }) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const meta = categoryMeta[category];
  const Icon = CATEGORY_ICONS[category] ?? Code2;
  const tools = toolsByCategory[category] ?? [];
  const { addRecentTool } = useAppStore();

  return (
    <div className="mb-1">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors rounded-md"
        style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
        onClick={() => setOpen(!open)}
      >
        <Icon size={13} style={{ color: 'var(--accent)' }} />
        <span className="flex-1 text-left">{meta?.label ?? category}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="ml-1">
          {tools.map((tool) => (
            <ToolItem
              key={tool.id}
              tool={tool}
              onClick={() => {
                navigate(`/tools/${tool.id}`);
                addRecentTool(tool.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { recentTools, pinnedTools, addRecentTool } = useAppStore();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--accent)' }}>D</div>
        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>DevToolbox</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Pinned */}
        {pinnedTools.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>
              <Pin size={11} /> Pinned
            </div>
            {pinnedTools.map((id) => {
              const tool = toolRegistry.get(id);
              if (!tool) return null;
              return <ToolItem key={id} tool={tool} onClick={() => { navigate(`/tools/${id}`); addRecentTool(id); }} />;
            })}
          </div>
        )}

        {/* Recent */}
        {recentTools.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>
              <Clock size={11} /> Recent
            </div>
            {recentTools.slice(0, 5).map((id) => {
              const tool = toolRegistry.get(id);
              if (!tool) return null;
              return <ToolItem key={id} tool={tool} onClick={() => { navigate(`/tools/${id}`); addRecentTool(id); }} />;
            })}
          </div>
        )}

        {/* All categories */}
        {['generators', 'converters', 'inspect', 'formatters', 'devops', 'networking'].map((cat) => (
          <CategorySection key={cat} category={cat} />
        ))}
      </div>
    </div>
  );
}
