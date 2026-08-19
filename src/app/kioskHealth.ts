import type { ViewMode } from '../data/types';
import { buildInfo, type BuildInfo } from './buildInfo';

export type KioskDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export type KioskHealthSnapshot = {
  schemaVersion: 1;
  appName: 'CIHOF Portrait Wall';
  buildInfo: BuildInfo;
  baseUrl: string;
  buildMode: string;
  bootedAt: string;
  lastHeartbeatAt: string;
  heartbeatCount: number;
  currentView: ViewMode;
  kioskMode: boolean;
  attractActive: boolean;
  selectedPersonId: string;
  peopleCount: number;
  relationshipsCount: number;
  dataStatus: KioskDataStatus;
  dataError: string;
  lastInteractionAt: string;
  lastInteractionSource: string;
  lastResetAt: string;
  lastResetReason: string;
  resetCount: number;
  lastErrorAt: string;
  lastErrorMessage: string;
  lastErrorStack: string;
  lastErrorSource: string;
};

type KioskHealthPatch = Partial<Omit<KioskHealthSnapshot, 'schemaVersion' | 'appName' | 'bootedAt'>>;

declare global {
  interface Window {
    __CIHOF_KIOSK_STATUS__?: KioskHealthSnapshot;
  }
}

const storageKey = 'cihof.kiosk.health.v1';
const healthEventName = 'cihof:kiosk-health';
let healthSnapshot: KioskHealthSnapshot | null = null;
let heartbeatIntervalId: number | null = null;

export function initializeKioskHealth() {
  if (healthSnapshot) return healthSnapshot;
  const now = timestamp();
  healthSnapshot = {
    schemaVersion: 1,
    appName: 'CIHOF Portrait Wall',
    buildInfo,
    baseUrl: import.meta.env.BASE_URL,
    buildMode: import.meta.env.MODE,
    bootedAt: now,
    lastHeartbeatAt: now,
    heartbeatCount: 0,
    currentView: 'all-people',
    kioskMode: false,
    attractActive: false,
    selectedPersonId: '',
    peopleCount: 0,
    relationshipsCount: 0,
    dataStatus: 'idle',
    dataError: '',
    lastInteractionAt: now,
    lastInteractionSource: 'boot',
    lastResetAt: '',
    lastResetReason: '',
    resetCount: 0,
    lastErrorAt: '',
    lastErrorMessage: '',
    lastErrorStack: '',
    lastErrorSource: '',
  };
  publishHealth();
  return healthSnapshot;
}

export function startKioskHeartbeat(intervalMs = 15_000) {
  initializeKioskHealth();
  if (heartbeatIntervalId !== null) {
    window.clearInterval(heartbeatIntervalId);
  }

  recordHeartbeat();
  heartbeatIntervalId = window.setInterval(recordHeartbeat, intervalMs);

  return () => {
    if (heartbeatIntervalId === null) return;
    window.clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  };
}

export function recordKioskHealth(patch: KioskHealthPatch) {
  healthSnapshot = {
    ...initializeKioskHealth(),
    ...patch,
  };
  publishHealth();
  return healthSnapshot;
}

export function recordKioskInteraction(source: string) {
  return recordKioskHealth({
    lastInteractionAt: timestamp(),
    lastInteractionSource: source,
  });
}

export function recordKioskReset(reason: string) {
  const current = initializeKioskHealth();
  return recordKioskHealth({
    lastResetAt: timestamp(),
    lastResetReason: reason,
    resetCount: current.resetCount + 1,
  });
}

export function recordKioskError(error: unknown, source = 'runtime') {
  const normalized = normalizeError(error);
  return recordKioskHealth({
    lastErrorAt: timestamp(),
    lastErrorMessage: normalized.message,
    lastErrorStack: normalized.stack,
    lastErrorSource: source,
    dataStatus: 'error',
  });
}

export function getKioskHealth() {
  return initializeKioskHealth();
}

function recordHeartbeat() {
  const current = initializeKioskHealth();
  recordKioskHealth({
    heartbeatCount: current.heartbeatCount + 1,
    lastHeartbeatAt: timestamp(),
  });
}

function publishHealth() {
  if (!healthSnapshot) return;
  window.__CIHOF_KIOSK_STATUS__ = healthSnapshot;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(healthSnapshot));
  } catch {
    // Some kiosk shells disable localStorage. The window status remains available.
  }
  window.dispatchEvent(new CustomEvent<KioskHealthSnapshot>(healthEventName, { detail: healthSnapshot }));
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown runtime error',
      stack: truncate(error.stack ?? ''),
    };
  }
  if (typeof error === 'string') {
    return { message: error, stack: '' };
  }
  try {
    return { message: JSON.stringify(error), stack: '' };
  } catch {
    return { message: 'Unknown runtime error', stack: '' };
  }
}

function truncate(value: string) {
  return value.length > 2400 ? `${value.slice(0, 2400)}...` : value;
}

function timestamp() {
  return new Date().toISOString();
}
