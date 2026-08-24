import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { FallbackImage, initials } from '../components/FallbackImage';
import { installationConfig } from '../config/installationConfig';
import { useInductees } from '../data/useInductees';
import { useRelationships } from '../data/useRelationships';
import { ConnectionFinder } from '../features/connections/ConnectionFinder';
import { InducteeDetail, type DetailAction } from '../features/inductee-detail/InducteeDetail';
import { LivingHallView } from '../features/living-hall/LivingHallView';
import { TimelineView } from '../features/timeline/TimelineView';
import { WorldLensView } from '../features/world/WorldLensView';
import { onPhysicalPortraitSelected, physicalPortraitSelectionFromInductee } from '../integrations/physicalPortrait';
import {
  isVisitorExperienceMode,
  normalizeViewMode,
  visitorExperienceNavItems,
  visitorExperienceOrder,
  type ExperienceTransition,
  type VisitorExperienceMode,
} from './experienceNavigation';
import { recordKioskHealth, recordKioskInteraction, recordKioskReset, startKioskHeartbeat } from './kioskHealth';
import { stopAllMedia } from './mediaControl';
import { useViewportLock } from './useViewportLock';
import type { Inductee, ViewMode } from '../data/types';

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
  const [experienceTransition, setExperienceTransition] = useState<ExperienceTransition>('switch');
  const [timelineYear, setTimelineYear] = useState<string>(() => readTimelineYear());
  const [selectedId, setSelectedId] = useState<string>(() => readParam('person'));
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
  const connectionOpen = viewMode === 'connections' && !reviewModeEnabled;
  const wallDebugEnabled = staffPortalEnabled && (installationConfig.debug.enabled || readParam('wallDebug') === '1' || readParam('debugWall') === '1');
  const kioskToggleVisible = staffPortalEnabled || !contentProtectionActive || showKioskToggleInProduction;
  const shellClassName = [
    'app-shell',
    'museum-shell',
    'experience-shell',
    `experience-shell--${viewMode}`,
    `experience-shell--transition-${experienceTransition}`,
    kioskMode ? 'app-shell--kiosk' : '',
    wallDebugEnabled ? 'app-shell--wall-debug' : '',
    viewMode === 'review' ? 'museum-shell--staff' : '',
    contentProtectionActive ? 'app-shell--protected' : '',
    sharedPortrait ? 'experience-shell--handoff-active' : '',
    transitionLocked ? 'experience-shell--transition-locked' : '',
  ].filter(Boolean).join(' ');
  const stageClassName = ['museum-stage', 'experience-stage', `museum-stage--${viewMode}`, `experience-stage--${viewMode}`].join(' ');

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

  useEffect(() => {
    if (viewMode !== 'person' || loading) return;
    if (selected) return;

    if (!selectedId && lastSeen) {
      setSelectedId(lastSeen.id);
      setPersonInitialAction('overview');
      return;
    }

    setSelectedId('');
    setPersonInitialAction('overview');
    setExperienceMode('living-hall', 'back');
  }, [lastSeen, loading, selected, selectedId, viewMode]);

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
      currentView: viewMode,
      kioskMode,
      attractActive,
      selectedPersonId: selectedId,
      peopleCount: inductees.length,
      relationshipsCount: relationships.length,
      dataStatus: loading || relationshipsLoading ? 'loading' : error || relationshipsError ? 'error' : 'ready',
      dataError: [error, relationshipsError].filter(Boolean).join(' / '),
      networkOnline,
    });
  }, [attractActive, error, inductees.length, kioskMode, loading, networkOnline, relationships.length, relationshipsError, relationshipsLoading, selectedId, viewMode]);

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
    if (viewMode !== 'living-hall') params.set('view', viewMode);
    if (viewMode === 'time' && timelineYear) params.set('timeYear', timelineYear);
    if (viewMode === 'world' && worldFocusKey) params.set('world', worldFocusKey);
    if (selectedId) params.set('person', selectedId);
    if (kioskMode) params.set('kiosk', '1');
    if (reviewModeEnabled) {
      params.set('view', 'review');
      params.set('review', '1');
    }
    if (wallDebugEnabled) params.set('wallDebug', '1');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [kioskMode, reviewModeEnabled, selectedId, timelineYear, viewMode, wallDebugEnabled, worldFocusKey]);

  useEffect(() => {
    if (!kioskMode || viewMode === 'review') return;

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
  }, [attractActive, kioskMode, viewMode]);

  useEffect(() => {
    if (!attractActive || viewMode !== 'living-hall') return undefined;

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
  }, [attractActive, viewMode]);

  useContentProtection(viewMode !== 'review');

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

  function openInducteeMedia(inductee: Inductee) {
    selectInductee(inductee, 'open-class-media', 'watch');
  }

  function resetExperience(reason = 'manual') {
    if (reason !== 'idle' && !beginInteractionTransition()) return;
    recordKioskReset(reason);
    stopActiveMedia();
    if (reason !== 'idle') prepareSharedPortraitTransition(selected ?? lastSeen ?? connectionSeed ?? connectionReturn, 'living-hall', 'person-to-living-hall');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setTimelineYear('');
    setSelectedId('');
    setLastSeenId('');
    setPersonInitialAction('overview');
    setExperienceMode('living-hall', 'reset');
    setAttractActive(false);
    setIdleWarningActive(false);
    setConnectionSeedId('');
    setConnectionReturnId('');
    setWorldFocusKey('');
    resetStageScroll();
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
    prepareSharedPortraitTransition(selected ?? lastSeen ?? connectionSeed ?? connectionReturn, 'living-hall', 'person-to-living-hall');
    setAttractActive(false);
    setIdleWarningActive(false);
    setSelectedId('');
    setPersonInitialAction('overview');
    setConnectionSeedId('');
    setConnectionReturnId('');
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
    prepareSharedPortraitTransition(connectionSeed ?? connectionReturn ?? lastSeen, 'living-hall', 'person-to-living-hall');
    setConnectionSeedId('');
    setConnectionReturnId('');
    setSelectedId('');
    setPersonInitialAction('overview');
    setExperienceMode('living-hall', 'back');
    scheduleAnimationFrame(() => resetStageScroll());
  }

  function selectFromConnection(inductee: Inductee) {
    selectInductee(inductee, 'select-connection-person');
  }

  function continueExploring() {
    recordKioskInteraction('continue-exploring');
    setIdleWarningActive(false);
    setAttractActive(false);
  }

  function changeView(mode: VisitorExperienceMode) {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction(`nav:${mode}`);
    const transition = experienceTransitionFor(viewMode, mode);
    if (mode === 'person') {
      const personId = selectedId || lastSeenId;
      const person = inductees.find((item) => item.id === personId);
      if (!person) return;
      stopActiveMedia();
      const returnView = isVisitorExperienceMode(viewMode) && viewMode !== 'person' ? viewMode : 'living-hall';
      setPersonReturnView(returnView);
      prepareSharedPortraitTransition(person, 'person', viewMode === 'connections' ? 'connections-to-person' : 'lens-to-person');
      setAttractActive(false);
      setIdleWarningActive(false);
      setConnectionSeedId('');
      setConnectionReturnId('');
      setSelectedId(person.id);
      setLastSeenId(person.id);
      setPersonInitialAction('overview');
      setExperienceMode('person', transition);
      return;
    }

    if (mode === 'connections') {
      openConnectionFinder(selected ?? lastSeen ?? undefined, 'nav:connections', transition, true);
      return;
    }

    stopActiveMedia();
    const referencePerson = selected ?? lastSeen ?? connectionSeed ?? connectionReturn;
    if (mode === 'living-hall') prepareSharedPortraitTransition(referencePerson, 'living-hall', 'person-to-living-hall');
    if (mode === 'world') prepareSharedPortraitTransition(referencePerson, 'world', 'person-to-world');
    if (mode === 'time') prepareSharedPortraitTransition(referencePerson, 'time', 'person-to-time');
    setAttractActive(false);
    setIdleWarningActive(false);
    setSelectedId('');
    setPersonInitialAction('overview');
    setConnectionSeedId('');
    setConnectionReturnId('');
    setExperienceMode(mode, transition);
    scheduleAnimationFrame(() => resetStageScroll());
  }

  const activeExperienceLabel = isVisitorExperienceMode(viewMode)
    ? viewMode === 'living-hall'
      ? 'Living Hall'
      : visitorExperienceNavItems.find((item) => item.mode === viewMode)?.label ?? 'Living Hall'
    : 'Staff Portal';

  return (
    <main
      className={shellClassName}
      aria-busy={transitionLocked ? 'true' : undefined}
      data-animation-intensity={installationConfig.animationIntensity}
      data-debug-mode={installationConfig.debug.enabled ? 'true' : 'false'}
    >
      <header className="museum-rail" aria-label="Collection status">
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
        {viewMode === 'living-hall' && (
          <ExperienceScene mode="living-hall" transition={experienceTransition}>
            <LivingHallView
              inductees={inductees}
              loading={loading}
              error={error}
              attractActive={attractActive}
              onEngage={continueExploring}
              onSelect={selectInductee}
            />
          </ExperienceScene>
        )}

        {viewMode === 'time' && (
          <ExperienceScene mode="time" transition={experienceTransition}>
            <TimelineView
              inductees={inductees}
              loading={loading}
              error={error}
              selectedYear={timelineYear}
              onYearChange={setTimelineYear}
              onOpenMedia={openInducteeMedia}
              onSelect={selectInductee}
            />
          </ExperienceScene>
        )}

        {viewMode === 'world' && (
          <ExperienceScene mode="world" transition={experienceTransition}>
            <WorldLensView
              inductees={inductees}
              loading={loading}
              error={error}
              activeFocusKey={worldFocusKey}
              onFocusChange={setWorldFocusKey}
              onSelect={selectInductee}
            />
          </ExperienceScene>
        )}

        {reviewModeEnabled && ReviewDashboard && <ReviewDashboard inductees={inductees} onSelect={selectInductee} />}
      </section>

      {viewMode !== 'review' && !attractActive && (
        <div className="museum-bottom-nav experience-dock" role="toolbar" aria-label="Experience lenses">
          {visitorExperienceNavItems.map((item) => {
            const active = viewMode === item.mode;

            return (
            <button
              aria-label={item.ariaLabel}
              aria-pressed={active}
              className={active ? 'museum-nav-item museum-nav-item--active experience-dock__item' : 'museum-nav-item experience-dock__item'}
              key={item.mode}
              type="button"
              onClick={() => changeView(item.mode)}
            >
              <span className={`museum-nav-icon museum-nav-icon--${item.icon} museum-nav-icon--riso`} aria-hidden="true">
                <img
                  alt=""
                  className="museum-nav-icon__image"
                  draggable={false}
                  src={`${import.meta.env.BASE_URL}risograph-icons/${item.risoIcon}.png`}
                />
              </span>
              <span className="experience-dock__label">
                <span>{item.label}</span>
              </span>
            </button>
            );
          })}
        </div>
      )}

      {kioskMode && idleWarningActive && !attractActive && (
        <section className="idle-warning" aria-label="Idle reset warning" onPointerDown={continueExploring}>
          <div className="idle-warning__panel">
            <p className="museum-kicker">Session Reset</p>
            <h2>CONTINUE EXPLORING?</h2>
            <span>Touch anywhere to stay here.</span>
          </div>
        </section>
      )}

      <InducteeDetail
        inductee={(viewMode === 'person' || reviewModeEnabled) && !attractActive ? selected : null}
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

      <ConnectionFinder
        open={connectionOpen}
        inductees={inductees}
        relationships={relationships}
        seedPerson={connectionSeed}
        returnPerson={connectionReturn}
        closeLabel="Living Hall"
        onClose={closeConnectionFinder}
        onSelectPerson={selectFromConnection}
      />
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

  const normalizedView = normalizeViewMode(view, false);
  if (normalizedView) return normalizedView;
  if (readParam('person')) return 'person';

  return defaultView === 'review' && !allowReview ? 'living-hall' : defaultView;
}

function experienceTransitionFor(current: ViewMode, next: VisitorExperienceMode): ExperienceTransition {
  if (!isVisitorExperienceMode(current) || current === next) return 'switch';
  const currentIndex = visitorExperienceOrder.indexOf(current);
  const nextIndex = visitorExperienceOrder.indexOf(next);
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
  const view = readParam('view');
  if (view !== 'time' && view !== 'timeline') return '';
  return readParam('timeYear') || readParam('year');
}

function readInitialConnectionPersonId() {
  const normalizedView = normalizeViewMode(readParam('view'), false);
  return normalizedView === 'connections' ? readParam('person') : '';
}

function readInitialWorldFocus() {
  const normalizedView = normalizeViewMode(readParam('view'), false);
  return normalizedView === 'world' ? readParam('world') : '';
}

function stopActiveMedia() {
  stopAllMedia();
}
