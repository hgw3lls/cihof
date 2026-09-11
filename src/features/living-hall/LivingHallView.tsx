import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { ClevelandTraceBackdrop, ClevelandTraceField } from '../../components/ClevelandTrace';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { PortraitFrame } from '../../components/PortraitFrame';
import { defaultKioskSettings, type KioskSettings } from '../../app/kioskSettings';
import { useStoryLenses } from '../../data/storyLenses';
import { useCityQuestion } from '../../data/useCityQuestion';
import { useMediaManifest, useMediaRecordMap } from '../../data/useMediaManifest';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import type { HallLens, HallLinkedPath, Inductee, RelationshipRecord } from '../../data/types';
import { buildPersonGallery, canonicalContinuationUrl, mediaAvailability } from '../inductee-detail/personDetailModel';
import { CityQuestionPrompt, CityQuestionResults } from './CityQuestion';
import {
  LegacyControls,
  LensStatusRail,
  LatestClassSequence,
  LivingHallPlaceholders,
  PersonFocusActionPanel,
  PortraitFocusCard,
  TracePanel,
  VisitCollectionTray,
} from './LivingHallPanels';
import { eventTargetInsideContentWindow } from './livingHallDom';
import { buildVisitSessionUrl, fullBiographyText } from './livingHallContent';
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
import {
  stopHallFocusMedia,
  useCityResultsAttract,
  useEscapeToCloseFocus,
  useHallLayoutViewport,
  useHallModeStep,
  useLatestClassSequence,
  useReducedMotion,
  useResetFocusedPersonExperience,
  useTraceChooserTimeout,
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
  const [traceChooserOpen, setTraceChooserOpen] = useState(false);
  const [visitQrOpen, setVisitQrOpen] = useState(false);
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
      layout: hallLayout,
    }),
    [activeLegacyYear, focusedPersonId, hallLayout, legacyChronology, lens, modes, people, relationships, step, traceContext, traceTrailIds],
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
    setTraceChooserOpen,
  });
  useTraceChooserTimeout(traceChooserOpen, setTraceChooserOpen);
  useVisitQrAvailability({
    attractActive,
    savedPeopleCount: visitCollectionPeople.length,
    setVisitQrOpen,
  });

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
    const suppressed = legacyTimeline.shouldSuppressTap();
    if (suppressed) {
      event.preventDefault();
      event.stopPropagation();
    }
    return suppressed;
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

  function saveLinkedPathToVisit() {
    if (!linkedPath || linkedPathSaveCount <= 0 || !qrEnabled) return;
    onEngage?.();
    linkedPathUnsavedIds.slice(0, linkedPathSaveCount).forEach((personId) => {
      onAddVisitCollectionPerson?.(personId);
    });
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
      data-linked-path-active={linkedPath ? 'true' : 'false'}
      data-linked-path-kind={linkedPath?.kind ?? ''}
      data-linked-path-label={linkedPath?.label ?? ''}
      data-linked-path-count={linkedPath?.personIds.length ?? 0}
      data-content-window-open={focusContentWindowOpen ? 'true' : 'false'}
      data-legacy-pan={lens === 'legacies' ? Math.round(legacyTimeline.pan) : ''}
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

      <div className="living-hall__fieldViewport">
        <div
          className="living-hall__field"
          ref={legacyTimeline.fieldRef}
          style={legacyFieldStyle}
          aria-label={lens === 'legacies' ? 'Horizontal chronology of induction class portrait frames' : 'Interactive inductee portraits'}
          data-legacy-active-year={lens === 'legacies' ? activeLegacyYear ?? '' : ''}
          data-legacy-pan={lens === 'legacies' ? Math.round(legacyTimeline.pan) : ''}
          {...legacyTimeline.fieldHandlers}
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
          const linked = linkedPersonIds.has(inductee.id);
          const linkedPathDimmed = Boolean(linkedPath) && !linked && !position.focused;
          const className = [
            'living-portrait',
            position.emphasis ? 'living-portrait--emphasis' : '',
            position.focused ? 'living-portrait--focused' : '',
            position.muted ? 'living-portrait--muted' : '',
            linked ? 'living-portrait--linked' : '',
            linkedPathDimmed ? 'living-portrait--path-dimmed' : '',
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
