import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { toolRegistry } from '../tools/registry';

// Home page
const HomePage = lazy(() => import('../pages/HomePage'));

function ToolRoute({ toolId }: { toolId: string }) {
  const tool = toolRegistry.get(toolId);
  if (!tool) return <Navigate to="/" replace />;
  const LazyTool = lazy(tool.load);
  return (
    <Suspense fallback={<LoadingPane />}>
      <LazyTool />
    </Suspense>
  );
}

function LoadingPane() {
  return (
    <div className="flex items-center justify-center h-full text-text-secondary text-sm">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Suspense fallback={<LoadingPane />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {Array.from(toolRegistry.values()).map((tool) => (
              <Route
                key={tool.id}
                path={`/tools/${tool.id}`}
                element={<ToolRoute toolId={tool.id} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </HashRouter>
  );
}
