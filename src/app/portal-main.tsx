import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ReviewDashboardView } from '../features/review-dashboard/ReviewDashboardView';
import '../styles/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App defaultView="review" ReviewDashboard={ReviewDashboardView} />
  </React.StrictMode>,
);
