import { useEffect } from 'react';
import { useAppStore } from '../../store';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from '../ui/CommandPalette';
import SmartDetectionModal from '../ui/SmartDetectionModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useAppStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useAppStore.getState().setCmdPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 overflow-y-auto border-r"
        style={{
          width: sidebarOpen ? 'var(--sidebar-w)' : '0',
          borderColor: 'var(--border)',
          background: 'var(--bg-secondary)',
          transition: 'width 0.2s',
          overflow: sidebarOpen ? 'auto' : 'hidden',
        }}
      >
        {sidebarOpen && <Sidebar />}
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          {children}
        </main>
      </div>

      {/* Overlays */}
      <CommandPalette />
      <SmartDetectionModal />
    </div>
  );
}
