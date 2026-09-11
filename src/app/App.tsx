import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  TouchEvent as ReactTouchEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { installationConfig } from '../config/installationConfig';
import { useInductees } from '../data/useInductees';
import { useRelationships } from '../data/useRelationships';
import { mostConnectedPerson } from '../data/traceModel';
import { AdminDataPanel } from '../features/admin/AdminDataPanel';
import { matchesAdminHotkey, readKioskSettings, subscribeKioskSettings, type KioskSettings } from './kioskSettings';
import { HallSurface } from '../features/hall-surface/HallSurface';
import { ShellCommandSearch } from './ShellCommandSearch';
import { commandSearchResults, type CommandSearchResult } from './commandSearch';
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
const transitionInputGuardMs = installationConfig.transitions.inputGuardMs;
const visitCollectionLimit = 6;

type AppProps = {
  defaultView?: ViewMode;
};

export function App({ defaultView = 'living-hall' }: AppProps) {
  useViewportLock();

  const { inductees, loading, error } = useInductees();
  const { relationships, loading: relationshipsLoading, error: relationshipsError } = useRelationships();
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode(false, defaultView));
  const [hallLens, setHallLens] = useState<HallLens>(() => readHallLens(defaultView));
  const [hallFocus, setHallFocus] = useState<HallFocus>(() => readHallFocus());
  const [commandQuery, setCommandQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [experienceTransition, setExperienceTransition] = useState<ExperienceTransition>('switch');
  const [timelineYear, setTimelineYear] = useState<string>(() => readTimelineYear());
  const [lastSeenId, setLastSeenId] = useState<string>(() => readParam('person'));
  const [visitCollectionIds, setVisitCollectionIds] = useState<string[]>(() => readVisitCollectionIds());
  const [worldFocusKey, setWorldFocusKey] = useState<string>(() => readInitialWorldFocus());
  const [kioskMode, setKioskMode] = useState(() => readParam('kiosk') === '1');
  const [attractActive, setAttractActive] = useState(false);
  const [idleWarningActive, setIdleWarningActive] = useState(false);
  const [transitionLocked, setTransitionLocked] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [adminDataOpen, setAdminDataOpen] = useState(() => readParam('admin') === '1');
  const [kioskSettings, setKioskSettings] = useState(() => readKioskSettings());
  const stageRef = useRef<HTMLElement | null>(null);
  const scrollPositionRef = useRef({ left: 0, top: 0 });
  const adminTapRef = useRef({ count: 0, startedAt: 0 });
  const transitionLockUntilRef = useRef(0);
  const transitionLockTimeoutRef = useRef<number | null>(null);
  const animationFramesRef = useRef<number[]>([]);
  const suppressLegacyFocusClickRef = useRef(false);
  const suppressLegacyFocusClickTimeoutRef = useRef<number | null>(null);
  const legacyFocusDismissPointerRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const reviewModeEnabled = installationConfig.features.staffReview;
  const selectedId = hallFocus?.personId ?? '';
  const activeVisitorMode: VisitorExperienceMode = isVisitorExperienceMode(viewMode) ? viewMode : viewModeForHallLens(hallLens);
  const activeShellMode: ViewMode = reviewModeEnabled ? 'review' : activeVisitorMode;
  const shellStyle = useMemo(() => kioskSettingsStyle(kioskSettings), [kioskSettings]);
  const legacyFocusModalActive = hallLens === 'legacies' && Boolean(selectedId) && !attractActive && !reviewModeEnabled;
  const wallDebugEnabled = installationConfig.debug.enabled && (readParam('wallDebug') === '1' || readParam('debugWall') === '1');
  const kioskToggleVisible = !contentProtectionActive || showKioskToggleInProduction;
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

  function setSelectedId(personId: string) {
    setHallFocus(personId ? { personId } : null);
  }

  useEffect(() => {
    if (loading) return;
    if (selected) return;

    if (viewMode === 'person' && !selectedId && lastSeen) {
      setSelectedId(lastSeen.id);
      return;
    }

    if (!selectedId) return;
    setSelectedId('');
    if (viewMode === 'person') setExperienceMode('living-hall', 'back');
  }, [lastSeen, loading, selected, selectedId, viewMode]);

  useEffect(() => {
    if (loading || inductees.length === 0) return;
    const validIds = new Set(inductees.map((item) => item.id));
    setVisitCollectionIds((current) => normalizeVisitCollectionIds(current.filter((id) => validIds.has(id))));
  }, [inductees, loading]);

  useEffect(() => {
    if (reviewModeEnabled || loading || hallLens !== 'traces' || selectedId) return;
    const defaultTracePerson = lastSeen ?? mostConnectedPerson(inductees, relationships) ?? inductees[0] ?? null;
    if (!defaultTracePerson) return;
    setSelectedId(defaultTracePerson.id);
    setLastSeenId(defaultTracePerson.id);
  }, [hallLens, inductees, lastSeen, loading, relationships, reviewModeEnabled, selectedId]);

  useEffect(() => startKioskHeartbeat(installationConfig.health.heartbeatMs), []);

  useEffect(() => {
    return () => {
      if (transitionLockTimeoutRef.current !== null) window.clearTimeout(transitionLockTimeoutRef.current);
      if (suppressLegacyFocusClickTimeoutRef.current !== null) window.clearTimeout(suppressLegacyFocusClickTimeoutRef.current);
      animationFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
      animationFramesRef.current = [];
    };
  }, []);

  useEffect(() => subscribeKioskSettings(setKioskSettings), []);

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
    function openAdminWithKeyboard(event: KeyboardEvent) {
      if (!matchesAdminHotkey(event, kioskSettings.adminHotkey)) return;
      event.preventDefault();
      recordKioskInteraction('admin-data-hotkey');
      stopActiveMedia();
      setAdminDataOpen(true);
    }

    window.addEventListener('keydown', openAdminWithKeyboard);
    return () => window.removeEventListener('keydown', openAdminWithKeyboard);
  }, [kioskSettings.adminHotkey]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (reviewModeEnabled) {
      params.set('view', 'review');
      params.set('review', '1');
    } else {
      if (hallLens !== 'portraits') params.set('lens', hallLens);
      if (hallLens === 'legacies' && timelineYear) params.set('timeYear', timelineYear);
      if (hallLens === 'traces' && worldFocusKey) {
        params.set('trace', worldFocusKey);
        if (worldFocusKey.startsWith('country:') || worldFocusKey.startsWith('region:')) params.set('world', worldFocusKey);
      }
      if (selectedId) params.set('person', selectedId);
      if (visitCollectionIds.length > 0) params.set('visit', visitCollectionIds.join(','));
    }
    if (kioskMode) params.set('kiosk', '1');
    if (wallDebugEnabled) params.set('wallDebug', '1');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [hallLens, kioskMode, reviewModeEnabled, selectedId, timelineYear, visitCollectionIds, wallDebugEnabled, worldFocusKey]);

  useEffect(() => {
    if (!kioskMode || reviewModeEnabled || adminDataOpen || loading || relationshipsLoading) return;

    const idleTimeoutMs = kioskSettings.idleTimeoutMs;
    const idleWarningMs = Math.min(kioskSettings.idleWarningMs, Math.max(0, idleTimeoutMs - 1_000));
    const warningDelay = Math.max(idleTimeoutMs - idleWarningMs, 0);
    let warningTimeout = window.setTimeout(() => {
      setIdleWarningActive(true);
    }, warningDelay);
    const showAttract = () => {
      setIdleWarningActive(false);
      resetExperience('idle');
      setAttractActive(true);
    };
    let timeout = window.setTimeout(showAttract, idleTimeoutMs);
    const resetTimer = () => {
      if (attractActive) return;
      setIdleWarningActive(false);
      window.clearTimeout(warningTimeout);
      window.clearTimeout(timeout);
      warningTimeout = window.setTimeout(() => {
        setIdleWarningActive(true);
      }, warningDelay);
      timeout = window.setTimeout(showAttract, idleTimeoutMs);
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
  }, [adminDataOpen, attractActive, kioskMode, kioskSettings.idleTimeoutMs, kioskSettings.idleWarningMs, loading, relationshipsLoading, reviewModeEnabled]);

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

  useContentProtection(!reviewModeEnabled && !adminDataOpen);

  const stats = useMemo(() => {
    const withImages = inductees.filter((item) => item.primaryImageUrl).length;
    const withVideo = inductees.filter((item) => item.hasVideo).length;
    return { total: inductees.length, withImages, withVideo };
  }, [inductees]);
  const commandResults = useMemo(() => commandSearchResults(inductees, commandQuery), [commandQuery, inductees]);

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

    const guardMs = prefersReducedMotion(kioskSettings.motion) ? 90 : durationMs;
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

  function selectInductee(inductee: Inductee, source = 'select-person') {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction(source);
    stopActiveMedia();
    onPhysicalPortraitSelected(inductee.id, physicalPortraitSelectionFromInductee(inductee));
    setAttractActive(false);
    setIdleWarningActive(false);
    scrollPositionRef.current = readStageScrollPosition();
    setLastSeenId(inductee.id);
    setSelectedId(inductee.id);
    if (hallLens === 'legacies' && inductee.classYear) setTimelineYear(String(inductee.classYear));
    if (!reviewModeEnabled) setExperienceMode(viewModeForHallLens(hallLens), 'switch');
  }

  function updateCommandQuery(query: string) {
    setCommandQuery(query);
    setCommandOpen(query.trim().length > 0);
  }

  function submitCommandSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstMatch = commandResults[0];
    if (!firstMatch) {
      setCommandOpen(commandQuery.trim().length > 0);
      return;
    }
    selectFromCommand(firstMatch);
  }

  function selectFromCommand(result: CommandSearchResult) {
    if (!beginInteractionTransition()) return;
    const nextLens = result.lens;
    recordKioskInteraction(`command-search:${result.kind}`);
    stopActiveMedia();
    setAttractActive(false);
    setIdleWarningActive(false);
    scrollPositionRef.current = readStageScrollPosition();

    if (result.person) {
      onPhysicalPortraitSelected(result.person.id, physicalPortraitSelectionFromInductee(result.person));
      setLastSeenId(result.person.id);
      setSelectedId(result.person.id);
    } else {
      setSelectedId('');
    }

    setWorldFocusKey(nextLens === 'traces' ? result.traceFocusKey ?? '' : '');
    setTimelineYear(nextLens === 'legacies' ? result.timelineYear ?? '' : '');
    setHallLens(nextLens);
    setExperienceMode('living-hall', hallLensTransitionFor(hallLens, nextLens));
    scheduleAnimationFrame(() => resetStageScroll());
    setCommandQuery('');
    setCommandOpen(false);
  }

  function resetExperience(reason = 'manual') {
    if (reason !== 'idle' && !beginInteractionTransition()) return;
    recordKioskReset(reason);
    stopActiveMedia();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setTimelineYear('');
    setSelectedId('');
    setLastSeenId('');
    setVisitCollectionIds([]);
    setHallLens('portraits');
    setExperienceMode('living-hall', 'reset');
    setAttractActive(false);
    setIdleWarningActive(false);
    setWorldFocusKey('');
    resetStageScroll();
  }

  function closeHallFocus() {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction('close-portrait-focus');
    stopActiveMedia();
    setSelectedId('');
    setIdleWarningActive(false);
    if (!reviewModeEnabled) setExperienceMode('living-hall', 'back');
    scheduleAnimationFrame(() => scrollStageTo(scrollPositionRef.current));
  }

  function dismissLegacyFocusOutside() {
    if (!legacyFocusModalActive) return;
    recordKioskInteraction('close-legacy-focus-outside');
    stopActiveMedia();
    setSelectedId('');
    setIdleWarningActive(false);
    if (!reviewModeEnabled) setExperienceMode('living-hall', 'back');
    scheduleAnimationFrame(() => scrollStageTo(scrollPositionRef.current));
  }

  function isInsideLegacyFocusTarget(target: EventTarget | null) {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    return Boolean(element?.closest('.living-hall__focusCard, .museum-command'));
  }

  function clearLegacyFocusClickSuppression() {
    suppressLegacyFocusClickRef.current = false;
    legacyFocusDismissPointerRef.current = null;
    if (suppressLegacyFocusClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressLegacyFocusClickTimeoutRef.current);
      suppressLegacyFocusClickTimeoutRef.current = null;
    }
  }

  function suppressNextLegacyFocusClick(event: ReactPointerEvent<HTMLElement>) {
    suppressLegacyFocusClickRef.current = true;
    legacyFocusDismissPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (suppressLegacyFocusClickTimeoutRef.current !== null) window.clearTimeout(suppressLegacyFocusClickTimeoutRef.current);
    suppressLegacyFocusClickTimeoutRef.current = window.setTimeout(() => {
      clearLegacyFocusClickSuppression();
    }, 800);
  }

  function handleLegacyFocusPointerCapture(event: ReactPointerEvent<HTMLElement>) {
    if (!legacyFocusModalActive) return;
    if (isInsideLegacyFocusTarget(event.target)) return;
    suppressNextLegacyFocusClick(event);
    event.preventDefault();
    event.stopPropagation();
    dismissLegacyFocusOutside();
  }

  function handleLegacyFocusPointerMoveCapture(event: ReactPointerEvent<HTMLElement>) {
    const pending = legacyFocusDismissPointerRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pending.startX;
    const deltaY = event.clientY - pending.startY;
    if (Math.hypot(deltaX, deltaY) < 8) return;
    clearLegacyFocusClickSuppression();
  }

  function handleLegacyFocusClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (suppressLegacyFocusClickRef.current) {
      clearLegacyFocusClickSuppression();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!legacyFocusModalActive) return;
    if (isInsideLegacyFocusTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    dismissLegacyFocusOutside();
  }

  function handleLegacyFocusTouchMoveCapture(event: ReactTouchEvent<HTMLElement>) {
    if (!legacyFocusModalActive) return;
    if (isInsideLegacyFocusTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleLegacyFocusWheelCapture(event: ReactWheelEvent<HTMLElement>) {
    if (!legacyFocusModalActive) return;
    if (isInsideLegacyFocusTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function continueExploring() {
    recordKioskInteraction('continue-exploring');
    setIdleWarningActive(false);
    setAttractActive(false);
  }

  function handleAdminBrandTap() {
    const now = window.performance.now();
    const current = adminTapRef.current;
    if (now - current.startedAt > 3_500) {
      current.count = 0;
      current.startedAt = now;
    }
    current.count += 1;
    if (current.count < 5) return;
    current.count = 0;
    current.startedAt = now;
    recordKioskInteraction('admin-data-brand-gesture');
    stopActiveMedia();
    setAdminDataOpen(true);
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

  function addVisitCollectionPerson(personId: string) {
    setVisitCollectionIds((current) => {
      if (current.includes(personId)) return current;
      return normalizeVisitCollectionIds([...current, personId]);
    });
    recordKioskInteraction('visit-collection:add');
  }

  function removeVisitCollectionPerson(personId: string) {
    setVisitCollectionIds((current) => current.filter((id) => id !== personId));
    recordKioskInteraction('visit-collection:remove');
  }

  function clearVisitCollection() {
    setVisitCollectionIds([]);
    recordKioskInteraction('visit-collection:clear');
  }

  function changeLens(lens: HallLens) {
    if (!beginInteractionTransition()) return;
    recordKioskInteraction(`nav:${lens}`);
    const transition = hallLensTransitionFor(hallLens, lens);
    stopActiveMedia();
    const referencePerson = selected ?? lastSeen ?? mostConnectedPerson(inductees, relationships);
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
    }
    setHallLens(lens);
    setExperienceMode('living-hall', transition);
    scheduleAnimationFrame(() => resetStageScroll());
  }

  const activeExperienceLabel = isVisitorExperienceMode(activeShellMode)
    ? visitorExperienceNavItems.find((item) => item.lens === hallLens)?.label ?? 'PORTRAITS'
    : 'Staff Portal';

  return (
    <main
      className={shellClassName}
      aria-busy={transitionLocked ? 'true' : undefined}
      data-animation-intensity={kioskSettings.motion}
      data-debug-mode={installationConfig.debug.enabled ? 'true' : 'false'}
      data-legacy-focus-modal={legacyFocusModalActive ? 'true' : 'false'}
      style={shellStyle}
      onClickCapture={handleLegacyFocusClickCapture}
      onPointerDownCapture={handleLegacyFocusPointerCapture}
      onPointerMoveCapture={handleLegacyFocusPointerMoveCapture}
      onTouchMoveCapture={handleLegacyFocusTouchMoveCapture}
      onWheelCapture={handleLegacyFocusWheelCapture}
    >
      <header className="museum-rail" aria-label="Installation identity and controls">
        <div className="museum-brand" onPointerDown={handleAdminBrandTap}>
          <span>CIHOF</span>
          <strong>{activeExperienceLabel}</strong>
        </div>
        <ShellCommandSearch
          open={commandOpen}
          query={commandQuery}
          results={commandResults}
          onOpenChange={setCommandOpen}
          onQueryChange={updateCommandQuery}
          onSelect={selectFromCommand}
          onSubmit={submitCommandSearch}
        />
        <div className="museum-status" aria-label="Collection summary">
          <span>{stats.total} profiles</span>
          <span>{stats.withVideo} media</span>
          {selected && <span className="museum-status__focus">Focus: {selected.name}</span>}
          {visitCollectionIds.length > 0 && <span>{visitCollectionIds.length}/{visitCollectionLimit} saved</span>}
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
        <ExperienceScene mode={activeVisitorMode} transition={experienceTransition}>
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
            settings={kioskSettings}
            timelineYear={timelineYear}
            traceFocusKey={worldFocusKey}
            visitCollectionIds={visitCollectionIds}
            onEngage={continueExploring}
            onSelect={selectInductee}
            onCloseFocus={closeHallFocus}
            onTimelineYearChange={setTimelineYear}
            onTraceFocusChange={changeTraceFocus}
            onAddVisitCollectionPerson={addVisitCollectionPerson}
            onRemoveVisitCollectionPerson={removeVisitCollectionPerson}
            onClearVisitCollection={clearVisitCollection}
          />
        </ExperienceScene>
      </section>

      {!reviewModeEnabled && !attractActive && (
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

      <AdminDataPanel
        open={adminDataOpen}
        settings={kioskSettings}
        onClose={() => setAdminDataOpen(false)}
        onSettingsChange={setKioskSettings}
      />
      {transitionLocked && <div className="transition-input-guard" aria-hidden="true" />}
    </main>
  );
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

function readVisitCollectionIds() {
  const raw = readParam('visit');
  if (!raw) return [];
  return normalizeVisitCollectionIds(raw.split(/[,\s|]+/));
}

function normalizeVisitCollectionIds(ids: string[]) {
  const normalized: string[] = [];
  ids.forEach((candidate) => {
    const id = candidate.trim();
    if (!/^[a-z0-9][a-z0-9-]{1,96}$/i.test(id)) return;
    if (normalized.includes(id)) return;
    normalized.push(id);
  });
  return normalized.slice(0, visitCollectionLimit);
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

function kioskSettingsStyle(settings: KioskSettings) {
  return {
    '--kiosk-screen-scale': settings.screenScale,
    '--kiosk-field-inset': `${settings.fieldInsetVmin}vmin`,
    '--kiosk-label-scale': settings.labelScale,
  } as CSSProperties & Record<string, string | number>;
}

function prefersReducedMotion(animationIntensity = installationConfig.animationIntensity) {
  if (animationIntensity !== 'standard') return true;
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
