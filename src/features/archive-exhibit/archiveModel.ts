import { buildInfo } from '../../app/buildInfo';
import { isVisitorReadyVideo } from '../../app/mediaPublication';
import { isVisitorPublishedRelationship } from '../../data/relationshipPublication';
import type { Inductee, RelationshipProvenance, RelationshipRecord, RelationshipType, RuntimeVideoAsset } from '../../data/types';

export type Scene = 'people' | 'links' | 'years';
export type Film = { person: Inductee; asset: RuntimeVideoAsset; index: number; key: string };
export type Link = {
  id: string;
  person: Inductee;
  kind: 'documented' | 'class';
  label: string;
  context: string;
  source: string;
  provenance: RelationshipProvenance | 'class-record';
  direction: 'forward' | 'reverse' | 'context';
  relationship?: RelationshipRecord;
};

export type LinkNode = {
  person: Inductee;
  kind: 'documented' | 'class';
  documentedCount: number;
  contextCount: number;
};

export function isCollectionEligible(person: Inductee) {
  return Boolean(person.id.trim() && person.name.trim());
}

export function archiveLinks(person: Inductee, people: Inductee[], relationships: RelationshipRecord[]): Link[] {
  const byId = new Map(people.map((item) => [item.id, item]));
  const links: Link[] = [];
  for (const relationship of relationships) {
    if (!isVisitorPublishedRelationship(relationship)) continue;
    if (relationship.targetEntityType && relationship.targetEntityType !== 'person') continue;
    const source = relationship.sourcePersonId === person.id;
    const target = relationship.targetEntityId === person.id;
    if (!source && !target) continue;
    const id = source ? relationship.targetEntityId : relationship.sourcePersonId;
    const related = byId.get(id);
    const canonicalSource = byId.get(relationship.sourcePersonId);
    const canonicalTarget = byId.get(relationship.targetEntityId);
    if (!related || !canonicalSource || !canonicalTarget || related.id === person.id) continue;
    const direction = source ? 'forward' : 'reverse';
    links.push({
      id: relationship.id,
      person: related,
      kind: 'documented',
      label: relationshipTypeLabel(relationship.type),
      context: relationshipDescription(relationship, canonicalSource, canonicalTarget, direction),
      source: relationship.referenceNote!.trim(),
      provenance: relationship.provenance,
      direction,
      relationship,
    });
  }
  if (person.classYear !== null) {
    for (const related of people) {
      if (related.id === person.id || related.classYear !== person.classYear) continue;
      links.push({
        id: `class:${person.id}:${related.id}:${person.classYear}`,
        person: related,
        kind: 'class',
        label: 'SHARED INDUCTION YEAR',
        context: `Honored in the same year: ${person.classYear}.`,
        source: 'CIHOF induction year in both records.',
        provenance: 'class-record',
        direction: 'context',
      });
    }
  }
  return links.sort((a, b) => (
    (a.kind === b.kind ? 0 : a.kind === 'documented' ? -1 : 1)
    || a.person.name.localeCompare(b.person.name)
    || a.label.localeCompare(b.label)
    || a.id.localeCompare(b.id)
  ));
}

export function archiveLinkNodes(links: Link[]): LinkNode[] {
  const nodes = new Map<string, LinkNode>();
  for (const link of links) {
    const current = nodes.get(link.person.id) ?? { person: link.person, kind: 'class', documentedCount: 0, contextCount: 0 };
    if (link.kind === 'documented') {
      current.kind = 'documented';
      current.documentedCount += 1;
    } else {
      current.contextCount += 1;
    }
    nodes.set(link.person.id, current);
  }
  return [...nodes.values()].sort((a, b) => (
    (a.kind === b.kind ? 0 : a.kind === 'documented' ? -1 : 1)
    || a.person.name.localeCompare(b.person.name)
  ));
}

export function publishedRelationshipCounts(people: Inductee[], relationships: RelationshipRecord[]) {
  const peopleIds = new Set(people.map((person) => person.id));
  const counts = new Map<string, number>();
  for (const relationship of relationships) {
    if (!isVisitorPublishedRelationship(relationship)) continue;
    if (relationship.targetEntityType && relationship.targetEntityType !== 'person') continue;
    if (!peopleIds.has(relationship.sourcePersonId) || !peopleIds.has(relationship.targetEntityId)) continue;
    counts.set(relationship.sourcePersonId, (counts.get(relationship.sourcePersonId) ?? 0) + 1);
    counts.set(relationship.targetEntityId, (counts.get(relationship.targetEntityId) ?? 0) + 1);
  }
  return counts;
}

function relationshipDescription(relationship: RelationshipRecord, source: Inductee, target: Inductee, direction: 'forward' | 'reverse') {
  if (relationship.type === 'inducted_by') return `${source.name} was inducted by ${target.name}.`;
  const authored = direction === 'reverse' && relationship.reverseDisplayLabel?.trim()
    ? relationship.reverseDisplayLabel.trim()
    : relationship.displayLabel.trim();
  if (direction === 'reverse' && !relationship.reverseDisplayLabel?.trim()) {
    return `From ${source.name}'s approved record: ${withPeriod(authored)}`;
  }
  return withPeriod(authored);
}

function withPeriod(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function relationshipTypeLabel(type: RelationshipType) {
  const labels: Record<RelationshipType, string> = {
    inducted_by: 'INDUCTION',
    same_class: 'SHARED INDUCTION YEAR',
    shared_theme: 'SHARED THEME',
    shared_organization: 'SHARED ORGANIZATION',
    shared_community: 'SHARED COMMUNITY',
    civic_collaboration: 'CIVIC COLLABORATION',
    mentor: 'MENTORSHIP',
    colleague: 'COLLEAGUES',
    family: 'FAMILY',
    related_place: 'DOCUMENTED PLACE',
    related_event: 'DOCUMENTED EVENT',
  };
  return labels[type];
}

export function visitorReadyFilm(asset: RuntimeVideoAsset) {
  return isVisitorReadyVideo(asset, buildInfo.buildTarget === 'public' ? 'public' : 'kiosk');
}

export function assetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export function portraitUrl(person: Inductee) {
  const path = person.primaryImageUrl.trim();
  return path ? assetUrl(path) : null;
}

export function duration(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds)) return 'FILM';
  const value = Math.round(seconds ?? 0);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
