import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { FallbackImage, initials } from '../components/FallbackImage';
import { installationConfig } from '../config/installationConfig';
import { useInductees } from '../data/useInductees';
import { useRelationships } from '../data/useRelationships';
import { mostConnectedPerson } from '../data/traceModel';
import { InducteeDetail, type DetailAction } from '../features/inductee-detail/InducteeDetail';
import { ConnectionFinder } from '../features/connections/ConnectionFinder';
import { HallSurface } from '../features/hall-surface/HallSurface';
import { onPhysicalPortraitSelected, physicalPortraitSelectionFromInductee } from '../integrations/physicalPortrait';
import {
  hallLensForViewMode,
  hallLensOrder,
  isVisitorExperienceMode,
  normalizeHallLens,
  normalizeViewMode,
  visitorExperienceNavItems,
  viewModeForHallLens,
  type ExperienceTransition,
  type VisitorExperienceMode,
} from './experienceNavigation';
import { recordKioskHealth, recordKioskInteraction, recordKioskReset, startKioskHeartbeat } from './kioskHealth';
import { stopAllMedia } from './mediaControl';
import { useViewportLock } from './useViewportLock';
import type { HallFocus, HallLens, Inductee, ViewMode } from '../data/types';

const contentProtectionActive = installationConfig.features.kioskGuards;
const showKioskToggleInProduction = installationConfig.debug.showKioskToggleInProduction;
const sharedPortraitDurationMs = installationConfig.transitions.sharedPortraitMs;
const transitionInputGuardMs = installationConfig.transitions.inputGuardMs;

type ReviewDashboardProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

type AppProps = {
  defaultView?: ViewMode;
  ReviewDashboard?: (props: ReviewDashboardProps) => ReactElement;
};

type TransitionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SharedPortraitKind =
  | 'to-person'
  | 'person-to-connections'
  | 'connections-to-person'
  | 'person-to-living-hall'
  | 'person-to-world'
  | 'person-to-time'
  | 'lens-to-person';

type PendingSharedPortrait = {
  person: Inductee;
  from: TransitionRect;
  targetView: ViewMode;
  kind: SharedPortraitKind;
};

type SharedPortraitHandoff = PendingSharedPortrait & {
  key: string;
  to: TransitionRect;
};

export function App({ defaultView = 'living-hall', ReviewDashboard }: AppProps) {
  useViewportLock();

  const staffPortalEnabled = Boolean(ReviewDashboard);
  const { inductees, loading, error } = useInductees();
  const { relationships, loading: relationshipsLoading, error: relationshipsError } = useRelationships();
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode(staffPortalEnabled, defaultView));
  const [hallLens, setHallLens] = useState<HallLens>(() => readHallLens(defaultView));
  const [hallFocus, setHallFocus] = useState<HallFocus>(() => readHallFocus());
  const [experienceTransition, setExperienceTransition] = useState<ExperienceTransition>('switch');
  const [timelineYear, setTimelineYear] = useState<string>(() => readTimelineYear());
  const [lastSeenId, setLastSeenId] = useState<string>(() => readParam('person'));
  const [personInitialAction, setPersonInitialAction] = useState<DetailAction>('overview');
  const [worldFocusKey, setWorldFocusKey] = useState<string>(() => readInitialWorldFocus());
  const [kioskMode, setKioskMode] = useState(() => readParam('kiosk') === '1');
  const [attractActive, setAttractActive] = useState(false);
  const [idleWarningActive, setIdleWarningActive] = useState(false);
  const [connectionSeedId, setConnectionSeedId] = useState(() => readInitialConnectionPersonId());
  const [connectionReturnId, setConnectionReturnId] = useState(() => readInitialConnectionPersonId());
  const [personReturnView, setPersonReturnView] = useState<VisitorExperienceMode>('living-hall');
  const [sharedPortrait, setSharedPortrait] = useState<SharedPortraitHandoff | null>(null);
  const [transitionLocked, setTransitionLocked] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const stageRef = useRef<HTMLElement | null>(null);
  const scrollPositionRef = useRef({ left: 0, top: 0 });
  const pendingSharedPortraitRef = useRef<PendingSharedPortrait | null>(null);
  const transitionLockUntilRef = useRef(0);
  const transitionLockTimeoutRef = useRef<number | null>(null);
  const sharedPortraitTimeoutRef = useRef<number | null>(null);
  const animationFramesRef = useRef<number[]>([]);
  const reviewModeEnabled = staffPortalEnabled && viewMode === 'review';
  const staffConnectionOpen = staffPortalEnabled && viewMode === 'connections';
  const selectedId = hallFocus?.personId ?? '';
  const activeVisitorMode: VisitorExperienceMode = isVisitorExperienceMode(viewMode) ? viewMode : viewModeForHallLens(hallLens);
  const activeShellMode: ViewMode = reviewModeEnabled ? 'review' : activeVisitorMode;
  const wallDebugEnabled = staffPortalEnabled && (installationConfig.debug.enabled || readParam('wallDebug') === '1' || readParam('debugWall') === '1');
  const kioskToggleVisible = staffPortalEnabled || !contentProtectionActive || showKioskToggleInProduction;
  const shellClassName = [
    'app-shell',
    'museum-shell',
    'experience-shell',
    `experience-shell--${activeShellMode}`,
    `hall-shell--lens-${hallLens}`,
    selectedId ? 'hall-shell--focused' : '',
    `experience-shell--transition-${experienceTransition}`,
    kioskMode ? 'app-shell--kiosk' : '',
    wallDebugEnabled ? 'app-shell--wall-debug' : '',
    viewMode === 'review' ? 'museum-shell--staff' : '',
    contentProtectionActive ? 'app-shell--protected' : '',
    sharedPortrait ? 'experience-shell--handoff-active' : '',
    transitionLocked ? 'experience-shell--transition-locked' : '',
  ].filter(Boolean).join(' ');
  const stageClassName = ['museum-stage', 'experience-stage', `museum-stage--${activeShellMode}`, `experience-stage--${activeShellMode}`].join(' ');

  const selected = useMemo(
    () => inductees.find((item) => item.id === selectedId) ?? null,
    [inductees, selectedId],
  );
  const lastSeen = useMemo(
    () => inductees.find((item) => item.id === lastSeenId) ?? null,
    [inductees, lastSeenId],
  );
  const connectionSeed = useMemo(
    () => inductees.find((item) => item.id === connectionSeedId) ?? null,
    [connectionSeedId, inductees],
  );
  const connectionReturn = useMemo(
    () => inductees.find((item) => item.id === connectionReturnId) ?? null,
    [connectionReturnId, inductees],
  );

  function setSelectedId(personId: string) {
    setHallFocus(personId ? { personId } : null);
  }

  useEffect(() => {
    if (loading) return;
    if (selected) return;

    if (viewMode === 'person' && !selectedId && lastSeen) {
      setSelectedId(lastSeen.id);
      setPersonInitialAction('overview');
      return;
    }

    if (!selectedId) return;
    setSelectedId('');
    setPersonInitialAction('overview');
    if (viewMode === 'person') setExperienceMode('living-hall', 'back');
  }, [lastSeen, loading, selected, selectedId, viewMode]);

  useEffect(() => {
    if (reviewModeEnabled || loading || hallLens !== 'traces' || selectedId) return;
    const defaultTracePerson = lastSeen ?? mostConnectedPerson(inductees, relationships) ?? inductees[0] ?? null;
    if (!defaultTracePerson) return;
    setSelectedId(defaultTracePerson.id);
    setLastSeenId(defaultTracePerson.id);
  }, [hallLens, inductees, lastSeen, loading, relationships, reviewModeEnabled, selectedId]);

  const selectedIndex = selected ? inductees.findIndex((item) => item.id === selected.id) : -1;
  const previousInductee = selectedIndex > 0
    ? inductees[selectedIndex - 1]
    : inductees.length > 0
      ? inductees[inductees.length - 1]
      : null;
  const nextInductee = selectedIndex >= 0 && inductees.length > 0 ? inductees[(selectedIndex + 1) % inductees.length] : null;

  useEffect(() => startKioskHeartbeat(installationConfig.health.heartbeatMs), []);

  useEffect(() => {
    return () => {
      if (transitionLockTimeoutRef.current !== null) window.clearTimeout(transitionLockTimeoutRef.current);
      if (sharedPortraitTimeoutRef.current !== null) window.clearTimeout(sharedPortraitTimeoutRef.current);
      animationFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
      animationFramesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const pending = pendingSharedPortraitRef.current;
    if (!pending || pending.targetView !== viewMode) return undefined;

    if (prefersReducedMotion()) {
      pendingSharedPortraitRef.current = null;
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = findTransitionRect(pending.person.id, preferredTransitionRoleForView(viewMode));
      pendingSharedPortraitRef.current = null;
      if (!target) return;

      setSharedPortrait({
        ...pending,
        key: `${pending.kind}-${pending.person.id}-${Date.now()}`,
        to: target,
      });

      if (sharedPortraitTimeoutRef.current !== null) window.clearTimeout(sharedPortraitTimeoutRef.current);
      sharedPortraitTimeoutRef.current = window.setTimeout(() => {
        setSharedPortrait(null);
        sharedPortraitTimeoutRef.current = null;
      }, sharedPortraitDurationMs);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [connectionReturnId, connectionSeedId, selectedId, timelineYear, viewMode, worldFocusKey]);

  useEffect(() => {
    recordKioskHealth({
      currentView: activeShellMode,
      kioskMode,
      attractActive,
      selectedPersonId: selectedId,
      peopleCount: inductees.length,
      relationshipsCount: relationships.length,
      dataStatus: loading || relationshipsLoading ? 'loading' : error || relationshipsError ? 'error' : 'ready',
      dataError: [error, relationshipsError].filter(Boolean).join(' / '),
      networkOnline,
    });
  }, [activeShellMode, attractActive, error, inductees.length, kioskMode, loading, networkOnline, relationships.length, relationshipsError, relationshipsLoading, selectedId]);

  useEffect(() => {
    const recordPointer = () => recordKioskInteraction('pointer');
    const recordKeyboard = () => recordKioskInteraction('keyboard');
    window.addEventListener('pointerdown', recordPointer, { passive: true });
    window.addEventListener('touchstart', recordPointer, { passive: true });
    window.addEventListener('keydown', recordKeyboard);

    return () => {
      window.removeEventListener('pointerdown', recordPointer);
      window.removeEventListener('touchstart', recordPointer);
      window.removeEventListener('keydown', recordKeyboard);
    };
  }, []);

  useEffect(() => {
    function updateNetworkStatus() {
      setNetworkOnline(navigator.onLine);
      recordKioskHealth({
        networkOnline: navigator.onLine,
        lastNetworkChangeAt: new Date().toISOString(),
      });
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (reviewModeEnabled) {
      params.set('view', 'review');
      params.set('review', '1');
    } else if (staffConnectionOpen) {
      params.set('view', 'connections');
      if (connectionSeedId) params.set('person', connectionSeedId);
    } else {
      if (hallLens !== 'portraits') params.set('lens', hallLens);
      if (hallLens === 'legacies' && timelineYear) params.set('timeYear', timelineYear);
      if (hallLens === 'traces' && worldFocusKey) {
        params.set('trace', worldFocusKey);
        if (worldFocusKey.startsWith('country:') || worldFocusKey.startsWith('region:')) params.set('world', worldFocusKey);
      }
      if (selectedId) params.set('person', selectedId);
    }
    if (kioskMode) params.set('kiosk', '1');
    if (wallDebugEnabled) params.set('wallDebug', '1');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [connectionSeedId, hallLens, kioskMode, reviewModeEnabled, selectedId, staffConnectionOpen, timelineYear, wallDebugEnabled, worldFocusKey]);

  useEffect(() => {
    if (!kioskMode || reviewModeEnabled) return;

    const warningDelay = Math.max(installationConfig.idle.timeoutMs - installationConfig.idle.warningMs, 0);
    let warningTimeout = window.setTimeout(() => {
      setIdleWarningActive(true);
    }, warningDelay);
    const showAttract = () => {
      setIdleWarningActive(false);
      resetExperience('idle');
      setAttractActive(true);
    };
    let timeout = window.setTimeout(showAttract, installationConfig.idle.timeoutMs);
    const resetTimer = () => {
      if (attractActive) return;
      setIdleWarningActive(false);
      window.clearTimeout(warningTimeout);
      window.clearTimeout(timeout);
      warningTimeout = window.setTimeout(() => {
        setIdleWarningActive(true);
      }, warningDelay);
      timeout = window.setTimeout(showAttract, installationConfig.idle.timeoutMs);
    };

    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    return () => {
      window.clearTimeout(warningTimeout);
      window.clearTimeout(timeout);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [attractActive, kioskMode, reviewModeEnabled]);

  useEffect(() => {
    if (!attractActive || hallLens !== 'portraits') return undefined;

    function leaveAttract() {
      recordKioskInteraction('attract-touch');
      setIdleWarningActive(false);
      setAttractActive(false);
    }

    window.addEventListener('pointerdown', leaveAttract, { capture: true });
    window.addEventListener('touchstart', leaveAttract, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', leaveAttract, { capture: true });
      window.removeEventListener('touchstart', leaveAttract, { capture: true });
    };
  }, [attractActive, hallLens]);

  useContentProtection(!reviewModeEnabled);

  const stats = useMemo(() => {
    const withImages = inductees.filter((item) => item.primaryImageUrl).length;
    const withVideo = inductees.filter((item) => item.hasVideo).length;
    return { total: inductees.length, withImages, withVideo };
  }, [inductees]);

  function readStageScrollPosition() {
    const stage = stageRef.current;
    return stage ? { left: stage.scrollLeft, top: stage.scrollTop } : { left: window.scrollX, top: window.scrollY };
  }

  function scrollStageTo(position: { left: number; top: number }) {
    const stage = stageRef.current;
    if (stage) {
      stage.scrollTo({ left: position.left, top: position.top, behavior: 'auto' });
    }
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }

  function resetStageScroll() {
    scrollStageTo({ left: 0, top: 0 });
    scheduleAnimationFrame(() => scrollStageTo({ left: 0, top: 0 }));
  }

  function scheduleAnimationFrame(callback: () => void) {
    const frame = window.requestAnimationFrame(() => {
      animationFramesRef.current = animationFramesRef.current.filter((item) => item !== frame);
      callback();
    });
    animationFramesRef.current.push(frame);
    return frame;
  }

  function setExperienceMode(mode: ViewMode, transition: ExperienceTransition) {
    setExperienceTransition(transition);
    setViewMode(mode);
  }

  function beginInteractionTransition(durationMs = transitionInputGuardMs) {
    if (reviewModeEnabled) return true;
    const now = window.performance.now();
    if (transitionLockUntilRef.current > now) return false;

    const guardMs = prefersReducedMotion() ? 90 : durationMs;
    transitionLockUntilRef.current = now + guardMs;
    setTransitionLocked(true);

    if (transitionLockTimeoutRef.current !== null) window.clearTimeout(transitionLockTimeoutRef.current);
    transitionLockTimeoutRef.current = window.setTimeout(() => {
      transitionLockUntilRef.current = 0;
      transitionLockTimeoutRef.current = null;
      setTransitionLocked(false);
    }, guardMs);

    return true;
  }

  function prepareSharedPortraitTransition(person: Inductee | null | undefined, targetView: ViewMode, kind: SharedPortraitKind) {
    if (!person || reviewModeEnabled || prefersReducedMotion()) {
      pendingSharedPortraitRef.current = null;
      return;
    }

    const from = findTransitionRect(person.id);
    if (!from) {
      pendingSharedPortraitRef.current = null;
      return;
    }

    pendingSharedPortraitRef.current = { person, from, targetView, kind };
  }

  function selectInductee(inductee: Inductee, source = 'select-person', initialAction: DetailAction = 'overview') {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction(source);
    stopActiveMedia();
    const focusWithinHall = !reviewModeEnabled && (hallLens === 'portraits' || hallLens === 'traces' || hallLens === 'legacies');
    if (focusWithinHall) {
      onPhysicalPortraitSelected(inductee.id, physicalPortraitSelectionFromInductee(inductee));
      setAttractActive(false);
      setIdleWarningActive(false);
      scrollPositionRef.current = readStageScrollPosition();
      setLastSeenId(inductee.id);
      setSelectedId(inductee.id);
      if (hallLens === 'legacies' && inductee.classYear) setTimelineYear(String(inductee.classYear));
      setPersonInitialAction(initialAction);
      setConnectionSeedId('');
      setConnectionReturnId('');
      setExperienceMode(viewModeForHallLens(hallLens), 'switch');
      return;
    }

    const returnView = isVisitorExperienceMode(viewMode) && viewMode !== 'person' ? viewMode : personReturnView;
    setPersonReturnView(returnView === 'person' ? 'living-hall' : returnView);
    prepareSharedPortraitTransition(
      inductee,
      'person',
      viewMode === 'connections' ? 'connections-to-person' : viewMode === 'living-hall' ? 'to-person' : 'lens-to-person',
    );
    onPhysicalPortraitSelected(inductee.id, physicalPortraitSelectionFromInductee(inductee));
    setAttractActive(false);
    setIdleWarningActive(false);
    scrollPositionRef.current = readStageScrollPosition();
    setLastSeenId(inductee.id);
    setSelectedId(inductee.id);
    setPersonInitialAction(initialAction);
    setConnectionSeedId('');
    setConnectionReturnId('');
    if (reviewModeEnabled) return;
    setExperienceMode('person', 'forward');
  }

  function resetExperience(reason = 'manual') {
    if (reason !== 'idle' && !beginInteractionTransition()) return;
    recordKioskReset(reason);
    stopActiveMedia();
    pendingSharedPortraitRef.current = null;
    setSharedPortrait(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setTimelineYear('');
    setSelectedId('');
    setLastSeenId('');
    setPersonInitialAction('overview');
    setHallLens('portraits');
    setExperienceMode('living-hall', 'reset');
    setAttractActive(false);
    setIdleWarningActive(false);
    setConnectionSeedId('');
    setConnectionReturnId('');
    setWorldFocusKey('');
    resetStageScroll();
  }

  function closeHallFocus() {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction('close-portrait-focus');
    stopActiveMedia();
    setSelectedId('');
    setPersonInitialAction('overview');
    setIdleWarningActive(false);
    setConnectionSeedId('');
    setConnectionReturnId('');
    if (!reviewModeEnabled) setExperienceMode('living-hall', 'back');
    scheduleAnimationFrame(() => scrollStageTo(scrollPositionRef.current));
  }

  function closeDetail() {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction('close-detail');
    stopActiveMedia();
    const returnView = personReturnView === 'person' ? 'living-hall' : personReturnView;
    const returnPerson = selected ?? lastSeen;
    const transitionKind: SharedPortraitKind = returnView === 'connections'
      ? 'person-to-connections'
      : returnView === 'world'
        ? 'person-to-world'
        : returnView === 'time'
          ? 'person-to-time'
          : 'person-to-living-hall';
    prepareSharedPortraitTransition(returnPerson, returnView, transitionKind);
    setSelectedId('');
    setPersonInitialAction('overview');
    setIdleWarningActive(false);
    if (reviewModeEnabled) return;
    if (returnView === 'connections') {
      const returnId = returnPerson?.id || connectionReturnId || lastSeenId;
      setConnectionSeedId(returnId);
      setConnectionReturnId(returnId);
    } else {
      setConnectionSeedId('');
      setConnectionReturnId('');
    }
    setExperienceMode(returnView, 'back');
    scheduleAnimationFrame(() => {
      if (returnView === 'living-hall') {
        scrollStageTo(scrollPositionRef.current);
      } else {
        resetStageScroll();
      }
    });
  }

  function returnHome() {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction('home');
    stopActiveMedia();
    pendingSharedPortraitRef.current = null;
    setSharedPortrait(null);
    setAttractActive(false);
    setIdleWarningActive(false);
    setSelectedId('');
    setPersonInitialAction('overview');
    setConnectionSeedId('');
    setConnectionReturnId('');
    setWorldFocusKey('');
    setTimelineYear('');
    setHallLens('portraits');
    setExperienceMode('living-hall', 'back');
    scheduleAnimationFrame(() => {
      scrollStageTo(scrollPositionRef.current);
    });
  }

  function openConnectionFinder(seed?: Inductee, source = 'open-connection-finder', transition: ExperienceTransition = 'forward', skipGuard = false) {
    if (!skipGuard && !beginInteractionTransition()) return;
    recordKioskInteraction(source);
    stopActiveMedia();
    setAttractActive(false);
    setIdleWarningActive(false);
    const seedId = seed?.id || selectedId || lastSeenId;
    const seedPerson = seed ?? selected ?? lastSeen ?? null;
    if (!reviewModeEnabled) {
      if (seedId) onPhysicalPortraitSelected(seedId, seedPerson ? physicalPortraitSelectionFromInductee(seedPerson) : undefined);
      setSelectedId(seedId);
      setLastSeenId(seedId);
      setConnectionSeedId('');
      setConnectionReturnId('');
      setWorldFocusKey('');
      setHallLens('traces');
      setExperienceMode('living-hall', transition);
      return;
    }
    prepareSharedPortraitTransition(seedPerson, 'connections', 'person-to-connections');
    setConnectionSeedId(seedId);
    setConnectionReturnId(selectedId || seed?.id || lastSeenId);
    setSelectedId('');
    setPersonInitialAction('overview');
    setExperienceMode('connections', transition);
  }

  function closeConnectionFinder() {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction('close-connection-finder');
    if (staffConnectionOpen) {
      const returnPersonId = connectionReturnId || lastSeenId || '';
      setConnectionSeedId('');
      setConnectionReturnId('');
      setSelectedId(returnPersonId);
      setPersonInitialAction('overview');
      setExperienceMode('review', 'back');
      return;
    }
    pendingSharedPortraitRef.current = null;
    setSharedPortrait(null);
    setConnectionSeedId('');
    setConnectionReturnId('');
    setSelectedId('');
    setPersonInitialAction('overview');
    setHallLens('portraits');
    setExperienceMode('living-hall', 'back');
    scheduleAnimationFrame(() => resetStageScroll());
  }

  function selectFromConnection(inductee: Inductee) {
    if (staffConnectionOpen) {
      if (!beginInteractionTransition()) return;
      recordKioskInteraction('select-connection-person');
      stopActiveMedia();
      setConnectionSeedId('');
      setConnectionReturnId('');
      setLastSeenId(inductee.id);
      setSelectedId(inductee.id);
      setPersonInitialAction('overview');
      setExperienceMode('review', 'back');
      return;
    }
    selectInductee(inductee, 'select-connection-person');
  }

  function continueExploring() {
    recordKioskInteraction('continue-exploring');
    setIdleWarningActive(false);
    setAttractActive(false);
  }

  function changeTraceFocus(focusKey: string) {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction(focusKey ? `trace:${focusKey}` : 'trace:direct');
    stopActiveMedia();
    setAttractActive(false);
    setIdleWarningActive(false);
    setWorldFocusKey(focusKey);
    setHallLens('traces');
    setExperienceMode('living-hall', 'switch');
    scheduleAnimationFrame(() => resetStageScroll());
  }

  function changeLens(lens: HallLens) {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction(`nav:${lens}`);
    const transition = hallLensTransitionFor(hallLens, lens);
    stopActiveMedia();
    const referencePerson = selected ?? lastSeen ?? connectionSeed ?? connectionReturn ?? mostConnectedPerson(inductees, relationships);
    pendingSharedPortraitRef.current = null;
    setSharedPortrait(null);
    setAttractActive(false);
    setIdleWarningActive(false);
    if (lens === 'traces') {
      const nextFocusId = selectedId || referencePerson?.id || '';
      setSelectedId(nextFocusId);
      if (nextFocusId) setLastSeenId(nextFocusId);
    } else if (lens === 'portraits') {
      setSelectedId(selectedId || referencePerson?.id || '');
    } else if (lens === 'legacies') {
      if (selectedId) setSelectedId(selectedId);
      if (selected?.classYear) setTimelineYear(String(selected.classYear));
    } else {
      if (referencePerson) setLastSeenId(referencePerson.id);
      setSelectedId('');
    }
    setPersonInitialAction('overview');
    setConnectionSeedId('');
    setConnectionReturnId('');
    setHallLens(lens);
    setExperienceMode('living-hall', transition);
    scheduleAnimationFrame(() => resetStageScroll());
  }

  const activeExperienceLabel = isVisitorExperienceMode(activeShellMode)
    ? staffConnectionOpen
      ? 'Staff Portal'
      : visitorExperienceNavItems.find((item) => item.lens === hallLens)?.label ?? 'PORTRAITS'
    : 'Staff Portal';

  return (
    <main
      className={shellClassName}
      aria-busy={transitionLocked ? 'true' : undefined}
      data-animation-intensity={installationConfig.animationIntensity}
      data-debug-mode={installationConfig.debug.enabled ? 'true' : 'false'}
    >
      <header className="museum-rail" aria-label="Installation identity and controls">
        <div className="museum-brand">
          <span>CIHOF</span>
          <strong>{activeExperienceLabel}</strong>
        </div>
        <div className="museum-status" aria-label="Collection summary">
          <span>{stats.total} people</span>
          <span>{stats.withVideo} videos</span>
          {!networkOnline && <span>Offline</span>}
          {kioskMode && <span>Kiosk</span>}
          {wallDebugEnabled && <span>Wall Debug</span>}
        </div>
        <div className="museum-utilities">
          {kioskToggleVisible && (
            <button
              className={kioskMode ? 'kiosk-button kiosk-button--active' : 'kiosk-button'}
              type="button"
              onClick={() => {
                recordKioskInteraction('toggle-kiosk');
                setKioskMode((value) => !value);
              }}
            >
              Kiosk {kioskMode ? 'On' : 'Off'}
            </button>
          )}
          <button className="home-button" type="button" onClick={() => resetExperience('manual')}>
            Reset
          </button>
        </div>
      </header>

      <section className={stageClassName} ref={stageRef}>
        {!reviewModeEnabled && (
          <ExperienceScene mode={activeVisitorMode} transition={experienceTransition}>
            {staffConnectionOpen ? (
              <ConnectionFinder
                closeLabel="Review"
                inductees={inductees}
                open
                presentation="scene"
                relationships={relationships}
                returnPerson={connectionReturn}
                seedPerson={connectionSeed}
                onClose={closeConnectionFinder}
                onSelectPerson={selectFromConnection}
              />
            ) : (
              <HallSurface
                inductees={inductees}
                relationships={relationships}
                loading={loading}
                error={error}
                lens={hallLens}
                focus={hallFocus}
                attractActive={attractActive}
                kioskMode={kioskMode}
                qrEnabled={installationConfig.features.qrContinuation}
                soundEnabled={installationConfig.features.sound}
                timelineYear={timelineYear}
                traceFocusKey={worldFocusKey}
                onEngage={continueExploring}
                onSelect={selectInductee}
                onCloseFocus={closeHallFocus}
                onTimelineYearChange={setTimelineYear}
                onTraceFocusChange={changeTraceFocus}
              />
            )}
          </ExperienceScene>
        )}

        {reviewModeEnabled && ReviewDashboard && <ReviewDashboard inductees={inductees} onSelect={selectInductee} />}
      </section>

      {!reviewModeEnabled && !staffConnectionOpen && !attractActive && (
        <div className="museum-bottom-nav experience-dock" role="toolbar" aria-label="Ways to explore the Hall of Fame">
          {visitorExperienceNavItems.map((item) => {
            const active = hallLens === item.lens;

            return (
            <button
              aria-label={item.ariaLabel}
              aria-pressed={active}
              className={active ? 'museum-nav-item museum-nav-item--active experience-dock__item' : 'museum-nav-item experience-dock__item'}
              key={item.lens}
              type="button"
              onClick={() => changeLens(item.lens)}
            >
              <span className="experience-dock__label">
                <span>{item.label}</span>
                <small>{item.sublabel}</small>
              </span>
            </button>
            );
          })}
        </div>
      )}

      {kioskMode && idleWarningActive && !attractActive && (
        <section className="idle-warning" aria-label="Idle reset warning" onPointerDown={continueExploring}>
          <div className="idle-warning__panel">
            <p className="museum-kicker">Reset Soon</p>
            <h2>STAY WITH THIS RECORD?</h2>
            <span>Touch anywhere to stay here.</span>
          </div>
        </section>
      )}

      {reviewModeEnabled && (
        <InducteeDetail
          inductee={!attractActive ? selected : null}
          allInductees={inductees}
          relationships={relationships}
          kioskMode={kioskMode}
          qrEnabled={installationConfig.features.qrContinuation}
          soundEnabled={installationConfig.features.sound}
          initialAction={personInitialAction}
          nextInductee={nextInductee}
          previousInductee={previousInductee}
          staffMode={reviewModeEnabled}
          wallDebug={wallDebugEnabled}
          onClose={closeDetail}
          onHome={returnHome}
          onReset={() => resetExperience('detail')}
          onSelect={selectInductee}
          onFindConnection={openConnectionFinder}
        />
      )}
      {transitionLocked && <div className="transition-input-guard" aria-hidden="true" />}
      {sharedPortrait && <SharedPortraitHandoffView handoff={sharedPortrait} />}
    </main>
  );
}

function SharedPortraitHandoffView({ handoff }: { handoff: SharedPortraitHandoff }) {
  return (
    <div
      aria-hidden="true"
      className={`shared-portrait-handoff shared-portrait-handoff--${handoff.kind}`}
      key={handoff.key}
      style={sharedPortraitStyle(handoff)}
    >
      <FallbackImage
        alt=""
        className="shared-portrait-handoff__image"
        fallbackClassName="shared-portrait-handoff__fallback"
        fallbackLabel={initials(handoff.person.name)}
        loading="eager"
        src={handoff.person.primaryImageUrl}
      />
    </div>
  );
}

function sharedPortraitStyle(handoff: SharedPortraitHandoff) {
  return {
    '--handoff-from-x': `${handoff.from.left}px`,
    '--handoff-from-y': `${handoff.from.top}px`,
    '--handoff-from-w': `${handoff.from.width}px`,
    '--handoff-from-h': `${handoff.from.height}px`,
    '--handoff-to-x': `${handoff.to.left}px`,
    '--handoff-to-y': `${handoff.to.top}px`,
    '--handoff-to-w': `${handoff.to.width}px`,
    '--handoff-to-h': `${handoff.to.height}px`,
  } as CSSProperties;
}

function ExperienceScene({
  children,
  mode,
  transition,
}: {
  children: ReactNode;
  mode: VisitorExperienceMode;
  transition: ExperienceTransition;
}) {
  return (
    <div className={`experience-scene experience-scene--${mode} experience-scene--transition-${transition}`}>
      {children}
    </div>
  );
}

function useContentProtection(active: boolean) {
  useEffect(() => {
    if (!contentProtectionActive || !active) return undefined;

    function shouldAllowCopyTarget(target: EventTarget | null) {
      return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    }

    function blockEvent(event: Event) {
      if (shouldAllowCopyTarget(event.target)) return;
      event.preventDefault();
    }

    function blockZoomWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
    }

    function blockShortcut(event: KeyboardEvent) {
      if (shouldAllowCopyTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const blockedModifiedKeys = new Set(['a', 'c', 'p', 's', 'u']);
      const blockedDevToolsKeys = new Set(['c', 'i', 'j']);

      if (event.key === 'F12' || (modifier && blockedModifiedKeys.has(key)) || (modifier && event.shiftKey && blockedDevToolsKeys.has(key))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('dragstart', blockEvent);
    document.addEventListener('selectstart', blockEvent);
    document.addEventListener('gesturestart', blockEvent);
    document.addEventListener('gesturechange', blockEvent);
    document.addEventListener('gestureend', blockEvent);
    document.addEventListener('wheel', blockZoomWheel, { passive: false });
    document.addEventListener('keydown', blockShortcut, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('selectstart', blockEvent);
      document.removeEventListener('gesturestart', blockEvent);
      document.removeEventListener('gesturechange', blockEvent);
      document.removeEventListener('gestureend', blockEvent);
      document.removeEventListener('wheel', blockZoomWheel);
      document.removeEventListener('keydown', blockShortcut, { capture: true });
    };
  }, [active]);
}

function readParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function readViewMode(allowReview: boolean, defaultView: ViewMode): ViewMode {
  const view = readParam('view');
  if (allowReview && defaultView === 'review' && !view) return 'review';
  if (allowReview && view === 'review' && readParam('review') === '1') return 'review';
  if (allowReview && normalizeViewMode(view, false) === 'connections') return 'connections';

  const normalizedView = normalizeViewMode(view, false);
  if (normalizedView) {
    return 'living-hall';
  }
  if (readParam('person')) return viewModeForHallLens(normalizeHallLens(readParam('lens')) ?? 'portraits');
  const lens = normalizeHallLens(readParam('lens'));
  if (lens) return viewModeForHallLens(lens);

  if (defaultView === 'review') return allowReview ? 'review' : 'living-hall';
  return 'living-hall';
}

function readHallLens(defaultView: ViewMode): HallLens {
  const explicitLens = normalizeHallLens(readParam('lens'));
  if (explicitLens) return explicitLens;

  const normalizedView = normalizeViewMode(readParam('view'), false);
  if (normalizedView) return hallLensForViewMode(normalizedView);

  return hallLensForViewMode(defaultView);
}

function readHallFocus(): HallFocus {
  const personId = readParam('person');
  return personId ? { personId } : null;
}

function hallLensTransitionFor(current: HallLens, next: HallLens): ExperienceTransition {
  if (current === next) return 'switch';
  const currentIndex = hallLensOrder.indexOf(current);
  const nextIndex = hallLensOrder.indexOf(next);
  if (currentIndex === -1 || nextIndex === -1) return 'switch';
  return nextIndex > currentIndex ? 'forward' : 'back';
}

function preferredTransitionRoleForView(view: ViewMode) {
  if (view === 'person') return 'person-portrait';
  if (view === 'connections') return 'connections-center';
  if (view === 'world') return 'world-portrait';
  if (view === 'time') return 'time-portrait';
  if (view === 'living-hall') return 'living-portrait';
  return 'portrait';
}

function findTransitionRect(personId: string, preferredRole?: string): TransitionRect | null {
  if (!personId || typeof document === 'undefined') return null;

  const escapedId = escapeCssAttributeValue(personId);
  const selectors = [
    preferredRole ? `[data-transition-person="${escapedId}"][data-transition-role="${preferredRole}"]` : '',
    `[data-transition-person="${escapedId}"][data-transition-role="portrait"]`,
    `[data-transition-person="${escapedId}"]`,
  ].filter(Boolean);

  for (const selector of selectors) {
    const rect = bestVisibleRect(Array.from(document.querySelectorAll<HTMLElement>(selector)));
    if (rect) return rect;
  }

  return null;
}

function bestVisibleRect(elements: HTMLElement[]) {
  let best: TransitionRect | null = null;
  let bestArea = 0;

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (!isVisibleRect(rect)) return;
    const area = rect.width * rect.height;
    if (area <= bestArea) return;
    bestArea = area;
    best = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });

  return best;
}

function isVisibleRect(rect: DOMRect) {
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  return width >= 12
    && height >= 12
    && rect.bottom > 0
    && rect.right > 0
    && rect.left < window.innerWidth
    && rect.top < window.innerHeight;
}

function escapeCssAttributeValue(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

function prefersReducedMotion() {
  if (installationConfig.animationIntensity !== 'standard') return true;
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readTimelineYear() {
  const normalizedView = normalizeViewMode(readParam('view'), false);
  const lens = normalizeHallLens(readParam('lens'));
  if (lens !== 'legacies' && normalizedView !== 'time') return '';
  return readParam('timeYear') || readParam('year');
}

function readInitialConnectionPersonId() {
  const normalizedView = normalizeViewMode(readParam('view'), false);
  return normalizedView === 'connections' ? readParam('person') : '';
}

function readInitialWorldFocus() {
  const normalizedView = normalizeViewMode(readParam('view'), false);
  const lens = normalizeHallLens(readParam('lens'));
  return normalizedView === 'world' || normalizedView === 'connections' || lens === 'traces'
    ? readParam('trace') || readParam('world')
    : '';
}

function stopActiveMedia() {
  stopAllMedia();
}
