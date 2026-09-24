import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './review.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
