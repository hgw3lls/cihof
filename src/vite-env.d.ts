/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIHOF_SHOW_KIOSK_TOGGLE?: string;
  readonly VITE_CIHOF_KIOSK_IDLE_MS?: string;
  readonly VITE_CIHOF_KIOSK_RESET_WARNING_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
