import type { CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { PortraitFrame } from '../../components/PortraitFrame';
import { QRCodePanel } from '../../components/QRCodePanel';
import { honoredForSummary, inducteeContextLabel } from '../../data/inducteeNarrative';
import {
  isPresentationReadyGeography,
  relationshipLineLabel,
  relationshipSupportLabel,
  type NetworkReason,
  type NetworkThread,
} from '../../data/traceModel';
import type { HallLens, HallLinkedPath, Inductee, RuntimeMediaRecord, StorySectionRecord } from '../../data/types';
import { MediaExperience } from '../inductee-detail/MediaExperience';
import { StoryMode } from '../inductee-detail/StoryMode';
import {
  biographyParagraphs,
  fullBiographyText,
  fullBiographyWordCount,
  wordCountText,
} from './livingHallContent';
import type { VisitJourneyConfidence, VisitJourneyInsight } from './livingHallJourney';
import type { LatestClassFrame } from './livingHallRuntime';
import type { LegacyJumpTarget } from './useLegacyTimelineNavigation';
import {
  explicitTags,
  legacyGroupForYear,
  traceChooserOptions,
  type HallMode,
  type LatestClass,
  type LegacyChronology,
  type LegacyYearGroup,
  type TraceContext,
} from './livingHallModes';
import {
  clamp,
  fallbackPosition,
  portraitStyle,
  type FocusActionPlacement,
  type FocusCardPlacement,
  type HallPersonAction,
} from './livingHallLayout';

export function PortraitFocusCard({
  activeLegacyGroup,
  activeLegacyYear,
  inductee,
  action,
  continuationAvailable,
  fullTextAvailable,
  legacyChronology,
  linkedPath,
  lens,
  mediaPlayable,
  nextSteps,
  placement,
  traceContext,
  visitCollectionEnabled,
  visitCollectionCount,
  visitCollectionLimit,
  visitCollectionSaved,
  onClose,
  onFollowTrace,
  onLegacyJump,
  onExplorePath,
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
  linkedPath: HallLinkedPath | null;
  lens: HallLens;
  mediaPlayable: boolean;
  nextSteps: HallLinkedPath[];
  placement: FocusCardPlacement;
  traceContext: TraceContext;
  visitCollectionEnabled: boolean;
  visitCollectionCount: number;
  visitCollectionLimit: number;
  visitCollectionSaved: boolean;
  onClose?: () => void;
  onFollowTrace: () => void;
  onLegacyJump: (direction: LegacyJumpTarget) => void;
  onExplorePath?: (path: HallLinkedPath) => void;
  onSelectPerson: (inductee: Inductee) => void;
  onSetAction: (action: HallPersonAction) => void;
  onToggleVisitCollection: () => void;
}) {
  const profileMode = lens === 'portraits' || lens === 'journeys';
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
      aria-label={lens === 'legacies' ? `${inductee.name} cohort navigator` : lens === 'journeys' ? `${inductee.name} journey stop context` : `${inductee.name} focused portrait context`}
      aria-modal={lens === 'legacies' ? 'true' : undefined}
      className="living-hall__focusCard living-hall__focusCard--inspector"
      data-person-action={profileMode ? action : undefined}
      data-full-text-available={fullTextAvailable ? 'true' : 'false'}
      data-inspector-lens={lens}
      data-side={placement.side}
      role={lens === 'legacies' ? 'dialog' : undefined}
      style={placement.style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <FocusInspectorHeader
        inductee={inductee}
        lens={lens}
        onClose={onClose}
      />
      <div className="living-hall__focusBody">
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
            <PortraitConnectionBrief
              inductee={inductee}
              paths={nextSteps}
              traceContext={traceContext}
              onExplorePath={onExplorePath}
              onSelectPerson={onSelectPerson}
            />
            {nextSteps.length > 0 && onExplorePath && (
              <ContextualNextSteps
                activePath={linkedPath}
                inductee={inductee}
                paths={nextSteps}
                onExplorePath={onExplorePath}
              />
            )}
          </>
        )}
      </div>
      {profileMode && (
        <FocusActionBar
          action={action}
          biographyWords={biographyWords}
          continuationAvailable={continuationAvailable}
          continueDescriptionId={continueDescriptionId}
          fullTextAvailable={fullTextAvailable}
          mediaPlayable={mediaPlayable}
          panelId={panelId}
          saveDescriptionId={saveDescriptionId}
          storyDescriptionId={storyDescriptionId}
          textDescriptionId={textDescriptionId}
          traceDescriptionId={traceDescriptionId}
          visitCollectionFull={visitCollectionFull}
          visitCollectionLimit={visitCollectionLimit}
          visitCollectionSaved={visitCollectionSaved}
          visitCollectionCount={visitCollectionCount}
          visitCollectionEnabled={visitCollectionEnabled}
          watchDescriptionId={watchDescriptionId}
          inducteeName={inductee.name}
          onFollowTrace={onFollowTrace}
          onSetAction={onSetAction}
          onToggleVisitCollection={onToggleVisitCollection}
        />
      )}
    </aside>
  );
}

function FocusInspectorHeader({
  inductee,
  lens,
  onClose,
}: {
  inductee: Inductee;
  lens: HallLens;
  onClose?: () => void;
}) {
  return (
    <header className="living-hall__focusHeader">
      <span>{lens === 'legacies' ? 'COHORT NAVIGATION' : lens === 'journeys' ? 'JOURNEY STOP' : 'FOCUSED PORTRAIT'}</span>
      <strong>{inductee.classYear ? String(inductee.classYear) : 'Open'}</strong>
      {onClose && (
        <button type="button" aria-label={lens === 'legacies' ? 'Close cohort navigator' : lens === 'journeys' ? 'Close journey stop' : 'Close focused portrait'} onClick={onClose}>
          Close
        </button>
      )}
    </header>
  );
}

function FocusActionBar({
  action,
  biographyWords,
  continuationAvailable,
  continueDescriptionId,
  fullTextAvailable,
  inducteeName,
  mediaPlayable,
  panelId,
  saveDescriptionId,
  storyDescriptionId,
  textDescriptionId,
  traceDescriptionId,
  visitCollectionEnabled,
  visitCollectionFull,
  visitCollectionLimit,
  visitCollectionSaved,
  visitCollectionCount,
  watchDescriptionId,
  onFollowTrace,
  onSetAction,
  onToggleVisitCollection,
}: {
  action: HallPersonAction;
  biographyWords: number;
  continuationAvailable: boolean;
  continueDescriptionId: string;
  fullTextAvailable: boolean;
  inducteeName: string;
  mediaPlayable: boolean;
  panelId: string;
  saveDescriptionId: string;
  storyDescriptionId: string;
  textDescriptionId: string;
  traceDescriptionId: string;
  visitCollectionEnabled: boolean;
  visitCollectionFull: boolean;
  visitCollectionLimit: number;
  visitCollectionSaved: boolean;
  visitCollectionCount: number;
  watchDescriptionId: string;
  onFollowTrace: () => void;
  onSetAction: (action: HallPersonAction) => void;
  onToggleVisitCollection: () => void;
}) {
  return (
    <nav className="living-hall__focusActions" aria-label={`Actions for ${inducteeName}`}>
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
  );
}

function PortraitConnectionBrief({
  inductee,
  paths,
  traceContext,
  onExplorePath,
  onSelectPerson,
}: {
  inductee: Inductee;
  paths: HallLinkedPath[];
  traceContext: TraceContext;
  onExplorePath?: (path: HallLinkedPath) => void;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  const activePerson = traceContext.activePerson?.id === inductee.id ? traceContext.activePerson : inductee;
  const threads = traceContext.activePerson?.id === inductee.id ? traceContext.directThreads.slice(0, 3) : [];
  const primaryPath = paths[0] ?? null;
  const leadReason = threads[0]?.reasons[0] ?? null;
  const directCount = traceContext.activePerson?.id === inductee.id ? traceContext.directThreads.length : 0;
  const summary = connectionBriefSummary(directCount, primaryPath);
  const support = leadReason
    ? relationshipSupportLabel(leadReason, activePerson.name) || leadReason.detail
    : primaryPath?.detail ?? 'Class, nationality, community, and story patterns are available for comparison.';

  return (
    <section
      className="living-hall__connectionBrief"
      aria-label={`${inductee.name} connection brief`}
      data-connection-count={directCount}
      data-primary-path-kind={primaryPath?.kind ?? ''}
    >
      <header>
        <span>CONNECTION BRIEF</span>
        <strong>{summary}</strong>
        <small>{compactTraceText(support, 118)}</small>
      </header>

      {threads.length > 0 ? (
        <ol>
          {threads.map((thread, index) => (
            <li key={thread.person.id}>
              <button
                className="living-hall__connectionBriefPerson"
                type="button"
                data-connection-person={thread.person.id}
                aria-label={`Focus ${thread.person.name} from connection brief`}
                onClick={() => onSelectPerson(thread.person)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{thread.person.name}</strong>
                <small>{connectionBriefThreadLabel(thread, activePerson.name)}</small>
              </button>
            </li>
          ))}
        </ol>
      ) : primaryPath && onExplorePath ? (
        <button
          className="living-hall__connectionBriefPath"
          type="button"
          onClick={() => onExplorePath(primaryPath)}
        >
          <span>{linkedPathKindLabel(primaryPath.kind)}</span>
          <strong>{primaryPath.label}</strong>
          <small>{primaryPath.detail}</small>
        </button>
      ) : (
        <p>Ranked links compare class, nationality, community, and story patterns.</p>
      )}
    </section>
  );
}

function connectionBriefSummary(directCount: number, primaryPath: HallLinkedPath | null) {
  if (directCount > 0) return `${directCount} reviewed ${directCount === 1 ? 'tie' : 'ties'}`;
  if (primaryPath) return `${primaryPath.personIds.length} in ${primaryPath.label}`;
  return 'Trace-ready profile';
}

function connectionBriefThreadLabel(thread: NetworkThread, activeName: string) {
  const reason = thread.reasons[0];
  if (!reason) return 'Related profile';
  return compactTraceText(relationshipLineLabel(reason, activeName), 34);
}

function ContextualNextSteps({
  activePath,
  inductee,
  paths,
  onExplorePath,
}: {
  activePath: HallLinkedPath | null;
  inductee: Inductee;
  paths: HallLinkedPath[];
  onExplorePath: (path: HallLinkedPath) => void;
}) {
  return (
    <section className="living-hall__nextSteps" aria-label={`Next paths from ${inductee.name}`}>
      <h4>NEXT STEPS</h4>
      <ol>
        {paths.map((path) => {
          const active = activePath ? activePath.kind === path.kind && activePath.label === path.label : false;
          return (
            <li key={`${path.kind}-${path.label}`}>
              <button
                className={active ? 'living-hall__nextStep living-hall__nextStep--active' : 'living-hall__nextStep'}
                type="button"
                aria-pressed={active}
                onClick={() => onExplorePath(path)}
              >
                <span>{nextStepActionLabel(path)}</span>
                <small>{path.detail}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function nextStepActionLabel(path: HallLinkedPath) {
  if (path.kind === 'heritage') return `Follow ${path.label}`;
  if (path.kind === 'class') return `See ${path.label}`;
  if (path.kind === 'community') return `Explore ${path.label}`;
  if (path.kind === 'theme') return `Compare ${path.label}`;
  return `Open ${path.label}`;
}

function linkedPathKindLabel(kind: HallLinkedPath['kind']) {
  if (kind === 'heritage') return 'Nationality';
  if (kind === 'class') return 'Class Path';
  if (kind === 'community') return 'Community';
  if (kind === 'theme') return 'Theme';
  return 'Profile';
}

type JourneyPathWithSource = HallLinkedPath & {
  sourceLabel?: string;
};

export function JourneyGuidePanel({
  activePath,
  paths,
  people,
  visitCollectionIds,
  visitCollectionLimit,
  onOpenPath,
  onSavePath,
  onSelectPerson,
}: {
  activePath: HallLinkedPath | null;
  paths: JourneyPathWithSource[];
  people: Inductee[];
  visitCollectionIds: string[];
  visitCollectionLimit: number;
  onOpenPath: (path: HallLinkedPath) => void;
  onSavePath: (path: HallLinkedPath) => void;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  if (paths.length === 0) return null;

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const selectedPath: JourneyPathWithSource = activePath && activePath.lens === 'journeys' ? activePath : paths[0];
  const selectedPeople = peopleForPath(selectedPath, peopleById);

  return (
    <aside
      className="living-hall__journeyGuide"
      aria-label="Curated journey paths"
      data-active-path={selectedPath.label}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="living-hall__journeyGuideHeader">
        <span>JOURNEYS</span>
        <strong>Choose a path through the Hall</strong>
        <small>{paths.length} generated from class, nationality, community, and contribution metadata</small>
      </header>

      <nav className="living-hall__journeyPathList" aria-label="Available curated journeys">
        {paths.map((path, index) => {
          const active = selectedPath.kind === path.kind && selectedPath.label === path.label;
          const saveState = journeySaveState(path, visitCollectionIds, visitCollectionLimit);
          return (
            <article
              className={active ? 'living-hall__journeyPath living-hall__journeyPath--active' : 'living-hall__journeyPath'}
              data-journey-path={path.label}
              key={`${path.kind}-${path.label}`}
            >
              <button
                className="living-hall__journeyPathMain"
                type="button"
                aria-pressed={active}
                aria-label={`Open ${path.label}`}
                onClick={() => onOpenPath(path)}
              >
                <span>{String(index + 1).padStart(2, '0')} / {linkedPathKindLabel(path.kind)}</span>
                <strong>{path.label}</strong>
                <small>{path.detail}</small>
                <em>{path.personIds.length} stops</em>
              </button>
              <button
                className="living-hall__journeyPathSave"
                type="button"
                disabled={!saveState.enabled}
                aria-label={`${saveState.label}: ${path.label}`}
                onClick={() => onSavePath(path)}
              >
                {saveState.label}
              </button>
            </article>
          );
        })}
      </nav>

      <section className="living-hall__journeyRoutePreview" aria-label={`${selectedPath.label} route preview`}>
        <header>
          <span>{linkedPathKindLabel(selectedPath.kind)}</span>
          <strong>{selectedPath.label}</strong>
          <small>{selectedPath.sourceLabel ?? 'Curated from Hall metadata'}</small>
        </header>
        <ol>
          {selectedPeople.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                data-journey-stop={person.id}
                aria-label={`Focus journey stop ${index + 1}: ${person.name}`}
                onClick={() => onSelectPerson(person)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{person.name}</strong>
                <small>{journeyPersonLabel(person)}</small>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function peopleForPath(path: HallLinkedPath, peopleById: Map<string, Inductee>) {
  return path.personIds.map((id) => peopleById.get(id)).filter((person): person is Inductee => Boolean(person));
}

function journeySaveState(path: HallLinkedPath, visitCollectionIds: string[], visitCollectionLimit: number) {
  const unsavedCount = path.personIds.filter((id) => !visitCollectionIds.includes(id)).length;
  const availableSlots = Math.max(visitCollectionLimit - visitCollectionIds.length, 0);
  if (unsavedCount === 0) return { enabled: false, label: 'Saved' };
  if (availableSlots <= 0) return { enabled: false, label: 'Visit full' };
  return { enabled: true, label: `Save ${Math.min(unsavedCount, availableSlots)}` };
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
  const leadingReason = visibleThreads[0]?.reasons[0] ?? null;
  const leadingSupport = leadingReason
    ? relationshipSupportLabel(leadingReason, activePerson.name) || leadingReason.detail
    : '';

  return (
    <section className="living-hall__traceFocus" aria-label={`${activePerson.name} connection context`}>
      <header className="living-hall__traceFocusHeader">
        <span>{modeLabel}</span>
        <strong>{activeTitle}</strong>
        <small>{totalConnections} shown / {directCount} direct</small>
        {leadingSupport && <em>{leadingSupport}</em>}
      </header>
      {visibleThreads.length > 0 ? (
        <ol className="living-hall__traceConnectionList" aria-label="Visible connected portraits">
          {visibleThreads.map((thread, index) => {
            const reason = thread.reasons[0] ?? null;
            const label = reason ? relationshipLineLabel(reason, activePerson.name) : activeTitle;
            const detail = reason ? relationshipSupportLabel(reason, activePerson.name) || reason.detail : '';
            const supportingReasons = thread.reasons.slice(0, 2);
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
                    {supportingReasons.length > 1 && (
                      <span className="living-hall__traceConnectionReasons" aria-label={`${thread.person.name} supporting trace reasons`}>
                        {supportingReasons.map((supportingReason) => (
                          <b key={`${supportingReason.type}-${supportingReason.label}`}>
                            {traceReasonChipLabel(supportingReason, activePerson.name)}
                          </b>
                        ))}
                      </span>
                    )}
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

export function VisitCollectionTray({
  journey,
  journeyActive,
  people,
  qrOpen,
  sessionUrl,
  onClear,
  onCloseQr,
  onOpenQr,
  onStartJourney,
  onStopJourney,
  onPreviousJourney,
  onNextJourney,
  onSelectJourneyStep,
  onRemove,
  onSelect,
}: {
  journey: VisitJourneyInsight;
  journeyActive: boolean;
  people: Inductee[];
  qrOpen: boolean;
  sessionUrl: string;
  onClear: () => void;
  onCloseQr: () => void;
  onOpenQr: () => void;
  onStartJourney: () => void;
  onStopJourney: () => void;
  onPreviousJourney: () => void;
  onNextJourney: () => void;
  onSelectJourneyStep: (index: number) => void;
  onRemove: (personId: string) => void;
  onSelect: (inductee: Inductee) => void;
}) {
  const activeJourneyIndex = journey.activeIndex;
  const activeJourneyPerson = journeyActive ? people[activeJourneyIndex] ?? null : null;
  const activeSuggestion = journeyActive ? journey.activeSuggestion : null;

  return (
    <>
      <aside
        aria-label="Saved visit collection"
        className="living-hall__visitTray"
        data-journey-active={journeyActive ? 'true' : 'false'}
        data-journey-index={journeyActive ? activeJourneyIndex : ''}
        data-route-title={journey.title}
        data-saved-count={people.length}
        data-suggested-next={activeSuggestion?.person.id ?? ''}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="living-hall__visitTrayHeader">
          <div>
            <span>VISIT</span>
            <strong>{journey.title}</strong>
            <small>{journey.countLabel}</small>
          </div>
          <div className="living-hall__visitTrayActions">
            <button
              type="button"
              aria-pressed={journeyActive}
              onClick={journeyActive ? onStopJourney : onStartJourney}
            >
              {journeyActive ? 'End journey' : 'Start journey'}
            </button>
            <button type="button" onClick={onOpenQr}>Visit QR</button>
            <button type="button" onClick={onClear}>Clear</button>
          </div>
        </header>
        <section className="living-hall__visitRoute" aria-label="Visit route insight">
          <span>{journey.connectiveLabel}</span>
          <p>{journey.summary}</p>
        </section>
        <ol className="living-hall__visitList" aria-label="Saved people">
          {people.map((person, index) => {
            const journeyStepActive = journeyActive && index === activeJourneyIndex;
            const personClassName = journeyStepActive
              ? 'living-hall__visitPerson living-hall__visitPerson--journey'
              : 'living-hall__visitPerson';

            return (
              <li key={person.id}>
                <button
                  className={personClassName}
                  aria-current={journeyStepActive ? 'step' : undefined}
                  data-visit-person={person.id}
                  type="button"
                  onClick={() => {
                    if (journeyActive) {
                      onSelectJourneyStep(index);
                      return;
                    }
                    onSelect(person);
                  }}
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
            );
          })}
        </ol>

        {activeJourneyPerson && (
          <section className="living-hall__visitJourney" aria-label="Guided visit journey">
            <header>
              <span>JOURNEY STEP</span>
              <strong>{activeJourneyIndex + 1} / {people.length}</strong>
            </header>
            <div className="living-hall__visitJourneyPerson">
              <strong>{activeJourneyPerson.name}</strong>
              <small>{journeyPersonLabel(activeJourneyPerson)}</small>
              <p>{journeyPersonSummary(activeJourneyPerson)}</p>
            </div>
            {activeSuggestion && (
              <div className="living-hall__visitJourneyBridge">
                <div className="living-hall__visitJourneyBridgeMeta">
                  <span>Suggested next</span>
                  <small
                    className={`living-hall__visitJourneyConfidence living-hall__visitJourneyConfidence--${activeSuggestion.connection.confidence}`}
                  >
                    {visitJourneyConfidenceLabel(activeSuggestion.connection.confidence)}
                  </small>
                </div>
                <strong>{activeSuggestion.person.name}</strong>
                <p>{activeSuggestion.connection.detail}</p>
                <small className="living-hall__visitJourneySource">{activeSuggestion.connection.sourceLabel}</small>
                <button
                  type="button"
                  aria-label={`Suggested next: ${activeSuggestion.person.name}`}
                  onClick={() => onSelectJourneyStep(activeSuggestion.index)}
                >
                  Follow link
                </button>
              </div>
            )}
            <div className="living-hall__visitJourneyControls">
              <button type="button" aria-label="Previous saved person" onClick={onPreviousJourney}>Previous</button>
              <button type="button" aria-label="Next saved person" onClick={onNextJourney}>Next</button>
            </div>
            <div className="living-hall__visitJourneyDots" aria-label="Saved visit steps">
              {people.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  aria-label={`Jump to step ${index + 1}: ${person.name}`}
                  aria-pressed={index === activeJourneyIndex}
                  onClick={() => onSelectJourneyStep(index)}
                />
              ))}
            </div>
          </section>
        )}
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
            title={journey.title}
            instruction="Scan once to continue this saved visit path on the Hall website."
            ariaLabel={`${journey.title} visit continuation QR`}
            onAutoClose={onCloseQr}
          />
        </aside>
      )}
    </>
  );
}

function journeyPersonLabel(person: Inductee) {
  const heritage = person.countryTags.find((tag) => tag.trim().length > 0);
  const community = person.communityTags.find((tag) => tag.trim().length > 0);
  const classLabel = person.classYear ? `Class of ${person.classYear}` : person.region;
  return [classLabel, heritage ?? community].filter(Boolean).join(' | ');
}

function journeyPersonSummary(person: Inductee) {
  return trimJourneyText(
    person.honoredForSummary
      || person.storySummary
      || person.lifeWorkSummary
      || person.documentedContextLine
      || 'Open this record for the full profile and related paths.',
  );
}

function visitJourneyConfidenceLabel(confidence: VisitJourneyConfidence) {
  if (confidence === 'documented') return 'Documented';
  if (confidence === 'curated') return 'Curated';
  if (confidence === 'visitor') return 'Visitor Path';
  return 'Inferred';
}

function trimJourneyText(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 142) return clean;
  return `${clean.slice(0, 139).replace(/\s+\S*$/, '')}...`;
}

export function PersonFocusActionPanel({
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

export function LensStatusRail({
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

type LensStatusItem = {
  label: string;
  value: string;
};

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

  const emphasizedCount = [...activeMode.positions.values()].filter((position) => position.emphasis && !position.focused).length;
  if (lens === 'journeys') {
    return [
      { label: 'Routes', value: String(Math.max(activeMode.labels.length, 1)) },
      { label: 'Stops', value: String(emphasizedCount) },
      { label: 'Lines', value: String(activeMode.lines?.length ?? 0) },
    ];
  }

  const featuredCount = people.filter((person) => person.featured || person.featuredCandidate).length;
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

export function LegacyControls({
  activeYear,
  chronology,
  onJump,
  onSelectPerson,
}: {
  activeYear: number | null;
  chronology: LegacyChronology;
  onJump: (direction: LegacyJumpTarget) => void;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  if (chronology.years.length === 0) return null;
  const activeIndex = activeYear === null ? 0 : Math.max(chronology.years.indexOf(activeYear), 0);
  const activeLabel = activeYear === null ? `${chronology.firstYear ?? ''}` : String(activeYear);
  const activeGroup = legacyGroupForYear(chronology, activeYear);
  const activePeople = activeGroup?.people ?? [];
  const visibleClassPeople = activePeople.slice(0, 6);
  const hiddenClassPeople = Math.max(0, activePeople.length - visibleClassPeople.length);
  const range = chronology.firstYear && chronology.lastYear
    ? `${chronology.firstYear} - ${chronology.lastYear}`
    : 'Class chronology';
  const classPosition = activeIndex >= 0 ? `${activeIndex + 1} of ${chronology.years.length}` : String(chronology.years.length);

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
      {activeGroup && (
        <section className="living-hall__legacyClassShelf" aria-label={`${activeGroup.label} cohort browser`}>
          <header className="living-hall__legacyClassShelfHeader">
            <span>Class Browser</span>
            <strong>{activeGroup.label}</strong>
            <small>{activePeople.length} {activePeople.length === 1 ? 'portrait' : 'portraits'} / {classPosition}</small>
          </header>
          <ol className="living-hall__legacyClassRoster" aria-label={`${activeGroup.label} inductees`}>
            {visibleClassPeople.map((person, index) => (
              <li key={person.id}>
                <button
                  className="living-hall__legacyClassPerson"
                  type="button"
                  aria-label={`Focus ${person.name}, ${activeGroup.label}`}
                  data-legacy-person={person.id}
                  onClick={() => onSelectPerson(person)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{person.name}</strong>
                </button>
              </li>
            ))}
            {hiddenClassPeople > 0 && (
              <li aria-hidden="true">
                <span className="living-hall__legacyClassMore">+{hiddenClassPeople}</span>
              </li>
            )}
          </ol>
        </section>
      )}
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

export function TracePanel({
  context,
  chooserOpen,
  panelSide,
  onOpenChooser,
  onSelectPerson,
  onTraceFocusChange,
}: {
  context: TraceContext;
  chooserOpen: boolean;
  panelSide: 'left' | 'right';
  onOpenChooser: () => void;
  onSelectPerson: (inductee: Inductee) => void;
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
  const guideCards = traceGuideCards(context, choices);
  const evidenceItems = traceEvidenceItems(context, activePerson.name);
  const fabricLanes = traceFabricLanes(context);
  const fabricThreads = traceFabricThreads(context, activePerson.name);
  const traceMetrics = [
    { label: 'People', value: context.directThreads.length },
    { label: 'Stories', value: context.conceptChoices.length },
    { label: 'Heritage', value: context.placeChoices.length },
  ];

  return (
    <aside
      className={chooserOpen ? 'living-hall__tracePanel living-hall__tracePanel--chooser-open' : 'living-hall__tracePanel'}
      data-side={panelSide}
      data-fabric-mode={context.mode}
      aria-label={`${activePerson.name} traces`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="living-hall__traceHeader">
        <span>CLEVELAND CIVIC FABRIC</span>
        <h3>{activePerson.name}</h3>
        <p>{fabricHeaderLine(context)}</p>
        <button
          className="living-hall__traceContextButton"
          type="button"
          aria-expanded={chooserOpen}
          aria-label={`Choose trace path. Current path: ${activeTitle}`}
          onClick={onOpenChooser}
        >
          {activeTitle}
        </button>
      </header>

      <section className="living-hall__fabricSummary" aria-label="Civic fabric lanes">
        {fabricLanes.map((lane) => (
          <span
            className="living-hall__fabricLane"
            data-fabric-lane={lane.kind}
            key={lane.kind}
            style={{ '--fabric-strength': String(lane.strength) } as CSSProperties & Record<string, string>}
          >
            <small>{lane.label}</small>
            <strong>{lane.value}</strong>
            <em>{lane.detail}</em>
          </span>
        ))}
      </section>

      <div className="living-hall__traceMetrics" aria-label="Trace mode counts">
        {traceMetrics.map((metric) => (
          <span key={metric.label}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
          </span>
        ))}
      </div>

      {guideCards.length > 0 && (
        <div className="living-hall__traceGuide" aria-label="Guided trace paths">
          {guideCards.map((guide) => {
            const active = guide.key === context.traceFocusKey;
            return (
              <button
                aria-pressed={active}
                className={active ? 'living-hall__traceGuideCard living-hall__traceGuideCard--active' : 'living-hall__traceGuideCard'}
                data-trace-guide={guide.kind}
                key={guide.key || 'direct'}
                type="button"
                onClick={() => onTraceFocusChange?.(guide.key)}
              >
                <span>{guide.eyebrow}</span>
                <strong>{guide.label}</strong>
                <small>{guide.detail}</small>
                <em>{guide.countLabel}</em>
              </button>
            );
          })}
        </div>
      )}

      {fabricThreads.length > 0 && (
        <ol className="living-hall__fabricThreads" aria-label="People woven into this trace">
          {fabricThreads.map((thread, index) => (
            <li key={thread.person.id}>
              <button
                type="button"
                data-fabric-thread={thread.person.id}
                aria-label={`Follow civic fabric thread ${index + 1}: ${thread.person.name}`}
                onClick={() => onSelectPerson(thread.person)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{thread.person.name}</strong>
                <small>{thread.label}</small>
                <em>{thread.source}</em>
              </button>
            </li>
          ))}
        </ol>
      )}

      {evidenceItems.length > 0 && (
        <div className="living-hall__traceEvidence" aria-label="Why this trace appears">
          {evidenceItems.map((item) => (
            <span
              className={`living-hall__traceEvidenceItem living-hall__traceEvidenceItem--${item.provenance}`}
              key={item.key}
            >
              <small>{item.source}</small>
              <strong>{item.label}</strong>
              {item.detail && <em>{item.detail}</em>}
            </span>
          ))}
        </div>
      )}

      {onTraceFocusChange && choices.length > 0 && (
        <nav className="living-hall__traceControls" aria-hidden={chooserOpen ? undefined : true} aria-label="Reorganize traces">
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

export function LatestClassSequence({
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

export function LivingHallPlaceholders() {
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

type PortraitFocusFact = {
  label: string;
  value: string;
};

type TraceGuideCard = {
  key: string;
  kind: 'direct' | 'concept' | 'place';
  eyebrow: string;
  label: string;
  detail: string;
  countLabel: string;
};

type TraceEvidenceItem = {
  key: string;
  provenance: NetworkReason['provenance'];
  source: string;
  label: string;
  detail: string;
};

type TraceFabricLane = {
  kind: 'people' | 'story' | 'heritage' | 'evidence';
  label: string;
  value: string;
  detail: string;
  strength: number;
};

type TraceFabricThread = {
  person: Inductee;
  label: string;
  source: string;
};

function traceActiveTitle(context: TraceContext) {
  if (context.mode === 'concept') return context.activeConcept?.lens.label ?? 'Concept Trace';
  if (context.mode === 'place') return context.placeFocus.label;
  return 'Direct Ties';
}

function traceGuideCards(context: TraceContext, choices: ReturnType<typeof traceChooserOptions>): TraceGuideCard[] {
  const directChoice = choices.find((choice) => choice.kind === 'direct');
  const conceptChoice = choices.find((choice) => choice.kind === 'concept');
  const placeChoice = choices.find((choice) => choice.kind === 'place');
  const cards: TraceGuideCard[] = [];

  if (directChoice) {
    cards.push({
      key: directChoice.key,
      kind: 'direct',
      eyebrow: 'Start here',
      label: directChoice.label,
      detail: context.directThreads.length === 1 ? '1 documented person-to-person tie' : `${context.directThreads.length} documented person-to-person ties`,
      countLabel: `${context.directThreads.length} links`,
    });
  }

  if (conceptChoice) {
    const concept = context.conceptChoices.find((thread) => `concept:${thread.lens.id}` === conceptChoice.key);
    const peopleCount = concept?.people.length ?? 0;
    cards.push({
      key: conceptChoice.key,
      kind: 'concept',
      eyebrow: 'Story path',
      label: conceptChoice.label,
      detail: compactTraceText(conceptChoice.detail || 'Shared work, themes, or civic impact'),
      countLabel: peopleCount > 0 ? `${peopleCount} people` : 'shared theme',
    });
  }

  if (placeChoice) {
    const placePeople = context.placeChoices.find((choice) => choice.key === placeChoice.key)?.detail.match(/\d+/)?.[0];
    cards.push({
      key: placeChoice.key,
      kind: 'place',
      eyebrow: 'Heritage path',
      label: placeChoice.label,
      detail: compactTraceText(placeChoice.detail || 'Presentation-ready nationality and heritage metadata'),
      countLabel: placePeople ? `${placePeople} people` : `${context.placeFocus.people.length} people`,
    });
  }

  return cards.slice(0, 3);
}

function fabricHeaderLine(context: TraceContext) {
  if (context.mode === 'concept') return `Story lane / ${context.activeConcept?.lens.label ?? 'shared civic work'}`;
  if (context.mode === 'place') return `Heritage lane / ${context.placeFocus.label}`;
  return 'People lane / reviewed ties, class, story, and heritage';
}

function traceFabricLanes(context: TraceContext): TraceFabricLane[] {
  const activeHeritageLabels = context.geography.countries
    .filter((country) => country.people.some((person) => person.id === context.activePerson?.id))
    .map((country) => country.label)
    .slice(0, 2);
  const visibleReasons = context.visibleThreads.flatMap((thread) => thread.reasons);
  const documentedCount = visibleReasons.filter((reason) => reason.provenance === 'documented').length;
  const curatedCount = visibleReasons.filter((reason) => reason.provenance === 'curated').length;
  const maxCount = Math.max(
    context.directThreads.length,
    context.conceptChoices.length,
    context.placeChoices.length,
    documentedCount + curatedCount,
    1,
  );

  return [
    {
      kind: 'people',
      label: 'People lane',
      value: String(context.directThreads.length),
      detail: context.directThreads.length === 1 ? 'reviewed tie' : 'reviewed ties',
      strength: context.directThreads.length / maxCount,
    },
    {
      kind: 'story',
      label: 'Story lane',
      value: String(context.conceptChoices.length),
      detail: context.activeConcept?.lens.label ?? 'shared themes',
      strength: context.conceptChoices.length / maxCount,
    },
    {
      kind: 'heritage',
      label: 'Heritage lane',
      value: String(context.placeChoices.length),
      detail: activeHeritageLabels.join(' / ') || context.placeFocus.label || 'nationality paths',
      strength: context.placeChoices.length / maxCount,
    },
    {
      kind: 'evidence',
      label: 'Evidence lane',
      value: String(documentedCount + curatedCount),
      detail: documentedCount > 0 ? `${documentedCount} documented` : `${curatedCount} curated`,
      strength: (documentedCount + curatedCount) / maxCount,
    },
  ];
}

function traceFabricThreads(context: TraceContext, activeName: string): TraceFabricThread[] {
  return context.visibleThreads.slice(0, 5).map((thread) => {
    const reason = thread.reasons[0];
    return {
      person: thread.person,
      label: compactTraceText(reason ? relationshipLineLabel(reason, activeName) : traceActiveTitle(context), 42),
      source: reason ? traceEvidenceSource(reason.provenance) : 'Curated',
    };
  });
}

function traceEvidenceItems(context: TraceContext, activeName: string): TraceEvidenceItem[] {
  const seen = new Set<string>();
  const items: TraceEvidenceItem[] = [];

  context.visibleThreads.forEach((thread) => {
    thread.reasons.forEach((reason) => {
      const label = relationshipLineLabel(reason, activeName);
      const detail = compactTraceText(relationshipSupportLabel(reason, activeName) || reason.detail);
      const key = `${reason.type}-${label}-${detail}-${reason.provenance}`;
      if (seen.has(key) || items.length >= 3) return;
      seen.add(key);
      items.push({
        key,
        provenance: reason.provenance,
        source: traceEvidenceSource(reason.provenance),
        label,
        detail,
      });
    });
  });

  return items;
}

function traceReasonChipLabel(reason: NetworkReason, activeName: string) {
  return compactTraceText(relationshipLineLabel(reason, activeName), 30);
}

function traceEvidenceSource(provenance: NetworkReason['provenance']) {
  if (provenance === 'documented') return 'Documented';
  if (provenance === 'curated') return 'Curated';
  return 'Working';
}

function compactTraceText(value: string, maxLength = 82) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).replace(/[,;:\s]+$/, '')}...`;
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
