import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeftRight, Search, Code2, Server, type LucideIcon } from 'lucide-react';
import { toolsByCategory, categoryMeta } from '../tools/registry';
import { useAppStore } from '../store';
import type { ToolDefinition } from '../tools/types';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  generators: Zap,
  converters: ArrowLeftRight,
  inspect: Search,
  formatters: Code2,
  devops: Server,
};

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const navigate = useNavigate();
  const { addRecentTool } = useAppStore();
  return (
    <div
      className="p-3.5 rounded-lg cursor-pointer transition-all border hover:shadow-sm group"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      onClick={() => { navigate(`/tools/${tool.id}`); addRecentTool(tool.id); }}
    >
      <div className="text-sm font-medium mb-0.5 group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>
        {tool.title}
      </div>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {tool.description}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>DevToolbox</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            48 offline-first developer tools. Nothing leaves your machine.
            Press <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>⌘K</kbd> to search.
          </p>
        </div>

        {/* Categories */}
        {['generators', 'converters', 'inspect', 'formatters', 'devops'].map((cat) => {
          const Icon = CATEGORY_ICONS[cat] ?? Code2;
          const meta = categoryMeta[cat];
          const tools = toolsByCategory[cat] ?? [];
          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  {meta.label}
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {tools.length}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
