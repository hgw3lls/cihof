import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { PortalApp } from './PortalApp';
import '../styles/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PortalApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
