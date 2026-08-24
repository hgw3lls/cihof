import { runtimeLogger } from './runtimeLogger';

export function stopAllMedia() {
  document.querySelectorAll('video, audio').forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    stopMediaElement(media);
  });

  document.querySelectorAll('iframe').forEach((frame) => {
    try {
      frame.src = frame.src;
    } catch (error) {
      runtimeLogger.warn('Could not reset embedded media frame.', { error });
    }
  });

  window.dispatchEvent(new Event('cihof:stop-media'));
}

export function stopMediaElement(media: HTMLMediaElement | null) {
  if (!media) return;

  try {
    media.pause();
    if (Number.isFinite(media.duration)) media.currentTime = 0;
  } catch (error) {
    runtimeLogger.warn('Could not stop media element.', { error });
  }
}
