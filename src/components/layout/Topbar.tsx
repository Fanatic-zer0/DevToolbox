import { Menu, Search, Sun, Moon, Monitor, Keyboard } from 'lucide-react';
import { useAppStore, type Theme } from '../../store';

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };
const THEMES: Theme[] = ['light', 'dark', 'system'];

export default function Topbar() {
  const { sidebarOpen, setSidebarOpen, theme, setTheme, setCmdPaletteOpen } = useAppStore();
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header
      className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: 44 }}
    >
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle sidebar"
      >
        <Menu size={16} />
      </button>

      {/* Search / Command Palette trigger */}
      <button
        className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          maxWidth: 340,
        }}
        onClick={() => setCmdPaletteOpen(true)}
      >
        <Search size={14} />
        <span className="flex-1">Search tools…</span>
        <kbd
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* Keyboard shortcuts hint */}
      <button
        className="btn btn-ghost btn-sm hidden md:flex"
        title="Keyboard shortcuts"
        onClick={() => setCmdPaletteOpen(true)}
      >
        <Keyboard size={15} />
      </button>

      {/* Theme toggle */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setTheme(nextTheme)}
        title={`Theme: ${theme} (click to switch)`}
      >
        <ThemeIcon size={15} />
      </button>
    </header>
  );
}
