import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { ClevelandTraceBackdrop, ClevelandTraceField } from '../../components/ClevelandTrace';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { PortraitFrame } from '../../components/PortraitFrame';
import { defaultKioskSettings, type KioskSettings } from '../../app/kioskSettings';
import type { ColorMode } from '../../app/useColorMode';
import { useStoryLenses } from '../../data/storyLenses';
import { useCityQuestion } from '../../data/useCityQuestion';
import { useMediaManifest, useMediaRecordMap } from '../../data/useMediaManifest';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import type { HallLens, HallLinkedPath, Inductee, RelationshipRecord } from '../../data/types';
import { buildPersonGallery, canonicalContinuationUrl, mediaAvailability } from '../inductee-detail/personDetailModel';
import { CityQuestionPrompt, CityQuestionResults } from './CityQuestion';
import {
  LegacyControls,
  JourneyGuidePanel,
  LensStatusRail,
  LatestClassSequence,
  LivingHallPlaceholders,
  PersonFocusActionPanel,
  PortraitFocusCard,
  VisitCollectionTray,
} from './LivingHallPanels';
import { eventTargetInsideContentWindow } from './livingHallDom';
import { buildVisitSessionUrl, fullBiographyText } from './livingHallContent';
import { buildCuratedJourneyPaths, buildVisitJourneyInsight, strongestJourneyConnection } from './livingHallJourney';
import { buildContextualNextSteps } from './livingHallNextSteps';
import {
  buildHallModes,
  buildHallVocabulary,
  buildHallYearRange,
  buildLatestClass,
  buildLegacyChronology,
  buildTraceContext,
  hallDisplayTitle,
  legacyGroupForYear,
  resolveLegacyActiveYear,
  selectHallMode,
  selectHallPeople,
  sortInductees,
  traceChooserOptions,
} from './livingHallModes';
import {
  actionPanelPlacement,
  fallbackPosition,
  focusCardPlacement,
  foregroundLabelRects,
  hallLabelCollisionRects,
  hallLayoutStyle,
  labelOverlapsForeground,
  labelStyle,
  portraitCategoryForLens,
  portraitFrameAspect,
  portraitFrameState,
  portraitLensBadge,
  portraitStyle,
  shouldRenderHallLabel,
  shouldShowFrameRecord,
  solveHallLayout,
  type HallPersonAction,
} from './livingHallLayout';
import { ProjectionGeometryLayer, type VisitJourneyWallStep } from './ProjectionGeometryLayer';
import {
  stopHallFocusMedia,
  useCityResultsAttract,
  useEscapeToCloseFocus,
  useHallLayoutViewport,
  useHallModeStep,
  useLatestClassSequence,
  useReducedMotion,
  useResetFocusedPersonExperience,
  useTraceTrail,
  useVisitQrAvailability,
} from './livingHallRuntime';
import { useLegacyTimelineNavigation } from './useLegacyTimelineNavigation';

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
  linkedPath?: HallLinkedPath | null;
  visitCollectionIds?: string[];
  colorMode?: ColorMode;
  onToggleColorMode?: () => void;
  onLensChange?: (lens: HallLens) => void;
  onReset?: () => void;
  onEngage?: () => void;
  onCloseFocus?: () => void;
  onTimelineYearChange?: (year: string) => void;
  onTraceFocusChange?: (focusKey: string) => void;
  onExplorePath?: (path: HallLinkedPath) => void;
  onSelect: (inductee: Inductee) => void;
  onAddVisitCollectionPerson?: (personId: string) => void;
  onRemoveVisitCollectionPerson?: (personId: string) => void;
  onClearVisitCollection?: () => void;
};

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
  linkedPath = null,
  visitCollectionIds = [],
  colorMode = 'light',
  onToggleColorMode,
  onLensChange,
  onReset,
  onEngage,
  onCloseFocus,
  onTimelineYearChange,
  onTraceFocusChange,
  onExplorePath,
  onSelect,
  onAddVisitCollectionPerson,
  onRemoveVisitCollectionPerson,
  onClearVisitCollection,
}: LivingHallViewProps) {
  const [activePersonAction, setActivePersonAction] = useState<HallPersonAction>('overview');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [visitQrOpen, setVisitQrOpen] = useState(false);
  const [visitJourneyOpen, setVisitJourneyOpen] = useState(false);
  const [visitJourneyIndex, setVisitJourneyIndex] = useState(0);
  const [indexQuery, setIndexQuery] = useState('');
  const [activeIndexLetter, setActiveIndexLetter] = useState('A');
  const [indexVisitOpen, setIndexVisitOpen] = useState(false);
  const indexViewportRef = useRef<HTMLDivElement | null>(null);
  const layoutViewport = useHallLayoutViewport();
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
  const journeyPaths = useMemo(() => buildCuratedJourneyPaths(allPeople), [allPeople]);
  const activeJourneyPath = linkedPath?.lens === 'journeys' ? linkedPath : null;
  const people = useMemo(
    () => selectHallPeople(allPeople, lens, focusedPersonId, settings.portraitLimit),
    [allPeople, focusedPersonId, lens, settings.portraitLimit],
  );
  const indexedPeople = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name)), [people]);
  const indexMatches = useMemo(() => {
    const query = indexQuery.trim().toLocaleLowerCase();
    if (!query) return indexedPeople;
    return indexedPeople.filter((person) => [
      person.name,
      String(person.classYear ?? ''),
      ...person.countryTags,
      ...person.communityTags,
    ].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [indexQuery, indexedPeople]);
  const indexMatchIds = useMemo(() => new Set(indexMatches.map((person) => person.id)), [indexMatches]);
  const indexLetters = useMemo(() => new Set(indexedPeople.map((person) => person.name[0]?.toUpperCase())), [indexedPeople]);
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
  const [step, setStep] = useHallModeStep({
    focusedPersonId,
    modesLength: modes.length,
    settings,
  });
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
  const linkedPersonIds = useMemo(() => new Set(linkedPath?.personIds ?? []), [linkedPath]);
  const linkedPathUnsavedIds = useMemo(
    () => linkedPath ? linkedPath.personIds.filter((id) => !visitCollectionIds.includes(id)) : [],
    [linkedPath, visitCollectionIds],
  );
  const linkedPathAvailableSaveSlots = Math.max(visitCollectionLimit - visitCollectionPeople.length, 0);
  const linkedPathSaveCount = Math.min(
    linkedPathUnsavedIds.length,
    linkedPathAvailableSaveSlots,
  );
  const contextualNextSteps = useMemo(
    () => buildContextualNextSteps({
      allPeople,
      focusedPerson,
      legacyChronology,
      traceContext,
    }),
    [allPeople, focusedPerson, legacyChronology, traceContext],
  );
  const traceTrailIds = useTraceTrail({
    focusedPersonId,
    lens,
    traceContext,
  });
  const latestClass = useMemo(() => buildLatestClass(people), [people]);
  const latestClassFrame = useLatestClassSequence({
    attractActive,
    latestClass,
    reducedMotion,
    setStep,
  });
  const cityResultsActive = useCityResultsAttract({
    attractActive,
    cityAttract: cityQuestion.config.attract,
    cityQuestionEnabled: cityQuestion.enabled,
    latestClassFrameActive: Boolean(latestClassFrame),
  });
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
      traceTrailIds,
      traceContext,
      legacyChronology,
      activeLegacyYear,
      journeyPaths,
      linkedPath,
      layout: hallLayout,
    }),
    [activeLegacyYear, focusedPersonId, hallLayout, journeyPaths, legacyChronology, lens, linkedPath, modes, people, relationships, step, traceContext, traceTrailIds],
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
  const visitJourneyInsight = useMemo(
    () => buildVisitJourneyInsight(visitCollectionPeople, visitJourneyIndex),
    [visitCollectionPeople, visitJourneyIndex],
  );
  const visitJourneyWallSteps = useMemo(() => {
    if (!visitJourneyOpen || visitCollectionPeople.length === 0) return new Map<string, VisitJourneyWallStep>();

    return new Map(visitCollectionPeople.map((person, index) => {
      const previousPerson = visitCollectionPeople[index - 1] ?? null;
      const connectionLabel = previousPerson
        ? strongestJourneyConnection(previousPerson, person).label
        : 'Start';

      return [person.id, {
        connectionLabel,
        index,
        suggested: visitJourneyInsight.activeSuggestion?.person.id === person.id,
      }];
    }));
  }, [visitCollectionPeople, visitJourneyInsight.activeSuggestion, visitJourneyOpen]);
  const visitSessionUrl = useMemo(
    () => buildVisitSessionUrl({
      focusedPersonId,
      lens,
      savedPeople: visitCollectionPeople,
      timelineYear,
      traceFocusKey,
      visitTitle: visitJourneyInsight.title,
    }),
    [focusedPersonId, lens, timelineYear, traceFocusKey, visitCollectionPeople, visitJourneyInsight.title],
  );
  const focusedFullTextAvailable = focusedPerson ? Boolean(fullBiographyText(focusedPerson)) : false;
  const activeLightboxUrl = lightboxIndex === null ? '' : focusedGallery[lightboxIndex] ?? '';
  const focusContentWindowOpen = Boolean(focusedPerson) && !attractActive;
  const legacyFocusModalOpen = lens === 'legacies' && focusContentWindowOpen;
  const legacyTimeline = useLegacyTimelineNavigation({
    activeYear: activeLegacyYear,
    chronology: legacyChronology,
    focusModalOpen: legacyFocusModalOpen,
    lens,
    timelineYear,
    viewportWidth: hallLayout.viewport.width,
    onTimelineYearChange,
  });
  const cityQuestionTotal = useMemo(() => {
    return cityQuestion.config.options.reduce((total, option) => total + (cityQuestion.counts[option.id] ?? 0), 0);
  }, [cityQuestion.config.options, cityQuestion.counts]);

  useResetFocusedPersonExperience({
    focusedPersonId,
    lens,
    setActivePersonAction,
    setLightboxIndex,
  });
  useVisitQrAvailability({
    attractActive,
    savedPeopleCount: visitCollectionPeople.length,
    setVisitQrOpen,
  });

  useEffect(() => {
    if (visitCollectionPeople.length === 0) {
      setVisitJourneyOpen(false);
      setVisitJourneyIndex(0);
      return;
    }
    if (visitJourneyIndex >= visitCollectionPeople.length) {
      setVisitJourneyIndex(visitCollectionPeople.length - 1);
    }
  }, [visitCollectionPeople.length, visitJourneyIndex]);

  useEffect(() => {
    if (lens !== 'portraits' || !focusedPersonId) return;
    const frame = window.requestAnimationFrame(() => {
      indexViewportRef.current?.querySelector(`[data-transition-person="${CSS.escape(focusedPersonId)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedPersonId, lens]);

  function jumpToIndexLetter(letter: string) {
    setActiveIndexLetter(letter);
    setIndexQuery('');
    window.requestAnimationFrame(() => {
      indexViewportRef.current?.querySelector(`[data-index-letter="${letter}"]`)?.scrollIntoView({ block: 'start' });
    });
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
    if (shouldSelectThroughFocusedContent(event.currentTarget)) return false;

    if (focusContentWindowOpen && !eventTargetInsideContentWindow(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      dismissFocusedContentWindow();
      return true;
    }

    if (lens !== 'legacies') return false;
    const suppressed = legacyTimeline.shouldSuppressTap();
    if (suppressed) {
      event.preventDefault();
      event.stopPropagation();
    }
    return suppressed;
  }

  function shouldSelectThroughFocusedContent(portrait: HTMLButtonElement) {
    if (!focusContentWindowOpen || lens !== 'traces' || activePersonAction !== 'overview') return false;
    if (portrait.classList.contains('living-portrait--focused')) return false;
    return [
      'living-portrait--emphasis',
      'living-portrait--linked',
      'living-portrait--journey-step',
    ].some((className) => portrait.classList.contains(className));
  }

  function setHallPersonAction(action: HallPersonAction) {
    if (action === 'continue' && !focusedContinuationUrl) return;
    if (action === 'watch' && !focusedWatchAvailability?.playable) return;
    if (action === 'text' && !focusedFullTextAvailable) return;
    if (action !== 'watch') stopHallFocusMedia();
    setLightboxIndex(null);
    setActivePersonAction(action);
  }

  useEscapeToCloseFocus({
    activePersonAction,
    focusedPersonId,
    onCloseFocus,
    onReturnToOverview: () => setHallPersonAction('overview'),
  });

  function openTraceChooser() {
    onTraceFocusChange?.('');
  }

  function selectPortrait(inductee: Inductee) {
    if (lens === 'portraits') {
      setIndexVisitOpen(false);
      setActiveIndexLetter(inductee.name[0]?.toUpperCase() || 'A');
    }
    onSelect(inductee);
  }

  function focusVisitJourneyStep(stepIndex: number) {
    const target = visitCollectionPeople[stepIndex];
    if (!target) return;
    setVisitJourneyOpen(true);
    setVisitJourneyIndex(stepIndex);
    selectPortrait(target);
  }

  function startVisitJourney() {
    if (visitCollectionPeople.length === 0) return;
    focusVisitJourneyStep(0);
  }

  function moveVisitJourney(direction: -1 | 1) {
    if (visitCollectionPeople.length === 0) return;
    const nextIndex = (visitJourneyIndex + direction + visitCollectionPeople.length) % visitCollectionPeople.length;
    focusVisitJourneyStep(nextIndex);
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

  function saveLinkedPathToVisit() {
    if (!linkedPath || linkedPathSaveCount <= 0 || !qrEnabled) return;
    onEngage?.();
    linkedPathUnsavedIds.slice(0, linkedPathSaveCount).forEach((personId) => {
      onAddVisitCollectionPerson?.(personId);
    });
  }

  function openCuratedJourney(path: HallLinkedPath) {
    onEngage?.();
    onExplorePath?.(path);
  }

  function saveJourneyPathToVisit(path: HallLinkedPath) {
    if (!qrEnabled) return;
    onEngage?.();
    const availableSlots = Math.max(visitCollectionLimit - visitCollectionPeople.length, 0);
    if (availableSlots <= 0) return;
    const unsavedIds = path.personIds.filter((personId) => !visitCollectionIds.includes(personId));
    unsavedIds.slice(0, availableSlots).forEach((personId) => {
      onAddVisitCollectionPerson?.(personId);
    });
    if (unsavedIds.length > 0) {
      setVisitJourneyOpen(true);
      setVisitJourneyIndex(0);
    }
  }

  const hallClassName = [
    'living-hall',
    attractActive ? 'living-hall--attract' : '',
    focusedPerson ? 'living-hall--focused' : '',
    legacyTimeline.dragging ? 'living-hall--legacy-dragging' : '',
    latestClassFrame ? 'living-hall--latest-sequence' : '',
    cityResultsActive ? 'living-hall--city-results' : '',
    settings.showTouchCue ? '' : 'living-hall--hide-touch-cue',
    settings.showVocabulary ? '' : 'living-hall--hide-vocabulary',
    settings.showRecordLayer ? '' : 'living-hall--hide-record-layer',
    `living-hall--motion-${settings.motion}`,
  ].filter(Boolean).join(' ');
  const legacyForegroundContext = legacyTimeline.foregroundContext;
  const legacyFieldStyle = legacyTimeline.fieldStyle;
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
      data-linked-path-active={linkedPath ? 'true' : 'false'}
      data-linked-path-kind={linkedPath?.kind ?? ''}
      data-linked-path-label={linkedPath?.label ?? ''}
      data-linked-path-count={linkedPath?.personIds.length ?? 0}
      data-journey-active={visitJourneyOpen ? 'true' : 'false'}
      data-journey-current-step={visitJourneyOpen ? visitJourneyInsight.activeIndex + 1 : ''}
      data-journey-suggested-next={visitJourneyOpen ? visitJourneyInsight.activeSuggestion?.person.id ?? '' : ''}
      data-journey-step-count={visitJourneyOpen ? visitCollectionPeople.length : 0}
      data-content-window-open={focusContentWindowOpen ? 'true' : 'false'}
      data-legacy-pan={lens === 'legacies' ? Math.round(legacyTimeline.pan) : ''}
      data-person-action={focusedPerson ? activePersonAction : ''}
      data-visit-collection-count={visitCollectionPeople.length}
      data-visit-qr-open={visitQrOpen ? 'true' : 'false'}
      data-index-visit-open={indexVisitOpen ? 'true' : 'false'}
      style={hallStyle}
      onPointerDown={() => onEngage?.()}
    >
      {lens !== 'journeys' && !attractActive && (
        <>
          <header className="index-masthead">
            <h1>Cleveland International<br />Hall of Fame</h1>
            <nav aria-label="Explore the hall">
              <button className={lens === 'portraits' ? 'index-masthead__active' : ''} type="button" aria-current={lens === 'portraits' ? 'page' : undefined} onClick={() => onLensChange?.('portraits')}>People</button>
              <button className={lens === 'traces' ? 'index-masthead__active' : ''} type="button" aria-current={lens === 'traces' ? 'page' : undefined} onClick={() => onLensChange?.('traces')}>Links</button>
              <button className={lens === 'legacies' ? 'index-masthead__active' : ''} type="button" aria-current={lens === 'legacies' ? 'page' : undefined} onClick={() => onLensChange?.('legacies')}>Years</button>
            </nav>
            <button className="index-masthead__visit" type="button" aria-expanded={indexVisitOpen} onClick={() => setIndexVisitOpen((open) => !open)}>Visit {String(visitCollectionPeople.length).padStart(2, '0')}</button>
            <button className="index-masthead__mode" type="button" onClick={onToggleColorMode} aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}>{colorMode === 'light' ? 'Dark' : 'Light'}</button>
            <button className="index-masthead__reset" type="button" onClick={onReset}>Reset</button>
          </header>
          {lens === 'portraits' && <aside className="index-alphabet" aria-label="Alphabet index">
            <div className="index-alphabet__caption">Index / {allPeople.length}</div>
            <strong className="index-alphabet__active">{activeIndexLetter}</strong>
            <div className="index-alphabet__letters">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((letter) => letter !== activeIndexLetter).map((letter) => (
                <button key={letter} type="button" disabled={!indexLetters.has(letter)} onClick={() => jumpToIndexLetter(letter)} aria-label={`Jump to ${letter}`}>{letter}</button>
              ))}
            </div>
            <div className="index-alphabet__foot">People<br />{hallYears}</div>
          </aside>}
          {lens === 'traces' && <aside className="index-link-rail" aria-label="Connection modes">
            <span>LINKS / {traceContext.visibleThreads.length + 1}</span>
            <strong>{traceContext.mode === 'direct' ? 'TIES' : traceContext.mode === 'concept' ? 'IDEAS' : 'PLACE'}</strong>
            <div>
              {traceChooserOptions(traceContext).map((choice) => (
                <button key={choice.key} type="button" title={choice.detail || choice.label} aria-pressed={choice.key === traceContext.traceFocusKey} onClick={() => onTraceFocusChange?.(choice.key)}>{choice.label}</button>
              ))}
            </div>
            <small>FOLLOW THE<br />CONNECTIONS</small>
          </aside>}
          {lens === 'legacies' && <aside className="index-year-rail" aria-label="Induction class years">
            <span>YEARS / {legacyChronology.years.length}</span>
            <strong>{activeLegacyYear ?? '----'}</strong>
            <div>
              {legacyChronology.years.map((year) => (
                <button key={year} type="button" aria-label={`Class of ${year}`} aria-pressed={year === activeLegacyYear} onClick={() => legacyTimeline.changeClass(year)}>{year}</button>
              ))}
            </div>
          </aside>}
          <div className="index-field-head">
            <h2>{lens === 'portraits' ? 'People / Index' : lens === 'traces' ? 'Links / Connections' : `Years / ${activeLegacyYear ?? 'Classes'}`}</h2>
            <span>{lens === 'portraits' ? indexQuery ? `${indexMatches.length} matches` : `${people.length} records` : lens === 'traces' ? `${traceContext.visibleThreads.length} connections` : `${activeLegacyGroup?.people.length ?? 0} people`}</span>
            {lens === 'portraits' && <label>
              <span className="sr-only">Find a person or year</span>
              <input type="search" value={indexQuery} onChange={(event) => { setIndexQuery(event.target.value); indexViewportRef.current?.scrollTo({ top: 0 }); }} placeholder="Find a person or year" />
            </label>}
          </div>
        </>
      )}
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
        {lens === 'traces' ? 'TOUCH A TRACE' : lens === 'journeys' ? 'CHOOSE A JOURNEY' : lens === 'legacies' ? 'SWIPE THE CLASSES' : 'TOUCH A PORTRAIT'}
      </p>

      {!loading && !error && qrEnabled && visitCollectionPeople.length > 0 && !attractActive && (lens !== 'portraits' || indexVisitOpen) && (
        <VisitCollectionTray
          journey={visitJourneyInsight}
          journeyActive={visitJourneyOpen}
          people={visitCollectionPeople}
          qrOpen={visitQrOpen}
          sessionUrl={visitSessionUrl}
          onClear={() => {
            setVisitQrOpen(false);
            setVisitJourneyOpen(false);
            onClearVisitCollection?.();
          }}
          onCloseQr={() => setVisitQrOpen(false)}
          onOpenQr={() => setVisitQrOpen(true)}
          onStartJourney={startVisitJourney}
          onStopJourney={() => setVisitJourneyOpen(false)}
          onPreviousJourney={() => moveVisitJourney(-1)}
          onNextJourney={() => moveVisitJourney(1)}
          onSelectJourneyStep={focusVisitJourneyStep}
          onRemove={(personId) => {
            if (visitCollectionPeople.length <= 1) setVisitQrOpen(false);
            onRemoveVisitCollectionPerson?.(personId);
          }}
          onSelect={selectPortrait}
        />
      )}

      {lens === 'portraits' && indexVisitOpen && visitCollectionPeople.length === 0 && (
        <aside className="index-visit-empty" aria-label="Saved visit collection"><h2>Your visit</h2><p>No people saved yet.</p><button type="button" onClick={() => setIndexVisitOpen(false)}>Close</button></aside>
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

      {!loading && !error && lens === 'journeys' && !attractActive && (
        <JourneyGuidePanel
          activePath={activeJourneyPath}
          paths={journeyPaths}
          people={allPeople}
          visitCollectionIds={visitCollectionIds}
          visitCollectionLimit={visitCollectionLimit}
          onOpenPath={openCuratedJourney}
          onSavePath={saveJourneyPathToVisit}
          onSelectPerson={selectPortrait}
        />
      )}

      {!loading && !error && linkedPath && activePersonAction === 'overview' && (
        <LinkedPathRibbon
          path={linkedPath}
          availableSlots={linkedPathAvailableSaveSlots}
          saveCount={linkedPathSaveCount}
          saveEnabled={qrEnabled}
          unsavedCount={linkedPathUnsavedIds.length}
          onSave={saveLinkedPathToVisit}
        />
      )}

      <div className="living-hall__fieldViewport" ref={indexViewportRef}>
        <div
          className="living-hall__field"
          ref={legacyTimeline.fieldRef}
          style={legacyFieldStyle}
          aria-label={lens === 'legacies' ? 'Horizontal chronology of induction class portrait frames' : lens === 'journeys' ? 'Curated journey portrait routes' : 'Interactive inductee portraits'}
          data-legacy-active-year={lens === 'legacies' ? activeLegacyYear ?? '' : ''}
          data-legacy-pan={lens === 'legacies' ? Math.round(legacyTimeline.pan) : ''}
          {...legacyTimeline.fieldHandlers}
        >
          {!loading && !error && lens !== 'traces' && (
            <ClevelandTraceBackdrop variant={lens} />
          )}
          {loading && <LivingHallPlaceholders />}
          {!loading && !error && (lens === 'traces' || lens === 'journeys') && activeMode.lines && activeMode.lines.length > 0 && (
            <ClevelandTraceField className="living-hall__traceLines" lines={activeMode.lines} variant={lens} />
          )}
          {!loading && !error && (
            <ProjectionGeometryLayer
              focusedPersonId={focusedPersonId}
              lens={lens}
              linkedPath={linkedPath}
              positions={activeMode.positions}
              traceContext={traceContext}
              visitJourneyOpen={visitJourneyOpen}
              visitJourneyWallSteps={visitJourneyWallSteps}
            />
          )}

        {!loading && !error && (lens === 'portraits' ? indexedPeople : people).map((inductee, index) => {
          const position = activeMode.positions.get(inductee.id) ?? fallbackPosition(index, people.length);
          const frameState = portraitFrameState(lens, position);
          const frameAspect = portraitFrameAspect(mediaRecordMap.get(inductee.id));
          const style = portraitStyle(position, lens, inductee.id, frameState, frameAspect, settings, hallLayout);
          const lensBadge = portraitLensBadge(lens, position, inductee, activeLegacyYear);
          const portraitCategory = portraitCategoryForLens(lens, position, inductee, activeLegacyYear);
          const linked = linkedPersonIds.has(inductee.id);
          const linkedPathDimmed = Boolean(linkedPath) && !linked && !position.focused;
          const journeyStep = visitJourneyWallSteps.get(inductee.id);
          const journeyCurrent = Boolean(journeyStep && journeyStep.index === visitJourneyInsight.activeIndex);
          const journeyDimmed = visitJourneyOpen && !journeyStep && !position.focused;
          const className = [
            'living-portrait',
            position.emphasis ? 'living-portrait--emphasis' : '',
            position.focused ? 'living-portrait--focused' : '',
            position.muted ? 'living-portrait--muted' : '',
            linked ? 'living-portrait--linked' : '',
            linkedPathDimmed ? 'living-portrait--path-dimmed' : '',
            journeyStep ? 'living-portrait--journey-step' : '',
            journeyCurrent ? 'living-portrait--journey-current' : '',
            journeyStep?.suggested ? 'living-portrait--journey-next' : '',
            journeyDimmed ? 'living-portrait--journey-dimmed' : '',
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
              data-linked-path={linked ? 'true' : undefined}
              data-journey-step={journeyStep ? journeyStep.index + 1 : undefined}
              data-journey-current={journeyCurrent ? 'true' : undefined}
              data-journey-suggested={journeyStep?.suggested ? 'true' : undefined}
              data-journey-connection={journeyStep?.connectionLabel}
              data-media-available={inductee.hasVideo ? 'true' : 'false'}
              data-portrait-category={portraitCategory}
              data-index-letter={lens === 'portraits' ? inductee.name[0]?.toUpperCase() : undefined}
              hidden={(lens === 'portraits' && !indexMatchIds.has(inductee.id)) || (lens === 'legacies' && inductee.classYear !== activeLegacyYear)}
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
                showRecord={lens !== 'journeys' || shouldShowFrameRecord(lens, position, hallLayout)}
                classLabel={lens !== 'journeys'}
              />
              {journeyStep && (
                <span className="living-portrait__journeyBadge" aria-hidden="true">
                  <span>{String(journeyStep.index + 1).padStart(2, '0')}</span>
                  <strong>{journeyCurrent ? 'Current stop' : journeyStep.suggested ? 'Suggested next' : journeyStep.connectionLabel}</strong>
                </span>
              )}
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
          linkedPath={linkedPath}
          lens={lens}
          mediaPlayable={Boolean(focusedWatchAvailability?.playable)}
          placement={focusedCardPlacement}
          nextSteps={contextualNextSteps}
          traceContext={traceContext}
          visitCollectionEnabled={qrEnabled}
          visitCollectionCount={visitCollectionPeople.length}
          visitCollectionLimit={visitCollectionLimit}
          visitCollectionSaved={focusedVisitSaved}
          onClose={onCloseFocus}
          onFollowTrace={openTraceChooser}
          onLegacyJump={legacyTimeline.changeClass}
          onExplorePath={onExplorePath}
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

      {!loading && !error && cityQuestion.enabled && lens === 'journeys' && !attractActive && !focusedPerson && !latestClassFrame && (
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
          onJump={legacyTimeline.changeClass}
          onSelectPerson={selectPortrait}
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

function cycleImage(current: number | null, total: number, direction: -1 | 1) {
  if (current === null || total <= 0) return null;
  return (current + direction + total) % total;
}

function LinkedPathRibbon({
  availableSlots,
  path,
  saveCount,
  saveEnabled,
  unsavedCount,
  onSave,
}: {
  availableSlots: number;
  path: HallLinkedPath;
  saveCount: number;
  saveEnabled: boolean;
  unsavedCount: number;
  onSave: () => void;
}) {
  const saveDisabled = !saveEnabled || saveCount <= 0;
  const saveLabel = !saveEnabled
    ? 'Visit saving unavailable'
    : unsavedCount <= 0
      ? 'Path already saved'
      : availableSlots <= 0
        ? 'Visit full'
        : `Save ${saveCount} to visit`;

  return (
    <aside
      className="living-hall__pathRibbon"
      aria-label={`Active path: ${path.label}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span>{linkedPathKindLabel(path.kind)}</span>
      <strong>{path.label}</strong>
      <small>{path.personIds.length} {path.personIds.length === 1 ? 'portrait' : 'portraits'} highlighted</small>
      <button
        type="button"
        disabled={saveDisabled}
        aria-label={`${saveLabel} from ${path.label}`}
        onClick={onSave}
      >
        {saveLabel}
      </button>
    </aside>
  );
}

function linkedPathKindLabel(kind: HallLinkedPath['kind']) {
  switch (kind) {
    case 'heritage':
      return 'Nationality Path';
    case 'class':
      return 'Class Path';
    case 'theme':
      return 'Theme Path';
    case 'community':
      return 'Community Path';
    case 'person':
      return 'Profile Path';
  }
}
