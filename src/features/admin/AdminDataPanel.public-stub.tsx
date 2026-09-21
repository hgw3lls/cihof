import type { KioskSettings } from '../../app/kioskSettings';

type AdminDataPanelProps = {
  open: boolean;
  onClose: () => void;
  settings: KioskSettings;
  onSettingsChange: (settings: KioskSettings) => void;
  archiveOnly?: boolean;
};

/**
 * Public-target stand-in for the staff panel.
 *
 * The real panel can replace the published runtime bundle for a browser, and
 * that capability has no place in the public web artifact. `vite.config.ts`
 * aliases this file in when CIHOF_BUILD_TARGET=public, so the panel and
 * everything it imports are absent from the bundle rather than merely
 * unreachable by route.
 *
 * The props are kept identical so the call site does not need a build-time
 * branch of its own.
 */
export function AdminDataPanel(_props: AdminDataPanelProps) {
  return null;
}
