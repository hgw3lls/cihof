import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/archivo-black/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/900.css';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ReviewDashboardView } from '../features/review-dashboard/ReviewDashboardView';
import '../styles/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App defaultView="review" ReviewDashboard={ReviewDashboardView} />
    </ErrorBoundary>
  </React.StrictMode>,
);
