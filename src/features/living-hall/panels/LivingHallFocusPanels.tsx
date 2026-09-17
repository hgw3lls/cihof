import type { CSSProperties } from 'react';
import { FallbackImage, initials } from '../../../components/FallbackImage';
import { QRCodePanel } from '../../../components/QRCodePanel';
import { honoredForSummary, inducteeContextLabel } from '../../../data/inducteeNarrative';
import {
  isPresentationReadyGeography,
  relationshipLineLabel,
  relationshipSupportLabel,
  type NetworkThread,
} from '../../../data/traceModel';
import type { HallLens, HallLinkedPath, Inductee, RuntimeMediaRecord, StorySectionRecord } from '../../../data/types';
import { MediaExperience } from '../../inductee-detail/MediaExperience';
import { StoryMode } from '../../inductee-detail/StoryMode';
import {
  biographyParagraphs,
  fullBiographyText,
  fullBiographyWordCount,
  wordCountText,
} from '../livingHallContent';
import type { LegacyJumpTarget } from '../useLegacyTimelineNavigation';
import {
  explicitTags,
  legacyGroupForYear,
  type LegacyChronology,
  type LegacyYearGroup,
  type TraceContext,
} from '../livingHallModes';
import {
  clamp,
  type FocusActionPlacement,
  type FocusCardPlacement,
  type HallPersonAction,
} from '../livingHallLayout';
import { compactTraceText, traceActiveTitle, traceReasonChipLabel } from './LivingHallTracePanel';

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
        {lens === 'portraits' && (
          <div className="living-hall__focusPortrait">
            <FallbackImage
              alt={inductee.imageAltText || `Portrait of ${inductee.name}`}
              className="living-hall__focusPortraitImage"
              fallbackClassName="living-hall__focusPortraitFallback"
              fallbackLabel={initials(inductee.name)}
              loading="eager"
              src={inductee.primaryImageUrl}
            />
          </div>
        )}
        <div className="living-hall__focusIdentity">
          <h3>{inductee.name}</h3>
          <p>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Class year unknown'}</p>
        </div>
        {profileMode && context && <p className="living-hall__focusContext">{context}</p>}
        {lens === 'portraits' && (inductee.lifeWorkSummary || inductee.storySummary) && (
          <section className="living-hall__storySummary" aria-label="Story summary">
            <h4>STORY SUMMARY</h4>
            <p>{storyExcerpt(inductee.lifeWorkSummary || inductee.storySummary)}</p>
          </section>
        )}
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

function storyExcerpt(summary: string) {
  const sentence = summary.match(/^.{70,210}?[.!?](?=\s|$)/)?.[0];
  if (sentence) return sentence;
  if (summary.length <= 190) return summary;
  return `${summary.slice(0, 187).replace(/\s+\S*$/, '')}...`;
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
      <span>{lens === 'legacies' ? 'COHORT NAVIGATION' : lens === 'journeys' ? 'JOURNEY STOP' : lens === 'portraits' ? 'SELECTED RECORD' : 'FOCUSED PORTRAIT'}</span>
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

type PortraitFocusFact = {
  label: string;
  value: string;
};

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
