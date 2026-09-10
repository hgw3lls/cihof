import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { ClevelandTraceBackdrop, ClevelandTraceField, type ClevelandTraceRole } from '../../components/ClevelandTrace';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { PortraitFrame } from '../../components/PortraitFrame';
import { QRCodePanel } from '../../components/QRCodePanel';
import { stopAllMedia } from '../../app/mediaControl';
import { defaultKioskSettings, type KioskSettings } from '../../app/kioskSettings';
import { installationConfig } from '../../config/installationConfig';
import { honoredForSummary, inducteeContextLabel } from '../../data/inducteeNarrative';
import { useStoryLenses } from '../../data/storyLenses';
import {
  buildConceptNetwork,
  buildConceptThreads,
  buildGeographyTraceModel,
  buildHumanNetwork,
  buildPlaceNetwork,
  initialTraceThreadCount,
  isPresentationReadyGeography,
  relationshipLineLabel,
  relationshipSupportLabel,
  resolvePlaceTraceFocus,
  selectConceptThreadChoices,
  type ConceptThread,
  type GeographyTraceModel,
  type NetworkThread,
  type PlaceTraceFocus,
} from '../../data/traceModel';
import { useCityQuestion } from '../../data/useCityQuestion';
import { useMediaManifest, useMediaRecordMap } from '../../data/useMediaManifest';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import type { HallLens, Inductee, RelationshipProvenance, RelationshipRecord, RelationshipType, RuntimeMediaRecord, StorySectionRecord } from '../../data/types';
import { MediaExperience } from '../inductee-detail/MediaExperience';
import { StoryMode } from '../inductee-detail/StoryMode';
import { buildPersonGallery, canonicalContinuationUrl, mediaAvailability } from '../inductee-detail/personDetailModel';
import { CityQuestionPrompt, CityQuestionResults } from './CityQuestion';
import {
  actionPanelPlacement,
  clamp,
  fallbackPosition,
  focusCardPlacement,
  foregroundLabelRects,
  groupAnchors,
  hallLabelCollisionRects,
  hallLayoutStyle,
  hashNumber,
  labelOverlapsForeground,
  labelStyle,
  legacyLabelPriority,
  portraitCategoryForLens,
  portraitFrameAspect,
  portraitFrameState,
  portraitLensBadge,
  portraitSize,
  portraitStyle,
  readHallLayoutViewport,
  shouldRenderHallLabel,
  shouldShowFrameRecord,
  solveHallLayout,
  staggerDelay,
  wobble,
  type FocusActionPlacement,
  type FocusCardPlacement,
  type HallLabel,
  type HallLayoutMetrics,
  type HallLayoutViewport,
  type HallPersonAction,
  type PortraitPosition,
} from './livingHallLayout';

type LivingHallViewProps = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
  attractActive?: boolean;
  kioskMode?: boolean;
  qrEnabled?: boolean;
  soundEnabled?: boolean;
  settings?: KioskSettings;
  lens?: HallLens;
  focusedPersonId?: string;
  relationships?: RelationshipRecord[];
  timelineYear?: string;
  traceFocusKey?: string;
  visitCollectionIds?: string[];
  onEngage?: () => void;
  onCloseFocus?: () => void;
  onTimelineYearChange?: (year: string) => void;
  onTraceFocusChange?: (focusKey: string) => void;
  onSelect: (inductee: Inductee) => void;
  onAddVisitCollectionPerson?: (personId: string) => void;
  onRemoveVisitCollectionPerson?: (personId: string) => void;
  onClearVisitCollection?: () => void;
};

type HallMode = {
  id: string;
  title: string;
  subtitle: string;
  positions: Map<string, PortraitPosition>;
  labels: HallLabel[];
  lines?: HallLine[];
};

type HallLine = {
  id: string;
  label: string;
  detail?: string;
  provenance: RelationshipProvenance;
  relationshipType?: RelationshipType;
  role?: ClevelandTraceRole;
  motifId?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type TraceContext = {
  activePerson: Inductee | null;
  mode: 'direct' | 'concept' | 'place';
  traceFocusKey: string;
  visibleThreads: NetworkThread[];
  directThreads: NetworkThread[];
  conceptThreads: ConceptThread[];
  conceptChoices: ConceptThread[];
  activeConcept: ConceptThread | null;
  geography: GeographyTraceModel;
  placeFocus: PlaceTraceFocus;
  placeChoices: TraceChoice[];
};

type TraceChoice = {
  key: string;
  label: string;
  detail: string;
  kind: 'direct' | 'concept' | 'place';
};

type LegacyYearGroup = {
  key: string;
  year: number | null;
  label: string;
  people: Inductee[];
  x: number;
  spacing: number;
};

type LegacyChronology = {
  groups: LegacyYearGroup[];
  years: number[];
  firstYear: number | null;
  lastYear: number | null;
  fieldScale: number;
};

type LegacyDragState = {
  pointerId: number;
  startX: number;
  startPan: number;
  moved: boolean;
};

type LegacyJumpTarget = -1 | 1 | 'first' | 'last' | number;

type LatestClass = {
  year: number;
  inductees: Inductee[];
  stats: {
    people: number;
    stories: number;
    cities: number;
  };
};

type LatestClassFrame =
  | { kind: 'intro'; key: string }
  | { kind: 'person'; key: string; inductee: Inductee; index: number }
  | { kind: 'group'; key: string }
  | { kind: 'finale'; key: string };

const explicitSources = new Set(['curated', 'documented']);
const visitCollectionLimit = 6;

export function LivingHallView({
  inductees,
  loading,
  error,
  attractActive = false,
  kioskMode = false,
  qrEnabled = true,
  soundEnabled = true,
  settings = defaultKioskSettings,
  lens = 'portraits',
  focusedPersonId = '',
  relationships = [],
  timelineYear = '',
  traceFocusKey = '',
  visitCollectionIds = [],
  onEngage,
  onCloseFocus,
  onTimelineYearChange,
  onTraceFocusChange,
  onSelect,
  onAddVisitCollectionPerson,
  onRemoveVisitCollectionPerson,
  onClearVisitCollection,
}: LivingHallViewProps) {
  const [step, setStep] = useState(0);
  const [latestClassFrame, setLatestClassFrame] = useState<LatestClassFrame | null>(null);
  const [cityResultsActive, setCityResultsActive] = useState(false);
  const [activePersonAction, setActivePersonAction] = useState<HallPersonAction>('overview');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [legacyPan, setLegacyPan] = useState(0);
  const [legacyDragging, setLegacyDragging] = useState(false);
  const [traceChooserOpen, setTraceChooserOpen] = useState(false);
  const [traceTrailIds, setTraceTrailIds] = useState<string[]>([]);
  const [visitQrOpen, setVisitQrOpen] = useState(false);
  const [layoutViewport, setLayoutViewport] = useState<HallLayoutViewport>(() => readHallLayoutViewport());
  const legacyFieldRef = useRef<HTMLDivElement | null>(null);
  const legacyDragRef = useRef<LegacyDragState | null>(null);
  const legacySuppressTapUntilRef = useRef(0);
  const traceTrailKeyRef = useRef('');
  const reducedMotion = useReducedMotion(settings.motion);
  const cityQuestion = useCityQuestion();
  const storyLensState = useStoryLenses();
  const { records: storySectionRecords } = useStorySections();
  const storySectionMap = useStorySectionMap(storySectionRecords);
  const { records: mediaRecords } = useMediaManifest();
  const mediaRecordMap = useMediaRecordMap(mediaRecords);
  const allPeople = useMemo(() => sortInductees(inductees), [inductees]);
  const peopleById = useMemo(() => new Map(allPeople.map((person) => [person.id, person])), [allPeople]);
  const visitCollectionPeople = useMemo(
    () => visitCollectionIds.map((id) => peopleById.get(id)).filter((person): person is Inductee => Boolean(person)),
    [peopleById, visitCollectionIds],
  );
  const people = useMemo(
    () => selectHallPeople(allPeople, lens, focusedPersonId, settings.portraitLimit),
    [allPeople, focusedPersonId, lens, settings.portraitLimit],
  );
  const focusedPerson = useMemo(
    () => focusedPersonId ? people.find((person) => person.id === focusedPersonId) ?? null : null,
    [focusedPersonId, people],
  );
  const hallLayout = useMemo(
    () => solveHallLayout({
      focused: Boolean(focusedPersonId),
      inductees: people,
      lens,
      settings,
      viewport: layoutViewport,
    }),
    [focusedPersonId, lens, layoutViewport, people, settings],
  );
  const modes = useMemo(() => buildHallModes(people, hallLayout), [hallLayout, people]);
  const legacyChronology = useMemo(() => buildLegacyChronology(people, hallLayout), [hallLayout, people]);
  const activeLegacyYear = useMemo(
    () => resolveLegacyActiveYear(legacyChronology, timelineYear, focusedPerson),
    [focusedPerson, legacyChronology, timelineYear],
  );
  const activeLegacyGroup = useMemo(
    () => legacyGroupForYear(legacyChronology, activeLegacyYear),
    [activeLegacyYear, legacyChronology],
  );
  const traceContext = useMemo(
    () => buildTraceContext({
      focusedPersonId,
      inductees: people,
      relationships,
      storyLenses: storyLensState.lenses,
      traceFocusKey,
    }),
    [focusedPersonId, people, relationships, storyLensState.lenses, traceFocusKey],
  );
  const latestClass = useMemo(() => buildLatestClass(people), [people]);
  const hallYears = useMemo(() => buildHallYearRange(people), [people]);
  const hallVocabulary = useMemo(() => buildHallVocabulary(people), [people]);
  const activeMode = useMemo(
    () => selectHallMode({
      focusedPersonId,
      lens,
      modes,
      people,
      relationships,
      step,
      timelineYear,
      traceTrailIds,
      traceContext,
      legacyChronology,
      activeLegacyYear,
      layout: hallLayout,
    }),
    [activeLegacyYear, focusedPersonId, hallLayout, legacyChronology, lens, modes, people, relationships, step, timelineYear, traceContext, traceTrailIds],
  );
  const focusedPosition = focusedPerson ? activeMode.positions.get(focusedPerson.id) ?? null : null;
  const focusedMediaRecord = focusedPerson ? mediaRecordMap.get(focusedPerson.id) : undefined;
  const focusedFrameAspect = portraitFrameAspect(focusedMediaRecord);
  const focusedGallery = useMemo(
    () => focusedPerson ? buildPersonGallery(focusedPerson, focusedMediaRecord) : [],
    [focusedMediaRecord, focusedPerson],
  );
  const focusedStoryRecord = focusedPerson ? storySectionMap.get(focusedPerson.id) : undefined;
  const focusedWatchAvailability = focusedPerson ? mediaAvailability(focusedPerson, focusedMediaRecord, kioskMode) : null;
  const focusedContinuationUrl = focusedPerson && qrEnabled ? canonicalContinuationUrl(focusedPerson) : '';
  const focusedVisitSaved = focusedPerson ? visitCollectionIds.includes(focusedPerson.id) : false;
  const visitSessionUrl = useMemo(
    () => buildVisitSessionUrl({
      focusedPersonId,
      lens,
      savedPeople: visitCollectionPeople,
      timelineYear,
      traceFocusKey,
    }),
    [focusedPersonId, lens, timelineYear, traceFocusKey, visitCollectionPeople],
  );
  const focusedFullTextAvailable = focusedPerson ? Boolean(fullBiographyText(focusedPerson)) : false;
  const activeLightboxUrl = lightboxIndex === null ? '' : focusedGallery[lightboxIndex] ?? '';
  const focusContentWindowOpen = Boolean(focusedPerson) && !attractActive;
  const legacyFocusModalOpen = lens === 'legacies' && focusContentWindowOpen;
  const cityQuestionTotal = useMemo(() => {
    return cityQuestion.config.options.reduce((total, option) => total + (cityQuestion.counts[option.id] ?? 0), 0);
  }, [cityQuestion.config.options, cityQuestion.counts]);
  const {
    enabled: cityAttractEnabled,
    holdMs: cityAttractHoldMs,
    initialDelayMs: cityAttractInitialDelayMs,
    loopPauseMs: cityAttractLoopPauseMs,
  } = cityQuestion.config.attract;

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

  useEffect(() => {
    if (settings.motion === 'none') return undefined;
    if (focusedPersonId) return undefined;
    if (modes.length <= 1) return undefined;
    const interval = window.setInterval(() => {
      setStep((value) => value + 1);
    }, settings.attractRegroupMs);

    return () => window.clearInterval(interval);
  }, [focusedPersonId, modes.length, settings.attractRegroupMs, settings.motion]);

  useEffect(() => {
    if (modes.length > 0 && step >= modes.length) setStep(0);
  }, [modes.length, step]);

  useEffect(() => {
    if (!installationConfig.attractLoop.latestClass.enabled || !attractActive || !latestClass || latestClass.inductees.length === 0) {
      setLatestClassFrame(null);
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
        setLatestClassFrame({ kind: 'group', key: `latest-${latestClass.year}-group` });
        schedule(() => {
          setLatestClassFrame({ kind: 'finale', key: `latest-${latestClass.year}-finale` });
        }, installationConfig.attractLoop.latestClass.groupMs);
        schedule(() => {
          setLatestClassFrame(null);
          setStep(0);
          schedule(runSequence, installationConfig.attractLoop.latestClass.loopPauseMs);
        }, installationConfig.attractLoop.latestClass.groupMs + installationConfig.attractLoop.latestClass.finaleMs);
        return;
      }

      setLatestClassFrame({ kind: 'intro', key: `latest-${latestClass.year}-intro` });
      latestClass.inductees.forEach((inductee, index) => {
        schedule(() => {
          setLatestClassFrame({ kind: 'person', key: `latest-${latestClass.year}-${inductee.id}`, inductee, index });
        }, installationConfig.attractLoop.latestClass.introMs + index * installationConfig.attractLoop.latestClass.portraitMs);
      });

      const groupAt = installationConfig.attractLoop.latestClass.introMs + latestClass.inductees.length * installationConfig.attractLoop.latestClass.portraitMs;
      const finaleAt = groupAt + installationConfig.attractLoop.latestClass.groupMs;
      const completeAt = finaleAt + installationConfig.attractLoop.latestClass.finaleMs;
      schedule(() => {
        setLatestClassFrame({ kind: 'group', key: `latest-${latestClass.year}-group` });
      }, groupAt);
      schedule(() => {
        setLatestClassFrame({ kind: 'finale', key: `latest-${latestClass.year}-finale` });
      }, finaleAt);
      schedule(() => {
        setLatestClassFrame(null);
        setStep(0);
        schedule(runSequence, installationConfig.attractLoop.latestClass.loopPauseMs);
      }, completeAt);
    };

    schedule(runSequence, installationConfig.attractLoop.latestClass.initialDelayMs);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      setLatestClassFrame(null);
    };
  }, [attractActive, latestClass, reducedMotion]);

  useEffect(() => {
    if (!attractActive || latestClassFrame || !cityQuestion.enabled || !cityAttractEnabled) {
      setCityResultsActive(false);
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
      setCityResultsActive(true);
      schedule(() => {
        setCityResultsActive(false);
        schedule(runResults, cityAttractLoopPauseMs);
      }, cityAttractHoldMs);
    };

    schedule(runResults, cityAttractInitialDelayMs);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      setCityResultsActive(false);
    };
  }, [
    attractActive,
    cityAttractEnabled,
    cityAttractHoldMs,
    cityAttractInitialDelayMs,
    cityAttractLoopPauseMs,
    cityQuestion.enabled,
    latestClassFrame,
  ]);

  useEffect(() => {
    setActivePersonAction('overview');
    setLightboxIndex(null);
    setTraceChooserOpen(false);
    stopHallFocusMedia();
  }, [focusedPersonId, lens]);

  useEffect(() => {
    if (!traceChooserOpen) return undefined;
    const timeout = window.setTimeout(() => setTraceChooserOpen(false), 7_000);
    return () => window.clearTimeout(timeout);
  }, [traceChooserOpen]);

  useEffect(() => {
    if (visitCollectionPeople.length > 0 && !attractActive) return;
    setVisitQrOpen(false);
  }, [attractActive, visitCollectionPeople.length]);

  useEffect(() => {
    if (lens !== 'traces') {
      traceTrailKeyRef.current = '';
      setTraceTrailIds([]);
      return;
    }

    if (!focusedPersonId || !traceContext.activePerson) return;

    const traceTrailKey = traceContext.traceFocusKey || 'direct';
    setTraceTrailIds((current) => {
      const sameTrace = traceTrailKeyRef.current === traceTrailKey;
      traceTrailKeyRef.current = traceTrailKey;
      const base = sameTrace ? current : [];
      if (base[base.length - 1] === focusedPersonId) return base;
      return [...base, focusedPersonId].slice(-5);
    });
  }, [focusedPersonId, lens, traceContext.activePerson, traceContext.traceFocusKey]);

  useEffect(() => {
    if (!focusedPersonId || !onCloseFocus) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (activePersonAction !== 'overview') {
        setHallPersonAction('overview');
        return;
      }
      onCloseFocus?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePersonAction, focusedPersonId, onCloseFocus]);

  useEffect(() => {
    if (lens !== 'legacies') {
      setLegacyDragging(false);
      legacyDragRef.current = null;
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      panLegacyToYear(activeLegacyYear);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeLegacyYear, legacyChronology.fieldScale, lens]);

  useEffect(() => {
    if (lens !== 'legacies') return undefined;

    function onResize() {
      setLegacyPan((value) => clamp(value, 0, legacyMaxPan()));
    }

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [lens]);

  function legacyMaxPan() {
    const field = legacyFieldRef.current;
    const viewport = field?.parentElement;
    if (!field || !viewport) return 0;
    return Math.max(0, field.offsetWidth - viewport.clientWidth);
  }

  function legacyVisibleWidth() {
    return legacyFieldRef.current?.parentElement?.clientWidth ?? legacyFieldRef.current?.clientWidth ?? 0;
  }

  function legacyFieldWidth() {
    return legacyFieldRef.current?.offsetWidth ?? 0;
  }

  function panLegacyToYear(year: number | null) {
    const fieldWidth = legacyFieldWidth();
    const visibleWidth = legacyVisibleWidth();
    if (!fieldWidth || !visibleWidth) {
      setLegacyPan(0);
      return;
    }

    const group = legacyGroupForYear(legacyChronology, year) ?? legacyChronology.groups[0];
    if (!group) {
      setLegacyPan(0);
      return;
    }

    const targetCenter = (group.x / 100) * fieldWidth;
    setLegacyPan(clamp(targetCenter - visibleWidth * 0.5, 0, legacyMaxPan()));
  }

  function nearestLegacyYearForPan(pan: number) {
    const fieldWidth = legacyFieldWidth();
    const visibleWidth = legacyVisibleWidth();
    if (!fieldWidth || legacyChronology.groups.length === 0) return null;
    const centerPercent = ((pan + visibleWidth * 0.5) / fieldWidth) * 100;
    const nearest = legacyChronology.groups
      .filter((group) => group.year !== null)
      .sort((a, b) => Math.abs(a.x - centerPercent) - Math.abs(b.x - centerPercent))[0];
    return nearest?.year ?? null;
  }

  function commitLegacyPan(pan: number) {
    const year = nearestLegacyYearForPan(pan);
    if (year !== null && timelineYear !== String(year)) onTimelineYearChange?.(String(year));
  }

  function changeLegacyClass(direction: LegacyJumpTarget) {
    if (legacyChronology.years.length === 0) return;
    const currentIndex = Math.max(legacyChronology.years.indexOf(activeLegacyYear ?? legacyChronology.years[0]), 0);
    const nextIndex = typeof direction === 'number' && ![-1, 1].includes(direction)
      ? legacyChronology.years.indexOf(direction)
      : direction === 'first'
      ? 0
      : direction === 'last'
        ? legacyChronology.years.length - 1
        : clamp(currentIndex + direction, 0, legacyChronology.years.length - 1);
    const nextYear = legacyChronology.years[nextIndex];
    if (!nextYear) return;
    onTimelineYearChange?.(String(nextYear));
    panLegacyToYear(nextYear);
  }

  function beginLegacyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (lens !== 'legacies') return;
    if (legacyFocusModalOpen) {
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (eventTargetInsideFocusCard(event.target)) return;
    legacyDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPan: legacyPan,
      moved: false,
    };
    setLegacyDragging(true);
  }

  function moveLegacyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (legacyFocusModalOpen) {
      if (legacyDragRef.current?.pointerId === event.pointerId) {
        legacyDragRef.current = null;
        setLegacyDragging(false);
      }
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const drag = legacyDragRef.current;
    if (lens !== 'legacies' || !drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 3 && !drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (!drag.moved) return;
    const nextPan = clamp(drag.startPan - deltaX, 0, legacyMaxPan());
    setLegacyPan(nextPan);
    event.preventDefault();
  }

  function endLegacyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (legacyFocusModalOpen) {
      if (legacyDragRef.current?.pointerId === event.pointerId) {
        legacyDragRef.current = null;
        setLegacyDragging(false);
      }
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const drag = legacyDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    legacyDragRef.current = null;
    setLegacyDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    legacySuppressTapUntilRef.current = window.performance.now() + 520;
    commitLegacyPan(clamp(drag.startPan - (event.clientX - drag.startX), 0, legacyMaxPan()));
    event.preventDefault();
    event.stopPropagation();
  }

  function cancelLegacyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (legacyDragRef.current?.pointerId === event.pointerId) {
      legacyDragRef.current = null;
      setLegacyDragging(false);
    }
  }

  function wheelLegacy(event: ReactWheelEvent<HTMLDivElement>) {
    if (lens !== 'legacies') return;
    if (legacyFocusModalOpen) {
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    setLegacyPan((value) => clamp(value + delta, 0, legacyMaxPan()));
  }

  function dismissFocusedContentWindow() {
    onEngage?.();
    if (activePersonAction !== 'overview') {
      setHallPersonAction('overview');
      return;
    }
    onCloseFocus?.();
  }

  function suppressPortraitSelection(event: ReactMouseEvent<HTMLButtonElement>) {
    if (focusContentWindowOpen && !eventTargetInsideContentWindow(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      dismissFocusedContentWindow();
      return true;
    }

    if (lens !== 'legacies') return false;
    const suppressed = window.performance.now() < legacySuppressTapUntilRef.current;
    if (suppressed) {
      event.preventDefault();
      event.stopPropagation();
    }
    return suppressed;
  }

  function eventTargetInsideFocusCard(target: EventTarget | null) {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    return Boolean(element?.closest('.living-hall__focusCard'));
  }

  function eventTargetInsideContentWindow(target: EventTarget | null) {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    return Boolean(element?.closest('.living-hall__focusCard, .living-hall__personActionPanel'));
  }

  function stopHallFocusMedia() {
    stopAllMedia();
    window.dispatchEvent(new Event('cihof:stop-media'));
  }

  function setHallPersonAction(action: HallPersonAction) {
    if (action === 'continue' && !focusedContinuationUrl) return;
    if (action === 'watch' && !focusedWatchAvailability?.playable) return;
    if (action === 'text' && !focusedFullTextAvailable) return;
    if (action !== 'watch') stopHallFocusMedia();
    setLightboxIndex(null);
    setActivePersonAction(action);
  }

  function openTraceChooser() {
    if (lens === 'traces' && traceContext.activePerson) {
      onEngage?.();
      setTraceChooserOpen(true);
      return;
    }
    onTraceFocusChange?.('');
  }

  function chooseTraceFocus(focusKey: string) {
    setTraceChooserOpen(false);
    onTraceFocusChange?.(focusKey);
  }

  function selectPortrait(inductee: Inductee) {
    if (traceChooserOpen) setTraceChooserOpen(false);
    onSelect(inductee);
  }

  function toggleFocusedVisitCollection() {
    if (!focusedPerson || !qrEnabled) return;
    onEngage?.();
    if (visitCollectionIds.includes(focusedPerson.id)) {
      onRemoveVisitCollectionPerson?.(focusedPerson.id);
      if (visitCollectionPeople.length <= 1) setVisitQrOpen(false);
      return;
    }
    onAddVisitCollectionPerson?.(focusedPerson.id);
  }

  const hallClassName = [
    'living-hall',
    attractActive ? 'living-hall--attract' : '',
    focusedPerson ? 'living-hall--focused' : '',
    legacyDragging ? 'living-hall--legacy-dragging' : '',
    latestClassFrame ? 'living-hall--latest-sequence' : '',
    cityResultsActive ? 'living-hall--city-results' : '',
    settings.showTouchCue ? '' : 'living-hall--hide-touch-cue',
    settings.showVocabulary ? '' : 'living-hall--hide-vocabulary',
    settings.showRecordLayer ? '' : 'living-hall--hide-record-layer',
    `living-hall--motion-${settings.motion}`,
  ].filter(Boolean).join(' ');
  const legacyVisibleWidthPx = lens === 'legacies'
    ? legacyVisibleWidth() || hallLayout.viewport.width
    : hallLayout.viewport.width;
  const legacyForegroundContext = lens === 'legacies'
    ? {
      fieldScale: legacyChronology.fieldScale,
      panPx: legacyPan,
      visibleWidthPx: legacyVisibleWidthPx,
    }
    : undefined;
  const legacyFieldStyle = lens === 'legacies'
    ? {
      '--legacy-field-width': `${legacyChronology.fieldScale * 100}%`,
      '--legacy-pan': `${legacyPan}px`,
      '--legacy-visible-width': `${legacyVisibleWidthPx}px`,
    } as CSSProperties & Record<string, string>
    : undefined;
  const focusedCardPlacement = focusedPosition
    ? focusCardPlacement(
      focusedPosition,
      lens,
      hallLayout,
      settings,
      focusedFrameAspect,
      legacyForegroundContext,
    )
    : null;
  const focusedActionPlacement = focusedPosition && activePersonAction !== 'overview'
    ? actionPanelPlacement(focusedPosition, activePersonAction, hallLayout, settings, focusedFrameAspect)
    : null;
  const labelForegroundRects = foregroundLabelRects({
    actionPlacement: focusedActionPlacement,
    cardPlacement: activePersonAction === 'overview' ? focusedCardPlacement : null,
    frameAspect: focusedFrameAspect,
    layout: hallLayout,
    lens,
    legacyContext: legacyForegroundContext,
    position: focusedPosition,
    settings,
  });
  const labelCollisionRects = hallLabelCollisionRects({
    activeMode,
    foregroundRects: labelForegroundRects,
    layout: hallLayout,
    lens,
    legacyContext: legacyForegroundContext,
    mediaRecordMap,
    people,
    settings,
  });
  const tracePanelSide = focusedCardPlacement?.side === 'right' ? 'left' : 'right';
  const hallStyle = hallLayoutStyle(hallLayout, settings);

  return (
    <section
      className={hallClassName}
      aria-label="Cleveland International Hall of Fame portrait field"
      data-latest-class-size={latestClass?.stats.people ?? 0}
      data-latest-class-year={latestClass?.year ?? ''}
      data-city-question-enabled={cityQuestion.enabled ? 'true' : 'false'}
      data-city-question-total={cityQuestionTotal}
      data-hall-mode={activeMode.id}
      data-hall-lens={lens}
      data-layout-tier={hallLayout.tier}
      data-layout-density={hallLayout.densityScore.toFixed(2)}
      data-layout-columns={hallLayout.portrait.columns}
      data-layout-label-every={hallLayout.legacy.labelEvery}
      data-focused-person-id={focusedPersonId}
      data-trace-focus-key={lens === 'traces' ? traceContext.traceFocusKey : ''}
      data-trace-trail-size={lens === 'traces' ? traceTrailIds.length : 0}
      data-legacy-active-year={lens === 'legacies' ? activeLegacyYear ?? '' : ''}
      data-legacy-focus-locked={legacyFocusModalOpen ? 'true' : 'false'}
      data-content-window-open={focusContentWindowOpen ? 'true' : 'false'}
      data-legacy-pan={lens === 'legacies' ? Math.round(legacyPan) : ''}
      data-person-action={focusedPerson ? activePersonAction : ''}
      data-visit-collection-count={visitCollectionPeople.length}
      style={hallStyle}
      onPointerDown={() => onEngage?.()}
    >
      <div className="living-hall__title" aria-live="polite">
        <span className="living-hall__era">{hallYears}</span>
        <h2>{hallDisplayTitle(lens)}</h2>
        <span className="living-hall__mode">
          {loading && 'Gathering portraits'}
          {!loading && error && 'Portrait data could not be loaded'}
          {!loading && !error && `${activeMode.title} / ${activeMode.subtitle}`}
        </span>
      </div>

      <aside className="living-hall__vocabulary" aria-label="Collection themes represented in this grouping">
        {hallVocabulary.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </aside>

      <p className="living-hall__touchCue">
        {lens === 'traces' ? 'TOUCH A TRACE' : lens === 'legacies' ? 'SWIPE THE CLASSES' : 'TOUCH A PORTRAIT'}
      </p>

      {!loading && !error && qrEnabled && visitCollectionPeople.length > 0 && !attractActive && (
        <VisitCollectionTray
          people={visitCollectionPeople}
          qrOpen={visitQrOpen}
          sessionUrl={visitSessionUrl}
          onClear={() => {
            setVisitQrOpen(false);
            onClearVisitCollection?.();
          }}
          onCloseQr={() => setVisitQrOpen(false)}
          onOpenQr={() => setVisitQrOpen(true)}
          onRemove={(personId) => {
            if (visitCollectionPeople.length <= 1) setVisitQrOpen(false);
            onRemoveVisitCollectionPerson?.(personId);
          }}
          onSelect={selectPortrait}
        />
      )}

      {!loading && !error && (
        <LensStatusRail
          activeLegacyGroup={activeLegacyGroup}
          activeLegacyYear={activeLegacyYear}
          activeMode={activeMode}
          allPeopleCount={allPeople.length}
          focusedPerson={focusedPerson}
          latestClass={latestClass}
          legacyChronology={legacyChronology}
          lens={lens}
          people={people}
          traceContext={traceContext}
          traceTrailIds={traceTrailIds}
        />
      )}

      <div className="living-hall__fieldViewport">
        <div
          className="living-hall__field"
          ref={legacyFieldRef}
          style={legacyFieldStyle}
          aria-label={lens === 'legacies' ? 'Horizontal chronology of induction class portrait frames' : 'Interactive inductee portraits'}
          data-legacy-active-year={lens === 'legacies' ? activeLegacyYear ?? '' : ''}
          data-legacy-pan={lens === 'legacies' ? Math.round(legacyPan) : ''}
          onPointerCancelCapture={cancelLegacyDrag}
          onPointerDownCapture={beginLegacyDrag}
          onPointerMoveCapture={moveLegacyDrag}
          onPointerUpCapture={endLegacyDrag}
          onWheelCapture={wheelLegacy}
        >
          {!loading && !error && lens !== 'traces' && (
            <ClevelandTraceBackdrop variant={lens} />
          )}
          {loading && <LivingHallPlaceholders />}
          {!loading && !error && lens === 'traces' && activeMode.lines && activeMode.lines.length > 0 && (
            <ClevelandTraceField className="living-hall__traceLines" lines={activeMode.lines} variant={lens} />
          )}

        {!loading && !error && people.map((inductee, index) => {
          const position = activeMode.positions.get(inductee.id) ?? fallbackPosition(index, people.length);
          const frameState = portraitFrameState(lens, position);
          const frameAspect = portraitFrameAspect(mediaRecordMap.get(inductee.id));
          const style = portraitStyle(position, lens, inductee.id, frameState, frameAspect, settings, hallLayout);
          const lensBadge = portraitLensBadge(lens, position, inductee, activeLegacyYear);
          const portraitCategory = portraitCategoryForLens(lens, position, inductee, activeLegacyYear);
          const className = [
            'living-portrait',
            position.emphasis ? 'living-portrait--emphasis' : '',
            position.focused ? 'living-portrait--focused' : '',
            position.muted ? 'living-portrait--muted' : '',
            inductee.hasVideo ? 'living-portrait--has-media' : '',
            inductee.featured || inductee.featuredCandidate ? 'living-portrait--featured' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              aria-label={`${inductee.name}${inductee.classYear ? `, Class of ${inductee.classYear}` : ''}`}
              className={className}
              data-transition-person={inductee.id}
              data-transition-role={lens === 'legacies' ? 'time-portrait' : 'living-portrait'}
              data-legacy-class-year={lens === 'legacies' ? inductee.classYear ?? '' : undefined}
              data-frame-state={frameState}
              data-frame-aspect={frameAspect}
              data-lens-badge={lensBadge || undefined}
              data-media-available={inductee.hasVideo ? 'true' : 'false'}
              data-portrait-category={portraitCategory}
              key={inductee.id}
              style={style}
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                if (suppressPortraitSelection(event)) return;
                selectPortrait(inductee);
              }}
            >
              <PortraitFrame
                name={inductee.name}
                classYear={inductee.classYear}
                imageUrl={inductee.primaryImageUrl}
                imageAltText={inductee.imageAltText}
                fallbackLabel={initials(inductee.name)}
                state={frameState}
                aspect={frameAspect}
                showRecord={shouldShowFrameRecord(lens, position, hallLayout)}
              />
            </button>
          );
        })}

        {!loading && !error && activeMode.labels.filter((label) => shouldRenderHallLabel(label, lens, hallLayout, activeLegacyYear)).map((label) => {
          const activeLegacyLabel = lens === 'legacies' && activeLegacyYear !== null && label.text === String(activeLegacyYear);
          const labelObscured = labelOverlapsForeground(label, lens, activeLegacyYear, labelCollisionRects, legacyForegroundContext);
          const labelClassName = [
            'living-hall__groupLabel',
            activeLegacyLabel ? 'living-hall__groupLabel--active' : '',
            labelObscured ? 'living-hall__groupLabel--obscured' : '',
          ].filter(Boolean).join(' ');

          return (
            <span
              className={labelClassName}
              data-label-id={label.id}
              data-label-obscured={labelObscured ? 'true' : undefined}
              aria-hidden={labelObscured ? true : undefined}
              key={label.id}
              style={labelStyle(label)}
            >
              <strong>{label.text}</strong>
              {label.detail && <small>{label.detail}</small>}
            </span>
          );
        })}

        {!loading && !error && lens === 'traces' && traceContext.activePerson && (
          <TracePanel
            context={traceContext}
            chooserOpen={traceChooserOpen}
            panelSide={tracePanelSide}
            onOpenChooser={openTraceChooser}
            onTraceFocusChange={chooseTraceFocus}
          />
        )}

        {!loading && !error && focusContentWindowOpen && (
          <button
            type="button"
            aria-label={activePersonAction === 'overview' ? 'Dismiss focused content' : 'Dismiss focused content panel'}
            className="living-hall__contentDismissLayer"
            tabIndex={-1}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dismissFocusedContentWindow();
            }}
          />
        )}

        {!loading && !error && focusedPerson && focusedActionPlacement && activePersonAction !== 'overview' && !attractActive && (
          <PersonFocusActionPanel
            action={activePersonAction}
            allInductees={people}
            continuationUrl={focusedContinuationUrl}
            gallery={focusedGallery}
            inductee={focusedPerson}
            kioskMode={kioskMode}
            mediaRecord={focusedMediaRecord}
            placement={focusedActionPlacement}
            soundEnabled={soundEnabled}
            storyRecord={focusedStoryRecord}
            onClose={() => setHallPersonAction('overview')}
            onOpenImage={setLightboxIndex}
            onSelectPerson={onSelect}
          />
        )}

          {!loading && error && <div className="living-hall__status">Data error: {error}</div>}
        </div>
      </div>

      {!loading && !error && focusedPerson && focusedCardPlacement && !attractActive && (
        <PortraitFocusCard
          activeLegacyGroup={activeLegacyGroup}
          activeLegacyYear={activeLegacyYear}
          inductee={focusedPerson}
          action={activePersonAction}
          continuationAvailable={Boolean(focusedContinuationUrl)}
          fullTextAvailable={focusedFullTextAvailable}
          legacyChronology={legacyChronology}
          lens={lens}
          mediaPlayable={Boolean(focusedWatchAvailability?.playable)}
          placement={focusedCardPlacement}
          traceContext={traceContext}
          visitCollectionEnabled={qrEnabled}
          visitCollectionCount={visitCollectionPeople.length}
          visitCollectionLimit={visitCollectionLimit}
          visitCollectionSaved={focusedVisitSaved}
          onClose={onCloseFocus}
          onFollowTrace={openTraceChooser}
          onLegacyJump={changeLegacyClass}
          onSelectPerson={selectPortrait}
          onSetAction={setHallPersonAction}
          onToggleVisitCollection={toggleFocusedVisitCollection}
        />
      )}

      {activeLightboxUrl && focusedPerson && (
        <div className="lightbox living-hall__lightbox" role="dialog" aria-label={`${focusedPerson.name} image viewer`}>
          <button className="lightbox__scrim" type="button" aria-label="Close image viewer" onClick={() => setLightboxIndex(null)} />
          <div className="lightbox__content">
            <FallbackImage
              alt={`${focusedPerson.imageAltText} Enlarged image.`}
              className="lightbox__image"
              fallbackClassName="lightbox__fallback"
              fallbackLabel={initials(focusedPerson.name)}
              loading="eager"
              src={activeLightboxUrl}
            />
            <div className="lightbox__bar">
              <button type="button" onClick={() => setLightboxIndex((current) => cycleImage(current, focusedGallery.length, -1))}>Previous</button>
              <span>{(lightboxIndex ?? 0) + 1} / {focusedGallery.length}</span>
              <button type="button" onClick={() => setLightboxIndex((current) => cycleImage(current, focusedGallery.length, 1))}>Next</button>
              <button type="button" onClick={() => setLightboxIndex(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && attractActive && latestClass && latestClassFrame && (
        <LatestClassSequence
          frame={latestClassFrame}
          latestClass={latestClass}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      )}

      {!loading && !error && cityQuestion.enabled && lens !== 'legacies' && !attractActive && !focusedPerson && !latestClassFrame && (
        <CityQuestionPrompt
          config={cityQuestion.config}
          counts={cityQuestion.counts}
          onRecordChoice={cityQuestion.recordChoice}
        />
      )}

      {!loading && !error && lens === 'legacies' && !attractActive && (
        <LegacyControls
          activeYear={activeLegacyYear}
          chronology={legacyChronology}
          onJump={changeLegacyClass}
        />
      )}

      {!loading && !error && attractActive && cityQuestion.enabled && cityResultsActive && !latestClassFrame && (
        <CityQuestionResults
          config={cityQuestion.config}
          counts={cityQuestion.counts}
          reducedMotion={reducedMotion}
        />
      )}
    </section>
  );
}

function PortraitFocusCard({
  activeLegacyGroup,
  activeLegacyYear,
  inductee,
  action,
  continuationAvailable,
  fullTextAvailable,
  legacyChronology,
  lens,
  mediaPlayable,
  placement,
  traceContext,
  visitCollectionEnabled,
  visitCollectionCount,
  visitCollectionLimit,
  visitCollectionSaved,
  onClose,
  onFollowTrace,
  onLegacyJump,
  onSelectPerson,
  onSetAction,
  onToggleVisitCollection,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  inductee: Inductee;
  action: HallPersonAction;
  continuationAvailable: boolean;
  fullTextAvailable: boolean;
  legacyChronology: LegacyChronology;
  lens: HallLens;
  mediaPlayable: boolean;
  placement: FocusCardPlacement;
  traceContext: TraceContext;
  visitCollectionEnabled: boolean;
  visitCollectionCount: number;
  visitCollectionLimit: number;
  visitCollectionSaved: boolean;
  onClose?: () => void;
  onFollowTrace: () => void;
  onLegacyJump: (direction: LegacyJumpTarget) => void;
  onSelectPerson: (inductee: Inductee) => void;
  onSetAction: (action: HallPersonAction) => void;
  onToggleVisitCollection: () => void;
}) {
  const profileMode = lens === 'portraits';
  const context = profileMode ? inducteeContextLabel(inductee) : '';
  const summary = profileMode ? honoredForSummary(inductee) : '';
  const shortFacts = profileMode ? portraitShortFacts(inductee) : [];
  const panelId = focusActionPanelId(inductee.id);
  const traceDescriptionId = `${panelId}-trace-desc`;
  const storyDescriptionId = `${panelId}-story-desc`;
  const textDescriptionId = `${panelId}-text-desc`;
  const watchDescriptionId = `${panelId}-watch-desc`;
  const continueDescriptionId = `${panelId}-continue-desc`;
  const saveDescriptionId = `${panelId}-visit-save-desc`;
  const biographyWords = fullBiographyWordCount(inductee);
  const visitCollectionFull = !visitCollectionSaved && visitCollectionCount >= visitCollectionLimit;

  return (
    <aside
      aria-label={lens === 'legacies' ? `${inductee.name} cohort navigator` : `${inductee.name} focused portrait context`}
      aria-modal={lens === 'legacies' ? 'true' : undefined}
      className="living-hall__focusCard"
      data-full-text-available={fullTextAvailable ? 'true' : 'false'}
      data-side={placement.side}
      role={lens === 'legacies' ? 'dialog' : undefined}
      style={placement.style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="living-hall__focusHeader">
        <span>{lens === 'legacies' ? 'COHORT NAVIGATION' : 'FOCUSED PORTRAIT'}</span>
        {onClose && (
          <button type="button" aria-label={lens === 'legacies' ? 'Close cohort navigator' : 'Close focused portrait'} onClick={onClose}>
            Close
          </button>
        )}
      </header>
      <div className="living-hall__focusIdentity">
        <h3>{inductee.name}</h3>
        <p>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Class year unknown'}</p>
      </div>
      {profileMode && context && <p className="living-hall__focusContext">{context}</p>}
      {lens === 'traces' && (
        <TraceFocusConnections
          context={traceContext}
          onSelectPerson={onSelectPerson}
        />
      )}
      {lens === 'legacies' && (
        <LegacyFocusNavigator
          activeLegacyGroup={activeLegacyGroup}
          activeLegacyYear={activeLegacyYear}
          chronology={legacyChronology}
          inductee={inductee}
          onJump={onLegacyJump}
          onSelectPerson={onSelectPerson}
        />
      )}
      {profileMode && (
        <>
          <section className="living-hall__focusFacts" aria-label="Short facts">
            <h4>SHORT FACTS</h4>
            <dl>
              {shortFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="living-hall__focusWhy" aria-label="Honored for">
            <h4>HONORED FOR</h4>
            <p>{summary}</p>
          </section>
        </>
      )}
      {profileMode && (
        <nav className="living-hall__focusActions" aria-label={`Actions for ${inductee.name}`}>
          <button
            type="button"
            aria-label="FOLLOW THE TRACE →"
            aria-describedby={traceDescriptionId}
            className="living-hall__focusAction living-hall__focusAction--primary"
            onClick={onFollowTrace}
          >
            <span>FOLLOW THE TRACE →</span>
            <small id={traceDescriptionId}>People, heritage, and class ties</small>
          </button>
          <button
            type="button"
            aria-label="LIFE + WORK"
            aria-controls={panelId}
            aria-describedby={storyDescriptionId}
            aria-expanded={action === 'story'}
            aria-pressed={action === 'story'}
            className={action === 'story' ? 'living-hall__focusAction living-hall__focusAction--active' : 'living-hall__focusAction'}
            onClick={() => onSetAction(action === 'story' ? 'overview' : 'story')}
          >
            <span>LIFE + WORK</span>
            <small id={storyDescriptionId}>Guided highlights</small>
          </button>
          {fullTextAvailable && (
            <button
              type="button"
              aria-label="FULL TEXT"
              aria-controls={panelId}
              aria-describedby={textDescriptionId}
              aria-expanded={action === 'text'}
              aria-pressed={action === 'text'}
              className={action === 'text' ? 'living-hall__focusAction living-hall__focusAction--active' : 'living-hall__focusAction'}
              onClick={() => onSetAction(action === 'text' ? 'overview' : 'text')}
            >
              <span>FULL TEXT</span>
              <small id={textDescriptionId}>{biographyWords ? `${biographyWords} words` : 'Source biography'}</small>
            </button>
          )}
          {mediaPlayable && (
            <button
              type="button"
              aria-label="WATCH INDUCTION"
              aria-controls={panelId}
              aria-describedby={watchDescriptionId}
              aria-expanded={action === 'watch'}
              aria-pressed={action === 'watch'}
              className={action === 'watch' ? 'living-hall__focusAction living-hall__focusAction--active' : 'living-hall__focusAction'}
              onClick={() => onSetAction(action === 'watch' ? 'overview' : 'watch')}
            >
              <span>WATCH INDUCTION</span>
              <small id={watchDescriptionId}>Recorded media</small>
            </button>
          )}
          {continuationAvailable && (
            <button
              type="button"
              aria-label="TAKE IT WITH YOU"
              aria-controls={panelId}
              aria-describedby={continueDescriptionId}
              aria-expanded={action === 'continue'}
              aria-pressed={action === 'continue'}
              className={action === 'continue' ? 'living-hall__focusAction living-hall__focusAction--active' : 'living-hall__focusAction'}
              onClick={() => onSetAction(action === 'continue' ? 'overview' : 'continue')}
            >
              <span>TAKE IT WITH YOU</span>
              <small id={continueDescriptionId}>QR continuation</small>
            </button>
          )}
          {visitCollectionEnabled && (
            <button
              type="button"
              aria-label={visitCollectionSaved ? 'REMOVE FROM VISIT' : 'SAVE TO VISIT'}
              aria-describedby={saveDescriptionId}
              aria-pressed={visitCollectionSaved}
              className={visitCollectionSaved ? 'living-hall__focusAction living-hall__focusAction--active living-hall__focusAction--visit' : 'living-hall__focusAction living-hall__focusAction--visit'}
              disabled={visitCollectionFull}
              onClick={onToggleVisitCollection}
            >
              <span>{visitCollectionSaved ? 'REMOVE FROM VISIT' : 'SAVE TO VISIT'}</span>
              <small id={saveDescriptionId}>
                {visitCollectionSaved
                  ? `${Math.max(visitCollectionCount, 1)} saved for session QR`
                  : visitCollectionFull
                    ? `${visitCollectionLimit} saved / visit list full`
                    : 'Add to one session QR'}
              </small>
            </button>
          )}
        </nav>
      )}
    </aside>
  );
}

function TraceFocusConnections({
  context,
  onSelectPerson,
}: {
  context: TraceContext;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  const activePerson = context.activePerson;
  if (!activePerson) return null;

  const activeTitle = traceActiveTitle(context);
  const visibleThreads = context.visibleThreads.slice(0, 5);
  const totalConnections = context.visibleThreads.length;
  const directCount = context.directThreads.length;
  const modeLabel = context.mode === 'direct'
    ? 'Direct ties'
    : context.mode === 'concept'
      ? 'Shared concept'
      : 'Nationality trace';

  return (
    <section className="living-hall__traceFocus" aria-label={`${activePerson.name} connection context`}>
      <header className="living-hall__traceFocusHeader">
        <span>{modeLabel}</span>
        <strong>{activeTitle}</strong>
        <small>{totalConnections} shown / {directCount} direct</small>
      </header>
      {visibleThreads.length > 0 ? (
        <ol className="living-hall__traceConnectionList" aria-label="Visible connected portraits">
          {visibleThreads.map((thread, index) => {
            const reason = thread.reasons[0] ?? null;
            const label = reason ? relationshipLineLabel(reason, activePerson.name) : activeTitle;
            const detail = reason ? relationshipSupportLabel(reason, activePerson.name) || reason.detail : '';
            return (
              <li key={thread.person.id}>
                <button
                  className="living-hall__traceConnection"
                  type="button"
                  data-trace-person={thread.person.id}
                  aria-label={`Focus ${thread.person.name}, connected by ${label}`}
                  onClick={() => onSelectPerson(thread.person)}
                >
                  <span className="living-hall__traceConnectionIndex">{String(index + 1).padStart(2, '0')}</span>
                  <span className="living-hall__traceConnectionBody">
                    <strong>{thread.person.name}</strong>
                    <em>{label}</em>
                    {detail && <small>{detail}</small>}
                  </span>
                  <span
                    aria-hidden="true"
                    className="living-hall__traceConnectionWeight"
                    style={{ '--trace-weight': String(clamp(thread.score / 220, 0.2, 1)) } as CSSProperties & Record<string, string>}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="living-hall__traceFocusEmpty">Choose a trace mode to reveal nearby documented people, communities, and concepts.</p>
      )}
    </section>
  );
}

function LegacyFocusNavigator({
  activeLegacyGroup,
  activeLegacyYear,
  chronology,
  inductee,
  onJump,
  onSelectPerson,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  chronology: LegacyChronology;
  inductee: Inductee;
  onJump: (direction: LegacyJumpTarget) => void;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  const group = legacyFocusGroup({ activeLegacyGroup, activeLegacyYear, inductee, legacyChronology: chronology });
  const classYear = group?.year ?? inductee.classYear ?? activeLegacyYear;
  const yearIndex = typeof classYear === 'number' ? chronology.years.indexOf(classYear) : -1;
  const previousYear = yearIndex > 0 ? chronology.years[yearIndex - 1] : null;
  const nextYear = yearIndex >= 0 && yearIndex < chronology.years.length - 1 ? chronology.years[yearIndex + 1] : null;
  const previousGroup = previousYear === null ? null : legacyGroupForYear(chronology, previousYear);
  const nextGroup = nextYear === null ? null : legacyGroupForYear(chronology, nextYear);
  const people = group?.people ?? [inductee];
  const activeIndex = Math.max(people.findIndex((person) => person.id === inductee.id), 0);
  const visiblePeople = legacyVisibleCohortPeople(people, inductee.id, 7);
  const groupLabel = group?.year ? `Class of ${group.year}` : group?.label ?? 'Class group';

  return (
    <section className="living-hall__legacyFocus" aria-label={`${inductee.name} class cohort navigation`}>
      <header className="living-hall__legacyFocusHeader">
        <span>Class Corridor</span>
        <strong>{groupLabel}</strong>
        <small>{activeIndex + 1} of {people.length}</small>
      </header>

      <div className="living-hall__legacyClassStepper" aria-label="Move between induction classes">
        <button
          className="living-hall__legacyStep living-hall__legacyStep--previous"
          type="button"
          disabled={!previousGroup || previousYear === null}
          onClick={() => {
            if (previousYear !== null) onJump(previousYear);
          }}
        >
          <span>Previous</span>
          <strong>{previousGroup?.label ?? 'Start'}</strong>
          <small>{previousGroup ? `${previousGroup.people.length} people` : 'Endpoint'}</small>
        </button>
        <div className="living-hall__legacyCurrentClass" aria-live="polite">
          <span>Current</span>
          <strong>{group?.label ?? (classYear ? String(classYear) : 'Open')}</strong>
          <small>{people.length} {people.length === 1 ? 'portrait' : 'portraits'}</small>
        </div>
        <button
          className="living-hall__legacyStep living-hall__legacyStep--next"
          type="button"
          disabled={!nextGroup || nextYear === null}
          onClick={() => {
            if (nextYear !== null) onJump(nextYear);
          }}
        >
          <span>Next</span>
          <strong>{nextGroup?.label ?? 'End'}</strong>
          <small>{nextGroup ? `${nextGroup.people.length} people` : 'Endpoint'}</small>
        </button>
      </div>

      <ol className="living-hall__legacyCohort" aria-label={`${groupLabel} portraits`}>
        {visiblePeople.map((person) => {
          const active = person.id === inductee.id;
          const cohortIndex = Math.max(people.findIndex((candidate) => candidate.id === person.id), 0) + 1;
          return (
            <li key={person.id}>
              <button
                className={active ? 'living-hall__legacyCohortPerson living-hall__legacyCohortPerson--active' : 'living-hall__legacyCohortPerson'}
                type="button"
                aria-pressed={active}
                aria-label={`Focus ${person.name}`}
                onClick={() => onSelectPerson(person)}
              >
                <span>{String(cohortIndex).padStart(2, '0')}</span>
                <strong>{person.name}</strong>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="living-hall__legacySwipeHint">Swipe the class wall or use previous and next to move between cohorts.</p>
    </section>
  );
}

function VisitCollectionTray({
  people,
  qrOpen,
  sessionUrl,
  onClear,
  onCloseQr,
  onOpenQr,
  onRemove,
  onSelect,
}: {
  people: Inductee[];
  qrOpen: boolean;
  sessionUrl: string;
  onClear: () => void;
  onCloseQr: () => void;
  onOpenQr: () => void;
  onRemove: (personId: string) => void;
  onSelect: (inductee: Inductee) => void;
}) {
  const title = `${people.length} saved ${people.length === 1 ? 'record' : 'records'}`;

  return (
    <>
      <aside
        aria-label="Saved visit collection"
        className="living-hall__visitTray"
        data-saved-count={people.length}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="living-hall__visitTrayHeader">
          <div>
            <span>VISIT</span>
            <strong>{title}</strong>
          </div>
          <div className="living-hall__visitTrayActions">
            <button type="button" onClick={onOpenQr}>Visit QR</button>
            <button type="button" onClick={onClear}>Clear</button>
          </div>
        </header>
        <ol className="living-hall__visitList" aria-label="Saved people">
          {people.map((person, index) => (
            <li key={person.id}>
              <button
                className="living-hall__visitPerson"
                data-visit-person={person.id}
                type="button"
                onClick={() => onSelect(person)}
              >
                <span>{index + 1}</span>
                <strong>{person.name}</strong>
                <small>{person.classYear ? `Class of ${person.classYear}` : person.region}</small>
              </button>
              <button
                aria-label={`Remove ${person.name} from saved visit`}
                className="living-hall__visitRemove"
                data-remove-visit-person={person.id}
                type="button"
                onClick={() => onRemove(person.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {qrOpen && (
        <aside
          aria-label="Saved visit QR"
          className="living-hall__visitQrPanel"
          role="dialog"
          aria-modal="false"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header className="living-hall__visitQrHeader">
            <span>VISIT QR</span>
            <button type="button" onClick={onCloseQr}>Close</button>
          </header>
          <QRCodePanel
            className="qr-continuation--visit-session"
            value={sessionUrl}
            title={title}
            instruction="Scan once to continue this saved visit path on the Hall website."
            ariaLabel={`${title} visit continuation QR`}
            onAutoClose={onCloseQr}
          />
        </aside>
      )}
    </>
  );
}

function PersonFocusActionPanel({
  action,
  allInductees,
  continuationUrl,
  gallery,
  inductee,
  kioskMode,
  mediaRecord,
  placement,
  soundEnabled,
  storyRecord,
  onClose,
  onOpenImage,
  onSelectPerson,
}: {
  action: Exclude<HallPersonAction, 'overview'>;
  allInductees: Inductee[];
  continuationUrl: string;
  gallery: string[];
  inductee: Inductee;
  kioskMode: boolean;
  mediaRecord?: RuntimeMediaRecord;
  placement: FocusActionPlacement;
  soundEnabled: boolean;
  storyRecord?: StorySectionRecord;
  onClose: () => void;
  onOpenImage: (index: number) => void;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  return (
    <aside
      id={focusActionPanelId(inductee.id)}
      aria-label={`${inductee.name} ${personActionLabel(action)}`}
      className={`living-hall__personActionPanel detail--visitor detail--action-${detailClassForAction(action)}`}
      data-action-label={personActionLabel(action)}
      data-side={placement.side}
      style={placement.style}
      onEndedCapture={action === 'watch' ? onClose : undefined}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="living-hall__personActionHeader">
        <span title={inductee.name}>{inductee.name}</span>
        <button type="button" onClick={onClose}>Return To Portrait</button>
      </header>
      {action === 'story' && (
        <StoryMode
          allInductees={allInductees}
          gallery={gallery}
          inductee={inductee}
          storyRecord={storyRecord}
          onExit={onClose}
          onSelectPerson={onSelectPerson}
        />
      )}
      {action === 'text' && (
        <PersonFullTextPanel inductee={inductee} />
      )}
      {action === 'watch' && (
        <MediaExperience
          gallery={gallery}
          inductee={inductee}
          kioskMode={kioskMode}
          mediaRecord={mediaRecord}
          soundEnabled={soundEnabled}
          onOpenImage={onOpenImage}
        />
      )}
      {action === 'continue' && continuationUrl && (
        <QRCodePanel
          className="qr-continuation--hall-focus"
          value={continuationUrl}
          title={inductee.name}
          instruction="Scan to continue on the Cleveland International Hall of Fame website."
          onAutoClose={onClose}
          onClose={onClose}
        />
      )}
    </aside>
  );
}

type PortraitFocusFact = {
  label: string;
  value: string;
};

function PersonFullTextPanel({ inductee }: { inductee: Inductee }) {
  const text = fullBiographyText(inductee);
  const paragraphs = biographyParagraphs(text);
  const wordCount = wordCountText(text);
  const detail = [
    inductee.classYear ? `Class of ${inductee.classYear}` : '',
    wordCount ? `${wordCount} words` : '',
    'Local biography text',
  ].filter(Boolean).join(' / ');

  return (
    <section
      aria-label={`${inductee.name} full biography`}
      className="living-hall__fullText"
      data-word-count={wordCount}
    >
      <header className="living-hall__fullTextHeader">
        <p className="museum-kicker">Full Text</p>
        <h3>Source Biography</h3>
        <span>{detail}</span>
      </header>
      <div className="living-hall__fullTextBody" tabIndex={0} aria-label={`${inductee.name} biography text`}>
        {paragraphs.map((paragraph, index) => (
          <p key={`${inductee.id}-paragraph-${index}`}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

function traceActiveTitle(context: TraceContext) {
  if (context.mode === 'concept') return context.activeConcept?.lens.label ?? 'Concept Trace';
  if (context.mode === 'place') return context.placeFocus.label;
  return 'Direct Ties';
}

function legacyFocusGroup({
  activeLegacyGroup,
  activeLegacyYear,
  inductee,
  legacyChronology,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  inductee: Inductee;
  legacyChronology: LegacyChronology;
}): LegacyYearGroup | null {
  return legacyChronology.groups.find((candidate) => candidate.people.some((person) => person.id === inductee.id))
    ?? activeLegacyGroup
    ?? legacyGroupForYear(legacyChronology, activeLegacyYear);
}

function legacyVisibleCohortPeople(people: Inductee[], activePersonId: string, limit: number) {
  if (people.length <= limit) return people;
  const activeIndex = Math.max(people.findIndex((person) => person.id === activePersonId), 0);
  const before = Math.floor((limit - 1) / 2);
  const start = clamp(activeIndex - before, 0, Math.max(0, people.length - limit));
  return people.slice(start, start + limit);
}

function portraitShortFacts(inductee: Inductee): PortraitFocusFact[] {
  const supportedNationalities = isPresentationReadyGeography(inductee)
    ? inductee.countryTags.slice(0, 2)
    : [];
  const nationality = supportedNationalities.join(' / ');
  const community = inductee.communityTags.slice(0, 2).join(' / ') || explicitTags(inductee.themeTags, inductee.themeTagsSource)[0] || '';
  const biographyWords = fullBiographyWordCount(inductee);
  const facts: PortraitFocusFact[] = [
    { label: 'Class', value: inductee.classYear ? String(inductee.classYear) : 'Pending' },
  ];
  if (nationality) facts.push({ label: 'Nationality', value: compactFactValue(nationality) });
  if (community || inductee.region) facts.push({ label: 'Community', value: compactFactValue(community || inductee.region) });

  if (inductee.inductedBy) facts.push({ label: 'Inducted By', value: compactFactValue(inductee.inductedBy) });
  if (facts.length < 4 && biographyWords > 0) facts.push({ label: 'Text', value: `${biographyWords} words` });

  return facts.slice(0, 4);
}

function compactFactValue(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 44) return normalized;
  return `${normalized.slice(0, 41).replace(/[,;:\s]+$/, '')}...`;
}

function buildVisitSessionUrl({
  focusedPersonId,
  lens,
  savedPeople,
  timelineYear,
  traceFocusKey,
}: {
  focusedPersonId: string;
  lens: HallLens;
  savedPeople: Inductee[];
  timelineYear: string;
  traceFocusKey: string;
}) {
  if (savedPeople.length === 0) return '';

  const savedIds = savedPeople.map((person) => person.id);
  const startingPersonId = savedIds.includes(focusedPersonId) ? focusedPersonId : savedIds[0];
  const baseHref = new URL(
    import.meta.env.BASE_URL || '/',
    typeof window === 'undefined' ? 'https://clevelandinternationalhalloffame.com' : window.location.origin,
  ).href;
  const url = new URL(baseHref);

  url.searchParams.set('person', startingPersonId);
  url.searchParams.set('visit', savedIds.join(','));
  if (lens !== 'portraits') url.searchParams.set('lens', lens);
  if (lens === 'traces' && traceFocusKey) url.searchParams.set('trace', traceFocusKey);
  if (lens === 'legacies' && timelineYear) url.searchParams.set('timeYear', timelineYear);

  return url.href;
}

function fullBiographyWordCount(inductee: Inductee) {
  return wordCountText(fullBiographyText(inductee));
}

function fullBiographyText(inductee: Inductee) {
  const source = inductee.bioText || inductee.lifeWorkSummary || inductee.storySummary || inductee.honoredForSummary;
  return stripLeadingBiographyName(source.replace(/\s+/g, ' ').trim(), inductee.name);
}

function stripLeadingBiographyName(text: string, name: string) {
  const variants = [
    name,
    name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);
  const lowerText = text.toLowerCase();
  const match = variants.find((variant) => lowerText.startsWith(variant.toLowerCase()));
  if (!match) return text;
  return text.slice(match.length).replace(/^[-:,\s]+/, '').trim() || text;
}

function biographyParagraphs(text: string) {
  if (!text) return ['No biography text is available in this local data bundle.'];
  const sentences = splitBiographySentences(text);
  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  sentences.forEach((sentence) => {
    const sentenceWords = wordCountText(sentence);
    if (current.length > 0 && (currentWords + sentenceWords > 115 || current.length >= 4)) {
      paragraphs.push(current.join(' '));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += sentenceWords;
  });

  if (current.length > 0) paragraphs.push(current.join(' '));
  return paragraphs;
}

function splitBiographySentences(text: string) {
  const protectedText = text
    .replace(/\b(i\.e|e\.g|Mr|Mrs|Ms|Dr|Jr|Sr|St|Fr|Hon|Rev)\./gi, (match) => match.replace(/\./g, '<dot>'))
    .replace(/\b([A-Z])\./g, '$1<dot>');
  return (protectedText.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [protectedText])
    .map((sentence) => sentence.replace(/<dot>/g, '.').trim())
    .filter(Boolean);
}

function wordCountText(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function focusActionPanelId(inducteeId: string) {
  return `living-hall-person-action-${inducteeId}`;
}

function personActionLabel(action: HallPersonAction) {
  if (action === 'story') return 'LIFE + WORK';
  if (action === 'text') return 'FULL TEXT';
  if (action === 'watch') return 'WATCH INDUCTION';
  if (action === 'continue') return 'TAKE IT WITH YOU';
  return 'FOCUSED PORTRAIT';
}

function detailClassForAction(action: HallPersonAction) {
  if (action === 'story') return 'story';
  if (action === 'text') return 'text';
  if (action === 'watch') return 'watch';
  if (action === 'continue') return 'continue';
  return 'overview';
}

type LensStatusItem = {
  label: string;
  value: string;
};

function LensStatusRail({
  activeLegacyGroup,
  activeLegacyYear,
  activeMode,
  allPeopleCount,
  focusedPerson,
  latestClass,
  legacyChronology,
  lens,
  people,
  traceContext,
  traceTrailIds,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  activeMode: HallMode;
  allPeopleCount: number;
  focusedPerson: Inductee | null;
  latestClass: LatestClass | null;
  legacyChronology: LegacyChronology;
  lens: HallLens;
  people: Inductee[];
  traceContext: TraceContext;
  traceTrailIds: string[];
}) {
  const items = lensStatusItems({
    activeLegacyGroup,
    activeLegacyYear,
    activeMode,
    allPeopleCount,
    focusedPerson,
    latestClass,
    legacyChronology,
    lens,
    people,
    traceContext,
    traceTrailIds,
  });

  if (items.length === 0) return null;

  return (
    <aside className="living-hall__statusRail" aria-label="Hall category status" data-status-lens={lens}>
      {items.map((item) => (
        <span className="living-hall__statusMetric" key={`${item.label}-${item.value}`}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </span>
      ))}
    </aside>
  );
}

function lensStatusItems({
  activeLegacyGroup,
  activeLegacyYear,
  activeMode,
  allPeopleCount,
  focusedPerson,
  latestClass,
  legacyChronology,
  lens,
  people,
  traceContext,
  traceTrailIds,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  activeMode: HallMode;
  allPeopleCount: number;
  focusedPerson: Inductee | null;
  latestClass: LatestClass | null;
  legacyChronology: LegacyChronology;
  lens: HallLens;
  people: Inductee[];
  traceContext: TraceContext;
  traceTrailIds: string[];
}): LensStatusItem[] {
  if (lens === 'traces') {
    if (!traceContext.activePerson) {
      return [
        { label: 'Records', value: String(allPeopleCount) },
        { label: 'Concepts', value: String(traceContext.conceptChoices.length) },
        { label: 'Nationalities', value: String(traceContext.placeChoices.length) },
      ];
    }

    return [
      { label: 'Direct', value: String(traceContext.directThreads.length) },
      { label: 'Shown', value: String(traceContext.visibleThreads.length) },
      { label: 'Modes', value: String(traceChooserOptions(traceContext).length) },
      { label: 'Path', value: String(traceTrailIds.length) },
    ];
  }

  if (lens === 'legacies') {
    const activeIndex = activeLegacyYear === null ? -1 : legacyChronology.years.indexOf(activeLegacyYear);
    return [
      { label: 'Class', value: activeLegacyYear ? String(activeLegacyYear) : 'Open' },
      { label: 'People', value: String(activeLegacyGroup?.people.length ?? 0) },
      { label: 'Index', value: activeIndex >= 0 ? `${activeIndex + 1}/${legacyChronology.years.length}` : String(legacyChronology.years.length) },
      { label: 'Range', value: legacyChronology.firstYear && legacyChronology.lastYear ? `${legacyChronology.firstYear}-${legacyChronology.lastYear}` : 'CIHOF' },
    ];
  }

  const featuredCount = people.filter((person) => person.featured || person.featuredCandidate).length;
  const emphasizedCount = [...activeMode.positions.values()].filter((position) => position.emphasis && !position.focused).length;
  if (focusedPerson) {
    return [
      { label: 'Focus', value: focusedPerson.classYear ? String(focusedPerson.classYear) : 'Open' },
      { label: 'Nearby', value: String(emphasizedCount) },
      { label: 'Records', value: `${people.length}/${allPeopleCount}` },
    ];
  }

  return [
    { label: 'Records', value: `${people.length}/${allPeopleCount}` },
    { label: 'Featured', value: String(featuredCount) },
    { label: 'Latest', value: latestClass ? String(latestClass.year) : 'Open' },
  ];
}

function LegacyControls({
  activeYear,
  chronology,
  onJump,
}: {
  activeYear: number | null;
  chronology: LegacyChronology;
  onJump: (direction: LegacyJumpTarget) => void;
}) {
  if (chronology.years.length === 0) return null;
  const activeIndex = activeYear === null ? 0 : Math.max(chronology.years.indexOf(activeYear), 0);
  const activeLabel = activeYear === null ? `${chronology.firstYear ?? ''}` : String(activeYear);
  const range = chronology.firstYear && chronology.lastYear
    ? `${chronology.firstYear} - ${chronology.lastYear}`
    : 'Class chronology';

  return (
    <nav className="living-hall__legacyControls" aria-label="Chronology controls">
      <button
        className="living-hall__legacyControl living-hall__legacyControl--jump living-hall__legacyControl--first"
        type="button"
        aria-label="Go to earliest induction class"
        disabled={activeIndex <= 0}
        onClick={() => onJump('first')}
      >
        First
      </button>
      <button
        className="living-hall__legacyControl living-hall__legacyControl--edge living-hall__legacyControl--previous"
        type="button"
        aria-label="Move to previous induction class"
        disabled={activeIndex <= 0}
        onClick={() => onJump(-1)}
      >
        <span aria-hidden="true">Previous</span>
      </button>
      <div className="living-hall__legacyTrack" aria-label="Induction class years">
        {chronology.groups.filter((group) => group.year !== null).map((group) => {
          const active = group.year === activeYear;
          return (
            <button
              aria-label={`Class of ${group.year}, ${group.people.length} ${group.people.length === 1 ? 'inductee' : 'inductees'}`}
              aria-pressed={active}
              className={active ? 'living-hall__legacyYear living-hall__legacyYear--active' : 'living-hall__legacyYear'}
              key={group.key}
              style={{ '--legacy-class-size': String(group.people.length) } as CSSProperties & Record<string, string>}
              type="button"
              onClick={() => {
                if (group.year !== null) onJump(group.year);
              }}
            >
              <span>{group.label}</span>
            </button>
          );
        })}
      </div>
      <span className="living-hall__legacyReadout" aria-live="polite">
        <small>Class Of</small>
        <strong>{activeLabel}</strong>
        <em>{range}</em>
      </span>
      <button
        className="living-hall__legacyControl living-hall__legacyControl--edge living-hall__legacyControl--next"
        type="button"
        aria-label="Move to next induction class"
        disabled={activeIndex >= chronology.years.length - 1}
        onClick={() => onJump(1)}
      >
        <span aria-hidden="true">Next</span>
      </button>
      <button
        className="living-hall__legacyControl living-hall__legacyControl--jump living-hall__legacyControl--latest"
        type="button"
        aria-label="Go to latest induction class"
        disabled={activeIndex >= chronology.years.length - 1}
        onClick={() => onJump('last')}
      >
        Latest
      </button>
    </nav>
  );
}

function TracePanel({
  context,
  chooserOpen,
  panelSide,
  onOpenChooser,
  onTraceFocusChange,
}: {
  context: TraceContext;
  chooserOpen: boolean;
  panelSide: 'left' | 'right';
  onOpenChooser: () => void;
  onTraceFocusChange?: (focusKey: string) => void;
}) {
  const activePerson = context.activePerson;
  if (!activePerson) return null;

  const activeTitle = context.mode === 'concept'
    ? context.activeConcept?.lens.label ?? 'Concept Trace'
    : context.mode === 'place'
      ? context.placeFocus.label
      : 'Direct Ties';
  const choices = traceChooserOptions(context);
  const traceMetrics = [
    { label: 'Direct', value: context.directThreads.length },
    { label: 'Concept', value: context.conceptChoices.length },
    { label: 'Nationality', value: context.placeChoices.length },
  ];

  return (
    <aside
      className={chooserOpen ? 'living-hall__tracePanel living-hall__tracePanel--chooser-open' : 'living-hall__tracePanel'}
      data-side={panelSide}
      aria-label={`${activePerson.name} traces`}
    >
      <header className="living-hall__traceHeader">
        <span>TRACES</span>
        <h3>{activePerson.name}</h3>
        <button className="living-hall__traceContextButton" type="button" aria-expanded={chooserOpen} onClick={onOpenChooser}>
          {activeTitle}
        </button>
      </header>

      <div className="living-hall__traceMetrics" aria-label="Trace mode counts">
        {traceMetrics.map((metric) => (
          <span key={metric.label}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
          </span>
        ))}
      </div>

      {onTraceFocusChange && choices.length > 0 && (
        <nav className="living-hall__traceControls" aria-label="Reorganize traces">
          {choices.map((choice) => {
            const active = choice.key === context.traceFocusKey;
            return (
              <button
                aria-pressed={active}
                className={active ? 'living-hall__traceControl living-hall__traceControl--active' : 'living-hall__traceControl'}
                data-trace-choice={choice.kind}
                key={choice.key || 'direct'}
                type="button"
                onClick={() => onTraceFocusChange(choice.key)}
              >
                <span>{choice.kind === 'direct' ? 'Trace' : choice.kind === 'place' ? 'Nationality' : 'Concept'}</span>
                <strong>{choice.label}</strong>
                {choice.detail && <small>{choice.detail}</small>}
              </button>
            );
          })}
        </nav>
      )}
    </aside>
  );
}

function traceChooserOptions(context: TraceContext): TraceChoice[] {
  const choices: TraceChoice[] = [];
  if (context.directThreads.length > 0) {
    choices.push({ key: '', label: 'DIRECT TIES', detail: '', kind: 'direct' });
  }
  const conceptLimit = context.directThreads.length > 0 ? 2 : 3;
  const placeLimit = context.directThreads.length > 0 ? 1 : 2;

  context.conceptChoices.slice(0, conceptLimit).forEach((thread) => {
    choices.push({
      key: `concept:${thread.lens.id}`,
      label: thread.lens.label,
      detail: thread.lens.prompt,
      kind: 'concept',
    });
  });
  context.placeChoices.slice(0, placeLimit).forEach((choice) => {
    choices.push(choice);
  });

  const activeIndex = choices.findIndex((choice) => choice.key === context.traceFocusKey);
  if (activeIndex > 0) {
    const [active] = choices.splice(activeIndex, 1);
    choices.unshift(active);
  }

  return choices.slice(0, 4);
}

function LatestClassSequence({
  frame,
  latestClass,
  reducedMotion,
  onSelect,
}: {
  frame: LatestClassFrame;
  latestClass: LatestClass;
  reducedMotion: boolean;
  onSelect: (inductee: Inductee) => void;
}) {
  const className = [
    'latest-class-sequence',
    `latest-class-sequence--${frame.kind}`,
    reducedMotion ? 'latest-class-sequence--reduced-motion' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={className} aria-label={`Latest induction class, Class of ${latestClass.year}`}>
      <div className="latest-class-sequence__frame" key={frame.key}>
        {frame.kind === 'intro' && (
          <div className="latest-class-sequence__intro">
            <p>Latest Class</p>
            <h3>Class Of {latestClass.year}</h3>
          </div>
        )}

        {frame.kind === 'person' && (
          <div className="latest-class-sequence__person">
            <button
              type="button"
              aria-label={`Open ${frame.inductee.name}, Class of ${latestClass.year}`}
              data-transition-person={frame.inductee.id}
              data-transition-role="living-portrait"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelect(frame.inductee)}
            >
              <FallbackImage
                alt={frame.inductee.imageAltText || frame.inductee.name}
                className="latest-class-sequence__portrait"
                fallbackClassName="latest-class-sequence__fallback"
                fallbackLabel={initials(frame.inductee.name)}
                loading="eager"
                src={frame.inductee.primaryImageUrl}
              />
            </button>
            <div>
              <p>{String(frame.index + 1).padStart(2, '0')} / {String(latestClass.inductees.length).padStart(2, '0')}</p>
              <h3>{frame.inductee.name}</h3>
              <span>Class Of {latestClass.year}</span>
            </div>
          </div>
        )}

        {frame.kind === 'group' && (
          <div className="latest-class-sequence__group">
            <div>
              <p>Latest Class</p>
              <h3>{latestClass.year}</h3>
            </div>
            <div className="latest-class-sequence__grid">
              {latestClass.inductees.map((inductee) => (
                <button
                  key={inductee.id}
                  type="button"
                  aria-label={`Open ${inductee.name}, Class of ${latestClass.year}`}
                  data-transition-person={inductee.id}
                  data-transition-role="living-portrait"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(inductee)}
                >
                  <FallbackImage
                    alt={inductee.imageAltText || inductee.name}
                    className="latest-class-sequence__gridImage"
                    fallbackClassName="latest-class-sequence__gridFallback"
                    fallbackLabel={initials(inductee.name)}
                    loading="eager"
                    src={inductee.primaryImageUrl}
                  />
                  <span>{inductee.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {frame.kind === 'finale' && (
          <div className="latest-class-sequence__finale">
            <p>Class Of {latestClass.year}</p>
            <strong>{latestClass.stats.people} {latestClass.stats.people === 1 ? 'Person' : 'People'}</strong>
            <strong>{latestClass.stats.stories} {latestClass.stats.stories === 1 ? 'Story' : 'Stories'}</strong>
            <strong>{latestClass.stats.cities} {latestClass.stats.cities === 1 ? 'City' : 'Cities'}</strong>
          </div>
        )}
      </div>
    </aside>
  );
}

function LivingHallPlaceholders() {
  return (
    <>
      {Array.from({ length: 32 }, (_, index) => {
        const position = fallbackPosition(index, 32);
        return (
          <span className="living-portrait living-portrait--placeholder" key={index} style={portraitStyle(position)}>
            <PortraitFrame
              name="CIHOF"
              classYear={null}
              imageUrl=""
              imageAltText=""
              fallbackLabel="CIHOF"
              state="standard"
              aspect="tall"
              showRecord={false}
            />
          </span>
        );
      })}
    </>
  );
}

const emptyMode: HallMode = {
  id: 'empty',
  title: 'PORTRAITS',
  subtitle: 'No portraits loaded',
  positions: new Map(),
  labels: [],
};

function hallDisplayTitle(lens: HallLens) {
  if (lens === 'traces') return 'TRACES';
  if (lens === 'legacies') return 'LEGACIES';
  return 'PORTRAITS';
}

function selectHallMode({
  focusedPersonId,
  lens,
  layout,
  modes,
  people,
  relationships,
  step,
  timelineYear,
  traceTrailIds,
  traceContext,
  legacyChronology,
  activeLegacyYear,
}: {
  focusedPersonId: string;
  lens: HallLens;
  layout: HallLayoutMetrics;
  modes: HallMode[];
  people: Inductee[];
  relationships: RelationshipRecord[];
  step: number;
  timelineYear: string;
  traceTrailIds: string[];
  traceContext: TraceContext;
  legacyChronology: LegacyChronology;
  activeLegacyYear: number | null;
}) {
  const fallback = modes[step % Math.max(modes.length, 1)] ?? emptyMode;
  const baseMode = lens === 'legacies'
    ? buildLegacyHallMode(people, legacyChronology, activeLegacyYear, focusedPersonId, layout)
    : lens === 'traces'
      ? buildTraceHallMode(people, portraitModeFromModes(modes, 0) ?? fallback, traceContext, traceTrailIds, layout)
      : portraitModeFromModes(modes, step) ?? fallback;

  return lens === 'traces' || lens === 'legacies' ? baseMode : applyHallFocus(baseMode, people, relationships, focusedPersonId, layout);
}

function portraitModeFromModes(modes: HallMode[], step: number) {
  const portraitModes = modes.filter((mode) => mode.id.startsWith('portrait-wall'));
  return portraitModes[step % Math.max(portraitModes.length, 1)] ?? null;
}

function buildTraceContext({
  focusedPersonId,
  inductees,
  relationships,
  storyLenses,
  traceFocusKey,
}: {
  focusedPersonId: string;
  inductees: Inductee[];
  relationships: RelationshipRecord[];
  storyLenses: ReturnType<typeof useStoryLenses>['lenses'];
  traceFocusKey: string;
}): TraceContext {
  const activePerson = focusedPersonId ? inductees.find((person) => person.id === focusedPersonId) ?? null : null;
  const geography = buildGeographyTraceModel(inductees);
  const directThreads = activePerson ? buildHumanNetwork(activePerson, inductees, relationships) : [];
  const conceptThreads = activePerson ? buildConceptThreads(activePerson, inductees, storyLenses) : [];
  const requestedConceptId = traceFocusKey.startsWith('concept:') ? traceFocusKey.slice('concept:'.length) : '';
  const activeConcept = requestedConceptId
    ? conceptThreads.find((thread) => thread.lens.id === requestedConceptId) ?? null
    : null;
  const placeRequested = traceFocusKey.startsWith('country:') || traceFocusKey.startsWith('region:');
  const placeFocus = resolvePlaceTraceFocus(geography, placeRequested ? traceFocusKey : '');
  const mode: TraceContext['mode'] = activeConcept ? 'concept' : placeRequested && placeFocus.key ? 'place' : 'direct';
  const activeTraceFocusKey = mode === 'concept'
    ? `concept:${activeConcept?.lens.id ?? ''}`
    : mode === 'place'
      ? placeFocus.key
      : '';
  const visibleThreads = activePerson
    ? mode === 'concept' && activeConcept
      ? buildConceptNetwork(activePerson, activeConcept, directThreads).slice(0, initialTraceThreadCount)
      : mode === 'place'
        ? buildPlaceNetwork(activePerson, placeFocus, directThreads).slice(0, initialTraceThreadCount)
        : directThreads.slice(0, initialTraceThreadCount)
    : [];

  return {
    activePerson,
    mode,
    traceFocusKey: activeTraceFocusKey,
    visibleThreads,
    directThreads,
    conceptThreads,
    conceptChoices: selectConceptThreadChoices(conceptThreads, requestedConceptId),
    activeConcept,
    geography,
    placeFocus,
    placeChoices: buildPlaceTraceChoices(geography, activePerson),
  };
}

function buildPlaceTraceChoices(geography: GeographyTraceModel, activePerson: Inductee | null): TraceChoice[] {
  const activePersonCountries = activePerson
    ? geography.countries.filter((country) => country.people.some((person) => person.id === activePerson.id))
    : [];
  const choices = [
    ...activePersonCountries,
    ...geography.countries,
  ];
  const seen = new Set<string>();

  return choices
    .filter((country) => {
      if (seen.has(country.id)) return false;
      seen.add(country.id);
      return true;
    })
    .slice(0, 4)
    .map((country) => ({
      key: country.id,
      label: country.label,
      detail: `${country.people.length}`,
      kind: 'place',
    }));
}

function buildTraceHallMode(
  inductees: Inductee[],
  baseMode: HallMode,
  context: TraceContext,
  traceTrailIds: string[],
  layout: HallLayoutMetrics,
): HallMode {
  if (!context.activePerson) {
    return {
      ...baseMode,
      id: 'traces-awaiting-focus',
      title: 'TRACES',
      subtitle: 'Focus a portrait to reorganize the Hall by reviewed ties, concepts, and nationality or heritage',
      labels: [
        { id: 'traces-awaiting-focus', text: 'TRACES', detail: 'Touch a portrait', x: 50, y: 50 },
        ...baseMode.labels.slice(0, 2),
      ],
      lines: [],
    };
  }

  const activePerson = context.activePerson;
  const positions = new Map<string, PortraitPosition>();
  const lines: HallLine[] = [];
  const anchor = traceAnchorPoint;
  const visibleById = new Map(context.visibleThreads.map((thread, index) => [thread.person.id, { thread, index }]));
  const recentTrailIds = traceTrailIds.filter((personId) => personId !== activePerson.id).slice(-3);

  inductees.forEach((person, index) => {
    const current = baseMode.positions.get(person.id) ?? fallbackPosition(index, inductees.length);

    if (person.id === activePerson.id) {
      positions.set(person.id, {
        ...current,
        x: anchor.x,
        y: anchor.y,
        size: layout.trace.anchorSize,
        z: 2600,
        delay: 0,
        emphasis: true,
        focused: true,
        muted: false,
      });
      return;
    }

    const visible = visibleById.get(person.id);
    if (visible) {
      const orbit = traceOrbitAnchors[visible.index % traceOrbitAnchors.length];
      const reason = visible.thread.reasons[0];
      const relatedX = clamp(orbit.x + wobble(person.id, 131, -1.1, 1.1), 8, 92);
      const relatedY = clamp(orbit.y + wobble(person.name, 137, -1, 1), 13, 79);
      positions.set(person.id, {
        ...current,
        x: relatedX,
        y: relatedY,
        size: visible.index < 4 ? layout.trace.relatedPrimarySize : layout.trace.relatedSecondarySize,
        z: 1900 - visible.index,
        delay: staggerDelay(visible.index),
        emphasis: true,
        muted: false,
      });
      lines.push({
        id: `${activePerson.id}-${context.traceFocusKey || 'direct'}-${person.id}`,
        label: relationshipLineLabel(reason, activePerson.name),
        detail: reason ? relationshipSupportLabel(reason, activePerson.name) : undefined,
        provenance: reason?.provenance ?? 'curated',
        relationshipType: reason?.type,
        role: 'relationship',
        x1: anchor.x,
        y1: anchor.y,
        x2: relatedX,
        y2: relatedY,
      });
      return;
    }

    const trailIndex = recentTrailIds.indexOf(person.id);
    if (trailIndex >= 0) {
      const continuity = traceContinuityAnchors[trailIndex % traceContinuityAnchors.length];
      positions.set(person.id, {
        ...current,
        x: clamp(continuity.x + wobble(person.id, 157, -0.9, 0.9), 8, 92),
        y: clamp(continuity.y + wobble(person.name, 159, -0.75, 0.75), 13, layout.trace.yMax),
        size: context.mode === 'direct' ? layout.trace.relatedSecondarySize : layout.trace.trailSize,
        z: 1760 - trailIndex,
        delay: staggerDelay(trailIndex + 4),
        emphasis: true,
        muted: false,
      });
      return;
    }

    const perimeter = tracePerimeterPosition(index, person, current, layout);
    positions.set(person.id, {
      ...current,
      x: perimeter.x,
      y: perimeter.y,
      size: perimeter.size,
      z: 18 + (index % 8),
      delay: Math.min(current.delay, 140),
      emphasis: false,
      muted: true,
    });
  });

  return {
    ...baseMode,
    id: traceModeId(context),
    title: 'TRACES',
    subtitle: traceModeSubtitle(context),
    positions,
    labels: buildTraceLabels(context, lines),
    lines: [
      ...buildTraceTrailLines(context, positions, traceTrailIds),
      ...lines,
    ],
  };
}

function buildTraceTrailLines(context: TraceContext, positions: Map<string, PortraitPosition>, traceTrailIds: string[]): HallLine[] {
  if (traceTrailIds.length < 2) return [];

  const trailLabel = context.mode === 'direct'
    ? 'YOU ARE HERE'
    : context.mode === 'concept'
    ? context.activeConcept?.lens.label.toUpperCase() ?? 'FOLLOW THE TRACE'
    : context.mode === 'place'
      ? context.placeFocus.label.toUpperCase()
      : '';
  const relationshipType: RelationshipType | undefined = context.mode === 'concept'
    ? 'shared_theme'
    : context.mode === 'place'
      ? 'related_place'
      : undefined;
  const ids = traceTrailIds.slice(-5);
  const lines: HallLine[] = [];

  ids.forEach((personId, index) => {
    if (index === 0) return;
    const previousId = ids[index - 1];
    const previous = positions.get(previousId);
    const current = positions.get(personId);
    if (!previous || !current) return;

    lines.push({
      id: `trace-trail-${context.traceFocusKey || 'direct'}-${previousId}-${personId}-${index}`,
      label: index === ids.length - 1 ? trailLabel : '',
      detail: '',
      provenance: 'curated',
      relationshipType,
      role: 'trail',
      x1: previous.x,
      y1: previous.y,
      x2: current.x,
      y2: current.y,
    });
  });

  return lines;
}

const traceAnchorPoint = { x: 42, y: 46 };

const traceOrbitAnchors = [
  { x: 22, y: 28 },
  { x: 35, y: 21 },
  { x: 24, y: 64 },
  { x: 58, y: 68 },
  { x: 64, y: 29 },
  { x: 70, y: 55 },
];

const traceContinuityAnchors = [
  { x: 50, y: 73 },
  { x: 32, y: 75 },
  { x: 56, y: 18 },
];

const tracePerimeterSlots = [
  { x: 8, y: 13 },
  { x: 17, y: 10 },
  { x: 30, y: 9 },
  { x: 48, y: 8 },
  { x: 66, y: 9 },
  { x: 82, y: 11 },
  { x: 93, y: 15 },
  { x: 95, y: 31 },
  { x: 94, y: 51 },
  { x: 91, y: 70 },
  { x: 78, y: 80 },
  { x: 62, y: 82 },
  { x: 43, y: 82 },
  { x: 25, y: 80 },
  { x: 10, y: 72 },
  { x: 6, y: 54 },
  { x: 6, y: 35 },
];

function tracePerimeterPosition(index: number, person: Inductee, current: PortraitPosition, layout: HallLayoutMetrics) {
  const slot = tracePerimeterSlots[index % tracePerimeterSlots.length];
  const band = Math.floor(index / tracePerimeterSlots.length);
  return {
    x: clamp(slot.x + wobble(person.id, 149, -1.5, 1.5), 4, 96),
    y: clamp(slot.y + band * 1.8 + wobble(person.name, 151, -1.1, 1.1), 6, layout.trace.yMax),
    size: Math.min(current.size, band < 2 ? layout.trace.perimeterNearSize : layout.trace.perimeterFarSize),
  };
}

function traceModeId(context: TraceContext) {
  if (context.mode === 'concept') return `traces-concept-${context.activeConcept?.lens.id ?? 'unknown'}`;
  if (context.mode === 'place') return `traces-place-${context.placeFocus.key || 'unknown'}`;
  return 'traces-direct';
}

function traceModeSubtitle(context: TraceContext) {
  if (!context.activePerson) return 'Touch a portrait to begin';
  if (context.mode === 'concept') return `${context.activeConcept?.lens.label ?? 'Concept'} trace around ${context.activePerson.name}`;
  if (context.mode === 'place') return `${context.placeFocus.label} nationality trace around ${context.activePerson.name}`;
  return `Reviewed ties around ${context.activePerson.name}`;
}

function buildTraceLabels(context: TraceContext, lines: HallLine[]): HallLabel[] {
  if (!context.activePerson) return [];
  const modeLabel = context.mode === 'concept'
    ? context.activeConcept?.lens.label.toUpperCase() ?? 'CONCEPT TRACE'
    : context.mode === 'place'
      ? context.placeFocus.label.toUpperCase()
      : 'DIRECT TIES';
  const placeLabels = tracePlaceLabels(context);

  const labels: HallLabel[] = [];

  if (context.mode !== 'direct') {
    labels.push({
      id: 'trace-mode-label',
      text: modeLabel,
      detail: context.mode === 'concept' ? 'FOLLOW THE TRACE' : 'NATIONALITY / HERITAGE',
      x: 82,
      y: 18,
    });
  }

  labels.push(...placeLabels);
  return labels;
}

function tracePlaceLabels(context: TraceContext): HallLabel[] {
  if (context.mode === 'place' && context.placeFocus.kind !== 'all') {
    const countries = context.placeFocus.countries.slice(0, 3);
    return countries.map((country, index) => ({
      id: `trace-place-${country.id}`,
      text: country.label.toUpperCase(),
      detail: 'CONNECTED HERITAGE',
      x: [18, 82, 72][index] ?? 82,
      y: [18, 74, 13][index] ?? 74,
    }));
  }

  const activePlaces = context.geography.countries
    .filter((country) => country.people.some((person) => person.id === context.activePerson?.id))
    .slice(0, 2);

  return activePlaces.map((country, index) => ({
    id: `trace-active-place-${country.id}`,
    text: country.label.toUpperCase(),
    detail: `CONNECTED TO ${country.label.toUpperCase()}`,
    x: index === 0 ? 17 : 82,
    y: index === 0 ? 18 : 74,
  }));
}

function applyHallFocus(
  mode: HallMode,
  inductees: Inductee[],
  relationships: RelationshipRecord[],
  focusedPersonId: string,
  layout: HallLayoutMetrics,
): HallMode {
  if (!focusedPersonId) return mode;
  const focused = inductees.find((person) => person.id === focusedPersonId);
  if (!focused) return mode;

  const relatedIds = relatedPersonIdsForFocus(focused, inductees, relationships);
  const relatedPeople = inductees.filter((person) => relatedIds.has(person.id)).slice(0, focusRelatedAnchors.length);
  const positions = new Map<string, PortraitPosition>();
  const center = {
    x: layout.tier === 'compact' ? 31 : 34,
    y: clamp(45, layout.portrait.yMin + 8, layout.portrait.yMax - 8),
  };

  inductees.forEach((person, index) => {
    const current = mode.positions.get(person.id) ?? fallbackPosition(index, inductees.length);

    if (person.id === focusedPersonId) {
      positions.set(person.id, {
        ...current,
        x: center.x,
        y: center.y,
        size: Math.max(current.size, layout.portrait.focusSize),
        z: 2400,
        delay: 0,
        emphasis: true,
        focused: true,
        muted: false,
      });
      return;
    }

    const relatedIndex = relatedPeople.findIndex((relatedPerson) => relatedPerson.id === person.id);
    if (relatedIndex >= 0) {
      const anchor = focusRelatedAnchors[relatedIndex];
      positions.set(person.id, {
        ...current,
        x: clamp(anchor.x + wobble(person.id, 71, -1.4, 1.4), 7, 93),
        y: clamp(anchor.y + wobble(person.name, 73, -1.1, 1.1), layout.portrait.yMin, layout.portrait.yMax),
        size: Math.max(Math.min(current.size + 5, layout.portrait.relatedMaxSize), layout.portrait.relatedMinSize),
        z: 1700 - relatedIndex,
        delay: staggerDelay(relatedIndex),
        emphasis: true,
        muted: false,
      });
      return;
    }

    const openPosition = movePortraitAwayFromFocus(current, index, center);
    positions.set(person.id, {
      ...current,
      x: openPosition.x,
      y: openPosition.y,
      size: Math.min(current.size, openPosition.shifted ? layout.portrait.mutedMaxSize : layout.portrait.relatedMinSize),
      z: Math.min(current.z, 28),
      delay: Math.min(current.delay, 120),
      emphasis: false,
      muted: true,
    });
  });

  return {
    ...mode,
    id: `${mode.id}-focus`,
    title: 'PORTRAITS',
    subtitle: `${focused.name} focused in the same portrait wall`,
    positions,
    labels: [
      {
        id: `focus-${focused.id}`,
        text: focused.classYear ? `CLASS ${focused.classYear}` : 'HONORED LIFE',
        detail: relatedPeople.length > 0 ? `${relatedPeople.length} nearby records` : undefined,
        x: 36,
        y: 72,
      },
      ...mode.labels.slice(0, 4),
    ],
  };
}

const focusRelatedAnchors = [
  { x: 18, y: 31 },
  { x: 19, y: 59 },
  { x: 34, y: 21 },
  { x: 56, y: 24 },
  { x: 57, y: 66 },
  { x: 36, y: 73 },
  { x: 71, y: 42 },
  { x: 23, y: 74 },
];

function movePortraitAwayFromFocus(position: PortraitPosition, index: number, center: { x: number; y: number }) {
  const inFocusRoom = position.x > 20 && position.x < 86 && position.y > 22 && position.y < 69;
  if (!inFocusRoom) return { x: position.x, y: position.y, shifted: false };

  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const x = horizontal
    ? (dx < 0 ? 7 + (index % 5) * 2.4 : 88 + (index % 4) * 1.7)
    : clamp(position.x + (dx < 0 ? -15 : 22), 7, 94);
  const y = horizontal
    ? clamp(position.y + (dy < 0 ? -6 : 7), 10, 81)
    : (dy < 0 ? 10 + (index % 4) * 3.2 : 73 + (index % 4) * 2.2);

  return {
    x: clamp(x + wobble(`${index}`, 89, -0.9, 0.9), 6, 94),
    y: clamp(y + wobble(`${index}`, 97, -0.7, 0.7), 9, 82),
    shifted: true,
  };
}

function relatedPersonIdsForFocus(focused: Inductee, inductees: Inductee[], relationships: RelationshipRecord[]) {
  const byId = new Map(inductees.map((person) => [person.id, person]));
  const relatedIds = new Set(focused.relatedIds.filter((id) => byId.has(id) && id !== focused.id));

  relationships
    .filter((relationship) => relationship.provenance !== 'inferred')
    .forEach((relationship) => {
      if (relationship.sourcePersonId === focused.id && byId.has(relationship.targetEntityId)) {
        relatedIds.add(relationship.targetEntityId);
      }
      if (relationship.targetEntityId === focused.id && byId.has(relationship.sourcePersonId)) {
        relatedIds.add(relationship.sourcePersonId);
      }
    });

  inductees.forEach((candidate) => {
    if (candidate.id === focused.id) return;
    if (focused.classYear && candidate.classYear === focused.classYear) relatedIds.add(candidate.id);
    if (focused.inductedBy && candidate.inductedBy && normalizeText(candidate.inductedBy) === normalizeText(focused.inductedBy)) {
      relatedIds.add(candidate.id);
    }
  });

  return relatedIds;
}

function parseHallYear(value: string) {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

function buildHallModes(inductees: Inductee[], layout: HallLayoutMetrics) {
  if (inductees.length === 0) return [emptyMode];

  const modes: HallMode[] = [
    buildPortraitWallMode(inductees, 'chronicle', layout),
    buildPortraitWallMode(inductees, 'wall-memory', layout),
    buildTimelineMode(inductees, layout),
  ];

  const contributionMode = buildExplicitTagMode({
    id: 'contribution',
    title: 'AREAS OF CONTRIBUTION',
    subtitle: 'Grouped by curated contribution metadata',
    inductees,
    layout,
    tagSource: (inductee) => explicitTags(inductee.themeTags, inductee.themeTagsSource),
  });
  if (contributionMode) modes.push(contributionMode);

  const communityMode = buildExplicitTagMode({
    id: 'community',
    title: 'COMMUNITY TIES',
    subtitle: 'Grouped by documented community affiliations',
    inductees,
    layout,
    tagSource: (inductee) => inductee.communityTags,
  });
  if (communityMode) modes.push(communityMode);

  const geographyMode = buildExplicitTagMode({
    id: 'geography',
    title: 'NATIONALITY TRACES',
    subtitle: 'Grouped by nationality and heritage metadata',
    inductees,
    layout,
    tagSource: (inductee) => isPresentationReadyGeography(inductee) ? inductee.countryTags : [],
  });
  if (geographyMode) modes.push(geographyMode);

  return modes;
}

function buildPortraitWallMode(inductees: Inductee[], variant: 'chronicle' | 'wall-memory', layout: HallLayoutMetrics): HallMode {
  const positions = new Map<string, PortraitPosition>();
  const count = inductees.length;
  const columns = layout.portrait.columns;
  const rows = Math.ceil(count / columns);
  const xMin = layout.portrait.xMin;
  const xMax = layout.portrait.xMax;
  const yMin = layout.portrait.yMin;
  const yMax = layout.portrait.yMax;
  const arranged = variant === 'wall-memory' ? sortByPhysicalWallMemory(inductees) : inductees;

  arranged.forEach((inductee, slotIndex) => {
    const row = Math.floor(slotIndex / columns);
    const column = slotIndex % columns;
    const xRatio = columns <= 1 ? 0.5 : column / (columns - 1);
    const yRatio = rows <= 1 ? 0.5 : row / (rows - 1);
    const rowOffset = variant === 'wall-memory'
      ? ((row % 2 === 0 ? 1 : -1) * 1.35)
      : ((row % 3) - 1) * 0.7;
    const classBeat = inductee.classYear ? (inductee.classYear % 7) * 0.18 : 0;
    const size = portraitSize(inductee, slotIndex + (variant === 'wall-memory' ? 41 : 0), layout.portrait.minSize, layout.portrait.maxSize);
    const baseX = xMin + (xMax - xMin) * xRatio + rowOffset + wobble(inductee.id, 101, -0.55, 0.55);
    const baseY = yMin + (yMax - yMin) * yRatio + classBeat + wobble(inductee.name, 103, -0.45, 0.45);
    const composition = portraitWallComposition({
      column,
      columns,
      inductee,
      row,
      rows,
      slotIndex,
      variant,
      x: baseX,
      y: baseY,
    });

    const strongFrame = inductee.featured || inductee.featuredCandidate || slotIndex % 6 === 0 || slotIndex % 19 === 0;
    const anchorBoost = inductee.featured || inductee.featuredCandidate
      ? 10
      : slotIndex % 29 === 0
        ? 8
        : slotIndex % 6 === 0
          ? 5
          : 0;
    const resolvedSize = strongFrame
      ? clamp(size + composition.size + anchorBoost, layout.portrait.emphasisMinSize, layout.portrait.emphasisMaxSize)
      : clamp(size + composition.size - 6, layout.portrait.quietMinSize, layout.portrait.quietMaxSize);

    positions.set(inductee.id, {
      x: clamp(baseX + composition.x, layout.portrait.xMin - 2, layout.portrait.xMax + 1.5),
      y: clamp(baseY + composition.y, layout.portrait.yMin - 3, layout.portrait.yMax + 3),
      size: resolvedSize,
      z: 80 + Math.round(resolvedSize) + (inductee.featured ? 120 : inductee.featuredCandidate ? 60 : 0),
      delay: staggerDelay(slotIndex),
      emphasis: strongFrame,
      muted: !strongFrame,
    });
  });

  return {
    id: variant === 'chronicle' ? 'portrait-wall-chronicle' : 'portrait-wall-memory',
    title: 'PORTRAITS',
    subtitle: variant === 'chronicle'
      ? `${inductees.length} stable portrait frames arranged by class year`
      : 'Same portrait frames subtly regrouped by physical-wall records',
    positions,
    labels: buildPortraitWallLabels(),
  };
}

function portraitWallComposition({
  column,
  columns,
  inductee,
  row,
  rows,
  slotIndex,
  variant,
  x,
  y,
}: {
  column: number;
  columns: number;
  inductee: Inductee;
  row: number;
  rows: number;
  slotIndex: number;
  variant: 'chronicle' | 'wall-memory';
  x: number;
  y: number;
}) {
  let offsetX = 0;
  let offsetY = 0;
  let sizeOffset = 0;

  const inTitleVoid = x > 29 && x < 63 && y > 24 && y < 55;
  if (inTitleVoid) {
    offsetX += x < 46 ? -2.8 : 3.2;
    offsetY += y < 39 ? -2.1 : 2.6;
    sizeOffset -= 4;
  }

  const edgeColumn = column < 2 || column > columns - 3;
  if (edgeColumn) {
    offsetX += column < 2 ? -1.2 : 1.2;
    sizeOffset += variant === 'wall-memory' ? 2 : 0;
  }

  if (variant === 'wall-memory') {
    const physicalPanelStep = inductee.physicalPanel ? (hashNumber(inductee.physicalPanel) % 3) - 1 : 0;
    offsetX += physicalPanelStep * 0.7;
    offsetY += ((row % 4) - 1.5) * 0.5;
    if (slotIndex % 17 === 0) sizeOffset += 4;
  } else {
    const classDecade = inductee.classYear ? Math.floor(inductee.classYear / 10) : 0;
    offsetX += ((classDecade % 3) - 1) * 0.55;
    if (row > 0 && row < rows - 1 && column % 5 === 0) offsetY += 1.5;
    if (slotIndex % 31 === 0) sizeOffset += 3;
  }

  return { x: offsetX, y: offsetY, size: sizeOffset };
}

function galleryColumnsForCount(count: number) {
  if (count >= 104) return 14;
  if (count >= 84) return 12;
  if (count >= 60) return 10;
  if (count >= 36) return 8;
  return Math.max(4, Math.ceil(Math.sqrt(count)));
}

function sortByPhysicalWallMemory(inductees: Inductee[]) {
  return [...inductees].sort((a, b) => {
    return physicalWallRank(a).localeCompare(physicalWallRank(b))
      || (a.classYear ?? Number.MAX_SAFE_INTEGER) - (b.classYear ?? Number.MAX_SAFE_INTEGER)
      || a.sortName.localeCompare(b.sortName)
      || a.name.localeCompare(b.name);
  });
}

function physicalWallRank(inductee: Inductee) {
  const panel = inductee.physicalPanel || 'zz';
  const row = String(inductee.physicalRow ?? 99).padStart(2, '0');
  const column = String(inductee.physicalColumn ?? 99).padStart(2, '0');
  return `${panel}:${row}:${column}:${inductee.sortName}`;
}

function buildPortraitWallLabels(): HallLabel[] {
  return [];
}

function buildLegacyChronology(inductees: Inductee[], layout: HallLayoutMetrics): LegacyChronology {
  const classGroups = [...groupByYear(inductees).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, people]) => ({
      key: String(year),
      year,
      label: String(year),
      people: [...people].sort((a, b) => a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name)),
    }));
  const pendingPeople = inductees
    .filter((inductee) => typeof inductee.classYear !== 'number')
    .sort((a, b) => a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name));
  const rawGroups = pendingPeople.length > 0
    ? [...classGroups, { key: 'pending', year: null, label: 'PENDING', people: pendingPeople }]
    : classGroups;
  const count = Math.max(rawGroups.length, 1);
  const spacing = count <= 1 ? 0 : 92 / (count - 1);
  const fieldScale = layout.legacy.fieldScale;
  const groups = rawGroups.map((group, index) => ({
    ...group,
    x: count <= 1 ? 50 : 4 + index * spacing,
    spacing: spacing || 18,
  }));
  const years = groups.map((group) => group.year).filter((year): year is number => year !== null);

  return {
    groups,
    years,
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
    fieldScale,
  };
}

function resolveLegacyActiveYear(chronology: LegacyChronology, timelineYear: string, focusedPerson: Inductee | null) {
  const requestedYear = parseHallYear(timelineYear);
  if (requestedYear !== null && chronology.years.includes(requestedYear)) return requestedYear;
  if (focusedPerson?.classYear && chronology.years.includes(focusedPerson.classYear)) return focusedPerson.classYear;
  return chronology.firstYear;
}

function legacyGroupForYear(chronology: LegacyChronology, year: number | null) {
  if (year === null) return chronology.groups[0] ?? null;
  return chronology.groups.find((group) => group.year === year) ?? null;
}

function buildLegacyHallMode(
  inductees: Inductee[],
  chronology: LegacyChronology,
  activeYear: number | null,
  focusedPersonId: string,
  layout: HallLayoutMetrics,
): HallMode {
  const positions = new Map<string, PortraitPosition>();
  const focused = focusedPersonId ? inductees.find((person) => person.id === focusedPersonId) ?? null : null;
  const focusedGroup = focused ? chronology.groups.find((group) => group.people.some((person) => person.id === focused.id)) ?? null : null;
  const labels: HallLabel[] = [];
  const activeGroupIndex = activeYear === null ? -1 : chronology.groups.findIndex((candidate) => candidate.year === activeYear);

  chronology.groups.forEach((group, groupIndex) => {
    const groupActive = group.year !== null && group.year === activeYear;
    const groupFocused = focusedGroup?.key === group.key;
    const distanceFromActiveGroup = activeGroupIndex >= 0 ? Math.abs(groupIndex - activeGroupIndex) : Number.POSITIVE_INFINITY;
    const upperLabelY = Math.max(layout.safe.topPct + 4, layout.legacy.rowTopY - 17);
    const lowerLabelY = Math.min(layout.legacy.rowBottomY + 18, 100 - layout.safe.bottomPct - 8);
    const labelY = groupActive ? lowerLabelY : groupIndex % 2 === 0 ? upperLabelY : lowerLabelY;
    labels.push({
      id: `legacy-year-${group.key}`,
      text: group.label,
      detail: group.year === null ? 'CLASS' : groupActive ? 'ACTIVE CLASS' : 'CLASS',
      priority: legacyLabelPriority(groupIndex, distanceFromActiveGroup, groupActive || groupFocused, layout),
      x: group.x,
      y: labelY,
    });

    const people = group.people;
    const rows = people.length <= 1 ? 1 : 2;
    const columns = Math.max(1, Math.ceil(people.length / rows));
    const localStep = clamp(group.spacing * 0.23, layout.legacy.localStepMin, layout.legacy.localStepMax);
    const focusedIndex = focused ? people.findIndex((person) => person.id === focused.id) : -1;
    const focusedColumn = focusedIndex >= 0 ? Math.floor(focusedIndex / rows) : -1;

    people.forEach((inductee, personIndex) => {
      const row = rows === 1 ? 0 : personIndex % rows;
      const column = rows === 1 ? personIndex : Math.floor(personIndex / rows);
      const xOffset = (column - (columns - 1) / 2) * localStep;
      const yBase = rows === 1
        ? 45
        : row === 0
          ? layout.legacy.rowTopY
          : layout.legacy.rowBottomY;
      const isFocused = inductee.id === focusedPersonId;
      const focusColumnDistance = focusedColumn < 0 ? Number.POSITIVE_INFINITY : Math.abs(column - focusedColumn);
      const focusPush = groupFocused && !isFocused && focusColumnDistance <= 1
        ? (column <= focusedColumn ? -1 : 1) * clamp(group.spacing * 0.32, 1.35, 2.75)
        : 0;
      const size = isFocused
        ? layout.legacy.focusedSize
        : groupFocused
          ? layout.legacy.focusedGroupSize
          : groupActive
            ? layout.legacy.activeSize
            : layout.legacy.standardSize;

      positions.set(inductee.id, {
        x: clamp(group.x + xOffset + focusPush + wobble(inductee.id, 211, -0.18, 0.18), 1.5, 98.5),
        y: clamp((isFocused ? 45 : yBase) + wobble(inductee.name, 213, -0.65, 0.65), layout.portrait.yMin, layout.legacy.rowBottomY + 12),
        size,
        z: isFocused ? 2600 : groupFocused ? 950 - personIndex : groupActive ? 420 - personIndex : 120 - Math.min(groupIndex, 80),
        delay: staggerDelay(groupIndex + personIndex),
        emphasis: isFocused || groupFocused || groupActive,
        focused: isFocused,
        muted: Boolean(focusedPersonId && !groupFocused && !groupActive),
      });
    });
  });

  return {
    id: focusedPersonId ? 'legacies-chronology-focus' : 'legacies-chronology',
    title: chronology.firstYear && chronology.lastYear ? `${chronology.firstYear} - ${chronology.lastYear}` : 'LEGACIES',
    subtitle: focused
      ? `${focused.name} held in the class chronology`
      : activeYear
        ? `Class of ${activeYear} centered in the Hall chronology`
        : 'Portrait frames arranged by induction class',
    positions,
    labels,
  };
}

function buildTimelineMode(inductees: Inductee[], layout: HallLayoutMetrics, activeYear: number | null = null): HallMode {
  return buildLegacyHallMode(inductees, buildLegacyChronology(inductees, layout), activeYear, '', layout);
}

function buildExplicitTagMode({
  id,
  title,
  subtitle,
  inductees,
  layout,
  tagSource,
}: {
  id: string;
  title: string;
  subtitle: string;
  inductees: Inductee[];
  layout: HallLayoutMetrics;
  tagSource: (inductee: Inductee) => string[];
}): HallMode | null {
  const buckets = new Map<string, Inductee[]>();

  for (const inductee of inductees) {
    const tag = tagSource(inductee)[0];
    if (!tag) continue;
    const bucket = buckets.get(tag) ?? [];
    bucket.push(inductee);
    buckets.set(tag, bucket);
  }

  const groups = [...buckets.entries()]
    .filter(([, people]) => people.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 6);

  if (groups.length < 3) return null;

  const positionedIds = new Set<string>();
  const positions = new Map<string, PortraitPosition>();
  const labels: HallLabel[] = [];
  const anchors = groupAnchors(groups.length);

  groups.forEach(([label, people], groupIndex) => {
    const anchor = anchors[groupIndex];
    labels.push({ id: `${id}-${label}`, text: label.toUpperCase(), detail: `${people.length}`, x: anchor.x, y: anchor.labelY });

    people.forEach((inductee, personIndex) => {
      positionedIds.add(inductee.id);
      const orbit = Math.sqrt((personIndex + 1) / people.length);
      const angle = (personIndex * 151 + groupIndex * 43) * Math.PI / 180;
      const size = portraitSize(
        inductee,
        personIndex + groupIndex,
        layout.portrait.relatedMinSize,
        Math.max(layout.portrait.relatedMaxSize, layout.portrait.emphasisMaxSize),
      );

      positions.set(inductee.id, {
        x: clamp(anchor.x + Math.cos(angle) * anchor.rx * orbit, 6, 94),
        y: clamp(anchor.y + Math.sin(angle) * anchor.ry * orbit, layout.portrait.yMin, layout.portrait.yMax),
        size,
        z: 60 + Math.round(size),
        delay: staggerDelay(personIndex + groupIndex),
        emphasis: personIndex < 2,
      });
    });
  });

  inductees
    .filter((inductee) => !positionedIds.has(inductee.id))
    .forEach((inductee, index, ungrouped) => {
      const position = fallbackPosition(index, ungrouped.length || 1);
      positions.set(inductee.id, {
        ...position,
        size: Math.min(position.size, layout.portrait.relatedMaxSize),
        y: clamp(position.y, layout.portrait.yMin, layout.portrait.yMax),
        z: 20,
        emphasis: false,
      });
    });

  return { id, title, subtitle, positions, labels };
}

function buildLatestClass(inductees: Inductee[]): LatestClass | null {
  const groups = groupByYear(inductees);
  const latestYear = Math.max(...[...groups.keys()]);
  if (!Number.isFinite(latestYear)) return null;

  const latestInductees = [...(groups.get(latestYear) ?? [])].sort((a, b) => {
    return a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
  });
  if (latestInductees.length === 0) return null;

  const storyCount = latestInductees.filter((inductee) => {
    return Boolean((inductee.storySummary || inductee.bioText).trim());
  }).length;

  return {
    year: latestYear,
    inductees: latestInductees,
    stats: {
      people: latestInductees.length,
      stories: storyCount || latestInductees.length,
      cities: latestInductees.length > 0 ? 1 : 0,
    },
  };
}

function sortInductees(inductees: Inductee[]) {
  return [...inductees].sort((a, b) => {
    const yearA = a.classYear ?? Number.MAX_SAFE_INTEGER;
    const yearB = b.classYear ?? Number.MAX_SAFE_INTEGER;
    return yearA - yearB || a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
  });
}

function selectHallPeople(inductees: Inductee[], lens: HallLens, focusedPersonId: string, portraitLimit: number) {
  if (lens !== 'portraits') return inductees;
  const limit = Math.round(clamp(portraitLimit, 24, Math.max(24, inductees.length)));
  if (inductees.length <= limit) return inductees;

  const visible = inductees.slice(0, limit);
  if (!focusedPersonId || visible.some((person) => person.id === focusedPersonId)) return visible;

  const focusedPerson = inductees.find((person) => person.id === focusedPersonId);
  if (!focusedPerson) return visible;
  return [...visible.slice(0, Math.max(0, limit - 1)), focusedPerson];
}

function groupByYear(inductees: Inductee[]) {
  const groups = new Map<number, Inductee[]>();
  for (const inductee of inductees) {
    if (typeof inductee.classYear !== 'number') continue;
    const group = groups.get(inductee.classYear) ?? [];
    group.push(inductee);
    groups.set(inductee.classYear, group);
  }
  return groups;
}

function buildHallYearRange(inductees: Inductee[]) {
  const years = [...groupByYear(inductees).keys()].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  if (!firstYear || !lastYear) return 'CIHOF';
  return firstYear === lastYear ? String(firstYear) : `${firstYear} - ${lastYear}`;
}

function buildHallVocabulary(inductees: Inductee[]) {
  const counts = new Map<string, number>();
  for (const inductee of inductees) {
    const supportedTags = [
      ...explicitTags(inductee.themeTags, inductee.themeTagsSource),
      ...inductee.communityTags,
    ];

    for (const tag of supportedTags) {
      const label = tag.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([label]) => label.toUpperCase());
}

function explicitTags(tags: string[], source: string) {
  return explicitSources.has(source.toLowerCase()) ? tags : [];
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cycleImage(current: number | null, total: number, direction: -1 | 1) {
  if (current === null || total <= 0) return null;
  return (current + direction + total) % total;
}

function useReducedMotion(animationIntensity: KioskSettings['motion']) {
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
