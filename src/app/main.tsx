import React from 'react';
import ReactDOM from 'react-dom/client';
import { ArchiveExhibit } from '../features/archive-exhibit/ArchiveExhibit';
import { ErrorBoundary } from './ErrorBoundary';
import { registerServiceWorker } from './serviceWorkerRegistration';
import '../features/archive-exhibit/archive-exhibit.css';
import '../features/archive-exhibit/archive-support.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ArchiveExhibit />
    </ErrorBoundary>
  </React.StrictMode>,
);

registerServiceWorker();
