import type { Page } from '@playwright/test';

const longKioskIdleSettings = {
  portraitLimit: 111,
  portraitScale: 1,
  screenScale: 1,
  fieldInsetVmin: 0,
  labelScale: 1,
  idleTimeoutMs: 600_000,
  idleWarningMs: 0,
  attractRegroupMs: 14_000,
  motion: 'standard',
  showTouchCue: true,
  showVocabulary: true,
  showRecordLayer: true,
  adminHotkey: 'Ctrl+Alt+A',
};

export async function useLongKioskIdle(page: Page) {
  await page.addInitScript((settings) => {
    window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify(settings));
  }, longKioskIdleSettings);

  await page.evaluate((settings) => {
    try {
      window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('cihof:kiosk-settings-changed', { detail: settings }));
    } catch {
      // The current page may still be about:blank before navigation; addInitScript covers that case.
    }
  }, longKioskIdleSettings);
}
