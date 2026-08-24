import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { recordKioskError, recordKioskReset } from './kioskHealth';
import { stopAllMedia } from './mediaControl';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordKioskError(error, info.componentStack || 'react-error-boundary');
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="kiosk-error-screen" role="alert" aria-live="assertive">
        <section className="kiosk-error-screen__panel" aria-label="Kiosk recovery">
          <p className="museum-kicker">CIHOF Portrait Wall</p>
          <h1>WE NEED TO RESET THIS SCREEN</h1>
          <p>
            The portrait wall hit a software error. Resetting returns the screen to the museum home state and records the failure for review.
          </p>
          <div className="kiosk-error-screen__actions">
            <button type="button" onClick={recoverToHome}>
              Reset Experience
            </button>
            <button type="button" onClick={reloadScreen}>
              Reload Screen
            </button>
          </div>
        </section>
      </main>
    );
  }
}

function recoverToHome() {
  stopMedia();
  recordKioskReset('error-boundary');
  const url = new URL(window.location.href);
  const keepKioskMode = url.searchParams.get('kiosk') === '1' && !url.pathname.endsWith('/portal.html');
  url.search = '';
  if (keepKioskMode) url.searchParams.set('kiosk', '1');
  window.location.assign(url.toString());
}

function reloadScreen() {
  stopMedia();
  recordKioskReset('error-boundary-reload');
  window.location.reload();
}

function stopMedia() {
  stopAllMedia();
}
