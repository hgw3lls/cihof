import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { stopAllMedia } from '../../app/mediaControl';
import type { KioskSettings } from '../../app/kioskSettings';
import { installationConfig } from '../../config/installationConfig';
import type { HallLens, Inductee } from '../../data/types';
import {
  readHallLayoutViewport,
  type HallLayoutViewport,
  type HallPersonAction,
} from './livingHallLayout';
import type { LatestClass, TraceContext } from './livingHallModes';

export type LatestClassFrame =
  | { kind: 'intro'; key: string }
  | { kind: 'person'; key: string; inductee: Inductee; index: number }
  | { kind: 'group'; key: string }
  | { kind: 'finale'; key: string };

type CityAttractConfig = {
  enabled: boolean;
  holdMs: number;
  initialDelayMs: number;
  loopPauseMs: number;
};

export function useHallLayoutViewport() {
  const [layoutViewport, setLayoutViewport] = useState<HallLayoutViewport>(() => readHallLayoutViewport());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function syncLayoutViewport() {
      setLayoutViewport(readHallLayoutViewport());
    }

    syncLayoutViewport();
    window.addEventListener('resize', syncLayoutViewport);
    window.visualViewport?.addEventListener('resize', syncLayoutViewport);

    return () => {
      window.removeEventListener('resize', syncLayoutViewport);
      window.visualViewport?.removeEventListener('resize', syncLayoutViewport);
    };
  }, []);

  return layoutViewport;
}

export function useReducedMotion(animationIntensity: KioskSettings['motion']) {
  const configuredReducedMotion = animationIntensity !== 'standard';
  const [reducedMotion, setReducedMotion] = useState(configuredReducedMotion);

  useEffect(() => {
    if (configuredReducedMotion) {
      setReducedMotion(true);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [configuredReducedMotion]);

  return reducedMotion;
}

export function useHallModeStep({
  focusedPersonId,
  modesLength,
  settings,
}: {
  focusedPersonId: string;
  modesLength: number;
  settings: KioskSettings;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (settings.motion === 'none') return undefined;
    if (focusedPersonId) return undefined;
    if (modesLength <= 1) return undefined;

    const interval = window.setInterval(() => {
      setStep((value) => value + 1);
    }, settings.attractRegroupMs);

    return () => window.clearInterval(interval);
  }, [focusedPersonId, modesLength, settings.attractRegroupMs, settings.motion]);

  useEffect(() => {
    if (modesLength > 0 && step >= modesLength) setStep(0);
  }, [modesLength, step]);

  return [step, setStep] as const;
}

export function useLatestClassSequence({
  attractActive,
  latestClass,
  reducedMotion,
  setStep,
}: {
  attractActive: boolean;
  latestClass: LatestClass | null;
  reducedMotion: boolean;
  setStep: Dispatch<SetStateAction<number>>;
}) {
  const [frame, setFrame] = useState<LatestClassFrame | null>(null);

  useEffect(() => {
    const config = installationConfig.attractLoop.latestClass;
    if (!config.enabled || !attractActive || !latestClass || latestClass.inductees.length === 0) {
      setFrame(null);
      return undefined;
    }

    let cancelled = false;
    const timers: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
      timers.push(timer);
    };

    const runSequence = () => {
      if (cancelled) return;
      setStep(0);

      if (reducedMotion) {
        setFrame({ kind: 'group', key: `latest-${latestClass.year}-group` });
        schedule(() => {
          setFrame({ kind: 'finale', key: `latest-${latestClass.year}-finale` });
        }, config.groupMs);
        schedule(() => {
          setFrame(null);
          setStep(0);
          schedule(runSequence, config.loopPauseMs);
        }, config.groupMs + config.finaleMs);
        return;
      }

      setFrame({ kind: 'intro', key: `latest-${latestClass.year}-intro` });
      latestClass.inductees.forEach((inductee, index) => {
        schedule(() => {
          setFrame({ kind: 'person', key: `latest-${latestClass.year}-${inductee.id}`, inductee, index });
        }, config.introMs + index * config.portraitMs);
      });

      const groupAt = config.introMs + latestClass.inductees.length * config.portraitMs;
      const finaleAt = groupAt + config.groupMs;
      const completeAt = finaleAt + config.finaleMs;
      schedule(() => {
        setFrame({ kind: 'group', key: `latest-${latestClass.year}-group` });
      }, groupAt);
      schedule(() => {
        setFrame({ kind: 'finale', key: `latest-${latestClass.year}-finale` });
      }, finaleAt);
      schedule(() => {
        setFrame(null);
        setStep(0);
        schedule(runSequence, config.loopPauseMs);
      }, completeAt);
    };

    schedule(runSequence, config.initialDelayMs);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      setFrame(null);
    };
  }, [attractActive, latestClass, reducedMotion, setStep]);

  return frame;
}

export function useCityResultsAttract({
  attractActive,
  cityAttract,
  cityQuestionEnabled,
  latestClassFrameActive,
}: {
  attractActive: boolean;
  cityAttract: CityAttractConfig;
  cityQuestionEnabled: boolean;
  latestClassFrameActive: boolean;
}) {
  const [active, setActive] = useState(false);
  const { enabled, holdMs, initialDelayMs, loopPauseMs } = cityAttract;

  useEffect(() => {
    if (!attractActive || latestClassFrameActive || !cityQuestionEnabled || !enabled) {
      setActive(false);
      return undefined;
    }

    let cancelled = false;
    const timers: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
      timers.push(timer);
    };

    const runResults = () => {
      setActive(true);
      schedule(() => {
        setActive(false);
        schedule(runResults, loopPauseMs);
      }, holdMs);
    };

    schedule(runResults, initialDelayMs);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      setActive(false);
    };
  }, [attractActive, cityQuestionEnabled, enabled, holdMs, initialDelayMs, latestClassFrameActive, loopPauseMs]);

  return active;
}

export function useTraceTrail({
  focusedPersonId,
  lens,
  traceContext,
}: {
  focusedPersonId: string;
  lens: HallLens;
  traceContext: TraceContext;
}) {
  const [traceTrailIds, setTraceTrailIds] = useState<string[]>([]);
  const trailKeyRef = useRef('');

  useEffect(() => {
    if (lens !== 'traces') {
      trailKeyRef.current = '';
      setTraceTrailIds([]);
      return;
    }

    if (!focusedPersonId || !traceContext.activePerson) return;

    const traceTrailKey = traceContext.traceFocusKey || 'direct';
    setTraceTrailIds((current) => {
      const sameTrace = trailKeyRef.current === traceTrailKey;
      trailKeyRef.current = traceTrailKey;
      const base = sameTrace ? current : [];
      if (base[base.length - 1] === focusedPersonId) return base;
      return [...base, focusedPersonId].slice(-5);
    });
  }, [focusedPersonId, lens, traceContext.activePerson, traceContext.traceFocusKey]);

  return traceTrailIds;
}

export function useResetFocusedPersonExperience({
  focusedPersonId,
  lens,
  setActivePersonAction,
  setLightboxIndex,
}: {
  focusedPersonId: string;
  lens: HallLens;
  setActivePersonAction: Dispatch<SetStateAction<HallPersonAction>>;
  setLightboxIndex: Dispatch<SetStateAction<number | null>>;
}) {
  useEffect(() => {
    setActivePersonAction('overview');
    setLightboxIndex(null);
    stopHallFocusMedia();
  }, [focusedPersonId, lens, setActivePersonAction, setLightboxIndex]);
}

export function useVisitQrAvailability({
  attractActive,
  savedPeopleCount,
  setVisitQrOpen,
}: {
  attractActive: boolean;
  savedPeopleCount: number;
  setVisitQrOpen: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    if (savedPeopleCount > 0 && !attractActive) return;
    setVisitQrOpen(false);
  }, [attractActive, savedPeopleCount, setVisitQrOpen]);
}

export function useEscapeToCloseFocus({
  activePersonAction,
  focusedPersonId,
  onCloseFocus,
  onReturnToOverview,
}: {
  activePersonAction: HallPersonAction;
  focusedPersonId: string;
  onCloseFocus?: () => void;
  onReturnToOverview: () => void;
}) {
  useEffect(() => {
    if (!focusedPersonId || !onCloseFocus) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (activePersonAction !== 'overview') {
        onReturnToOverview();
        return;
      }
      onCloseFocus?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePersonAction, focusedPersonId, onCloseFocus, onReturnToOverview]);
}

export function stopHallFocusMedia() {
  stopAllMedia();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cihof:stop-media'));
  }
}
