import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './index.css';
import { applyTheme, useAppStore } from './store';

// Apply saved theme immediately to avoid flash
const saved = JSON.parse(localStorage.getItem('devtoolbox-app') ?? '{}') as { state?: { theme?: string } };
applyTheme((saved?.state?.theme as 'light' | 'dark' | 'system') ?? 'system');

// Keep system theme in sync
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { theme } = useAppStore.getState();
  if (theme === 'system') applyTheme('system');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
