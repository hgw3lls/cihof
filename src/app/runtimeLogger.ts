import { installationConfig } from '../config/installationConfig';

type LogContext = Record<string, unknown>;

export const runtimeLogger = {
  debug(message: string, context?: LogContext) {
    if (!shouldLog()) return;
    console.debug(`[CIHOF] ${message}`, context ?? '');
  },
  warn(message: string, context?: LogContext) {
    if (!shouldLog()) return;
    console.warn(`[CIHOF] ${message}`, context ?? '');
  },
  error(message: string, context?: LogContext) {
    if (!shouldLog()) return;
    console.error(`[CIHOF] ${message}`, context ?? '');
  },
};

function shouldLog() {
  return installationConfig.debug.enabled;
}
