import { useEffect } from 'react';

const viewportLockClassName = 'cihof-viewport-locked';

export function useViewportLock() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    let animationFrame = 0;

    function measureViewport() {
      animationFrame = 0;
      const visualViewport = window.visualViewport;
      const width = Math.max(320, Math.round(visualViewport?.width ?? window.innerWidth));
      const height = Math.max(320, Math.round(visualViewport?.height ?? window.innerHeight));

      root.style.setProperty('--cihof-vw', `${width}px`);
      root.style.setProperty('--cihof-vh', `${height}px`);
      root.dataset.viewportWidth = String(width);
      root.dataset.viewportHeight = String(height);

      if (window.scrollX || window.scrollY) {
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
      }
    }

    function scheduleMeasure() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(measureViewport);
    }

    root.classList.add(viewportLockClassName);
    body.classList.add(viewportLockClassName);
    measureViewport();

    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
      root.classList.remove(viewportLockClassName);
      body.classList.remove(viewportLockClassName);
      root.style.removeProperty('--cihof-vw');
      root.style.removeProperty('--cihof-vh');
      delete root.dataset.viewportWidth;
      delete root.dataset.viewportHeight;
    };
  }, []);
}
