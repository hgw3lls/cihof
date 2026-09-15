import { QRCodePanel } from '../../../components/QRCodePanel';
import type { HallLinkedPath, Inductee } from '../../../data/types';
import type { VisitJourneyConfidence, VisitJourneyInsight } from '../livingHallJourney';

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
        data-qr-open={qrOpen ? 'true' : 'false'}
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
