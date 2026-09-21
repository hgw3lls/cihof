/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIHOF_SHOW_KIOSK_TOGGLE?: string;
  readonly VITE_CIHOF_KIOSK_IDLE_MS?: string;
  readonly VITE_CIHOF_KIOSK_RESET_WARNING_MS?: string;
  readonly VITE_CIHOF_IDLE_TIMEOUT_MS?: string;
  readonly VITE_CIHOF_IDLE_WARNING_MS?: string;
  readonly VITE_CIHOF_ATTRACT_REGROUP_MS?: string;
  readonly VITE_CIHOF_LATEST_CLASS_TAKEOVER_ENABLED?: string;
  readonly VITE_CIHOF_LATEST_CLASS_INITIAL_DELAY_MS?: string;
  readonly VITE_CIHOF_LATEST_CLASS_INTRO_MS?: string;
  readonly VITE_CIHOF_LATEST_CLASS_PORTRAIT_MS?: string;
  readonly VITE_CIHOF_LATEST_CLASS_GROUP_MS?: string;
  readonly VITE_CIHOF_LATEST_CLASS_FINALE_MS?: string;
  readonly VITE_CIHOF_LATEST_CLASS_LOOP_PAUSE_MS?: string;
  readonly VITE_CIHOF_SHARED_PORTRAIT_MS?: string;
  readonly VITE_CIHOF_TRANSITION_INPUT_GUARD_MS?: string;
  readonly VITE_CIHOF_PARTICIPATORY_ENABLED?: string;
  readonly VITE_CIHOF_QR_ENABLED?: string;
  readonly VITE_CIHOF_SOUND_ENABLED?: string;
  readonly VITE_CIHOF_KIOSK_GUARDS_ENABLED?: string;
  readonly VITE_CIHOF_DATA_CACHE_ENABLED?: string;
  readonly VITE_CIHOF_DEBUG?: string;
  readonly VITE_CIHOF_HEARTBEAT_MS?: string;
  readonly VITE_CIHOF_QR_AUTO_CLOSE_MS?: string;
  readonly VITE_CIHOF_ANIMATION_INTENSITY?: string;
  readonly VITE_CIHOF_ADMIN_PASSCODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __CIHOF_BUILD_INFO__: import('./app/buildInfo').BuildInfo;

/** Allowlisted client-visible configuration, built by vite.config.ts. */
declare const __CIHOF_RUNTIME_ENV__: Record<string, string | undefined>;
