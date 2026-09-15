import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { PortalApp } from './PortalApp';
import { registerServiceWorker } from './serviceWorkerRegistration';
import '../styles/final-exhibit/fonts.css';
import '../styles/styles.css';
import '../styles/visual-grammar.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PortalApp />
    </ErrorBoundary>
  </React.StrictMode>,
);

registerServiceWorker();
