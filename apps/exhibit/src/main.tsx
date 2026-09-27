import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { applyTheme, readTheme, rememberedTheme } from './app/theme.ts';

// Before the first render, so the page never flashes the other theme.
const target = import.meta.env.VITE_CIHOF_TARGET;
applyTheme(readTheme(location.search, target, target === 'public' ? rememberedTheme() : null));

createRoot(document.getElementById('exhibit')!).render(<StrictMode><App /></StrictMode>);
