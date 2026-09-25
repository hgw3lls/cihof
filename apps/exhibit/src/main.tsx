import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { readTheme, themeGround } from './app/theme.ts';

// Before the first render, so the page never flashes the other theme.
const theme = readTheme(location.search, import.meta.env.VITE_CIHOF_TARGET);
document.documentElement.dataset.theme = theme;
if (theme !== 'auto') {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute('content', themeGround[theme]);
}

createRoot(document.getElementById('exhibit')!).render(<StrictMode><App /></StrictMode>);
