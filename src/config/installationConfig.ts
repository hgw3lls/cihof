export type AnimationIntensity = 'none' | 'reduced' | 'standard';

export type InstallationConfig = {
  idle: {
    timeoutMs: number;
    warningMs: number;
  };
  attractLoop: {
    regroupMs: number;
    latestClass: {
      enabled: boolean;
      initialDelayMs: number;
      introMs: number;
      portraitMs: number;
      groupMs: number;
      finaleMs: number;
      loopPauseMs: number;
    };
  };
  transitions: {
    sharedPortraitMs: number;
    inputGuardMs: number;
  };
  features: {
    participatory: boolean;
    qrContinuation: boolean;
    sound: boolean;
    kioskGuards: boolean;
    dataCache: boolean;
    staffReview: boolean;
  };
  debug: {
    enabled: boolean;
    showKioskToggleInProduction: boolean;
  };
  health: {
    heartbeatMs: number;
  };
  qr: {
    autoCloseMs: number;
  };
  animationIntensity: AnimationIntensity;
};

export const installationConfig: InstallationConfig = {
  idle: {
    timeoutMs: readMs(['VITE_CIHOF_IDLE_TIMEOUT_MS', 'VITE_CIHOF_KIOSK_IDLE_MS'], 120_000, 1_000, 20 * 60_000),
    warningMs: readMs(['VITE_CIHOF_IDLE_WARNING_MS', 'VITE_CIHOF_KIOSK_RESET_WARNING_MS'], 12_000, 0, 120_000),
  },
  attractLoop: {
    regroupMs: readMs(['VITE_CIHOF_ATTRACT_REGROUP_MS'], 14_000, 4_000, 120_000),
    latestClass: {
      enabled: readBooleanEnv('VITE_CIHOF_LATEST_CLASS_TAKEOVER_ENABLED', true),
      initialDelayMs: readMs(['VITE_CIHOF_LATEST_CLASS_INITIAL_DELAY_MS'], 4_500, 1_000, 180_000),
      introMs: readMs(['VITE_CIHOF_LATEST_CLASS_INTRO_MS'], 2_100, 750, 20_000),
      portraitMs: readMs(['VITE_CIHOF_LATEST_CLASS_PORTRAIT_MS'], 2_650, 1_000, 30_000),
      groupMs: readMs(['VITE_CIHOF_LATEST_CLASS_GROUP_MS'], 4_600, 1_000, 60_000),
      finaleMs: readMs(['VITE_CIHOF_LATEST_CLASS_FINALE_MS'], 4_200, 1_000, 60_000),
      loopPauseMs: readMs(['VITE_CIHOF_LATEST_CLASS_LOOP_PAUSE_MS'], 36_000, 5_000, 20 * 60_000),
    },
  },
  transitions: {
    sharedPortraitMs: readMs(['VITE_CIHOF_SHARED_PORTRAIT_MS'], 620, 80, 4_000),
    inputGuardMs: readMs(['VITE_CIHOF_TRANSITION_INPUT_GUARD_MS'], 520, 80, 4_000),
  },
  features: {
    participatory: readBooleanEnv('VITE_CIHOF_PARTICIPATORY_ENABLED', true),
    qrContinuation: readBooleanEnv('VITE_CIHOF_QR_ENABLED', true),
    sound: readBooleanEnv('VITE_CIHOF_SOUND_ENABLED', true),
    kioskGuards: readBooleanEnv('VITE_CIHOF_KIOSK_GUARDS_ENABLED', true),
    dataCache: readBooleanEnv('VITE_CIHOF_DATA_CACHE_ENABLED', true),
    staffReview: readBooleanEnv('VITE_CIHOF_STAFF_REVIEW_ENABLED', false),
  },
  debug: {
    enabled: readBooleanEnv('VITE_CIHOF_DEBUG', import.meta.env.DEV),
    showKioskToggleInProduction: readBooleanEnv('VITE_CIHOF_SHOW_KIOSK_TOGGLE', false),
  },
  health: {
    heartbeatMs: readMs(['VITE_CIHOF_HEARTBEAT_MS'], 15_000, 5_000, 5 * 60_000),
  },
  qr: {
    autoCloseMs: readMs(['VITE_CIHOF_QR_AUTO_CLOSE_MS'], 45_000, 5_000, 5 * 60_000),
  },
  animationIntensity: readAnimationIntensity(import.meta.env.VITE_CIHOF_ANIMATION_INTENSITY),
};

function readMs(names: string[], fallback: number, min: number, max: number) {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const value = names.map((name) => env[name]).find((candidate) => candidate !== undefined);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = import.meta.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function readAnimationIntensity(value: string | undefined): AnimationIntensity {
  if (value === 'none' || value === 'reduced' || value === 'standard') return value;
  return 'standard';
}
