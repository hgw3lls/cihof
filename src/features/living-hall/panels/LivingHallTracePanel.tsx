import type { CSSProperties } from 'react';
import {
  relationshipLineLabel,
  relationshipSupportLabel,
  type NetworkReason,
} from '../../../data/traceModel';
import type { Inductee } from '../../../data/types';
import { traceChooserOptions, type TraceContext } from '../livingHallModes';

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

export function traceActiveTitle(context: TraceContext) {
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

export function traceReasonChipLabel(reason: NetworkReason, activeName: string) {
  return compactTraceText(relationshipLineLabel(reason, activeName), 30);
}

function traceEvidenceSource(provenance: NetworkReason['provenance']) {
  if (provenance === 'documented') return 'Documented';
  if (provenance === 'curated') return 'Curated';
  return 'Working';
}

export function compactTraceText(value: string, maxLength = 82) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).replace(/[,;:\s]+$/, '')}...`;
}
