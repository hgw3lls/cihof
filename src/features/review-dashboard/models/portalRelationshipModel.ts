import {
  buildConnectionGraph,
  type ConnectionEdge,
  type ConnectionNode,
} from '../../../data/connectionGraph';
import type {
  Inductee,
  RelationshipProvenance,
  RelationshipRecord,
  RelationshipType,
} from '../../../data/types';
import {
  relationshipReviewStatusValues,
  relationshipTypeValues,
} from '../services/portalDrafts';
import type {
  RelationshipDraft,
  RelationshipDraftMap,
  RelationshipReviewStatus,
} from '../services/portalDrafts';
import { sourceNote } from './portalSourceModel';
import type { SourceRelationshipReviewDraft } from './portalSourcePacket';

export type RelationshipQueueMode = 'needs-review' | 'source-leads' | 'inferred' | 'curated' | 'documented' | 'people' | 'entities' | 'approved' | 'hidden' | 'all';

export type RelationshipReviewRow = {
  id: string;
  edge: ConnectionEdge;
  sourceNode: ConnectionNode;
  targetNode: ConnectionNode;
  draft?: RelationshipDraft;
  sourceLead?: SourceRelationshipReviewDraft;
  effectiveLabel: string;
  effectiveNote: string;
  effectiveProvenance: RelationshipProvenance;
  effectiveType: RelationshipType;
  reviewStatus: 'approved' | 'hidden' | 'needs-research' | 'unreviewed';
  searchText: string;
};

function materializeApprovedRelationshipRecords(rows: RelationshipReviewRow[], existingRecords: RelationshipRecord[]) {
  const records = new Map<string, RelationshipRecord>();
  existingRecords.forEach((record) => records.set(relationshipRecordKey(record), record));

  rows.forEach((row) => {
    if (row.draft?.reviewStatus !== 'approved') return;
    const record = relationshipRowToRecord(row);
    if (record) records.set(relationshipRecordKey(record), record);
  });

  return Array.from(records.values()).sort((a, b) => (
    a.sourcePersonId.localeCompare(b.sourcePersonId) ||
    (a.targetEntityType ?? '').localeCompare(b.targetEntityType ?? '') ||
    a.targetEntityId.localeCompare(b.targetEntityId) ||
    a.type.localeCompare(b.type) ||
    a.displayLabel.localeCompare(b.displayLabel)
  ));
}

function relationshipRowToRecord(row: RelationshipReviewRow): RelationshipRecord | null {
  if (row.sourceNode.kind !== 'person' || !row.sourceNode.inductee) return null;
  if (row.targetNode.kind === 'person' && !row.targetNode.inductee) return null;

  const targetIsPerson = row.targetNode.kind === 'person';
  const referenceNote = [row.effectiveNote, row.draft?.curatorNote]
    .map((value) => cleanPortalString(value))
    .filter(Boolean)
    .join(' ');
  const record: RelationshipRecord = {
    id: row.edge.relationshipId || row.id,
    sourcePersonId: row.sourceNode.inductee.id,
    targetEntityId: targetIsPerson && row.targetNode.inductee ? row.targetNode.inductee.id : row.targetNode.entityId,
    targetEntityType: row.targetNode.kind,
    type: row.effectiveType,
    displayLabel: cleanPortalString(row.effectiveLabel) || relationshipTypeLabel(row.effectiveType),
    provenance: row.effectiveProvenance === 'inferred' ? 'curated' : row.effectiveProvenance,
  };

  if (!targetIsPerson) record.targetDisplayName = row.targetNode.label;
  if (referenceNote) record.referenceNote = referenceNote;
  if (row.edge.reverseDisplayLabel) record.reverseDisplayLabel = row.edge.reverseDisplayLabel;
  return record;
}

function relationshipRecordKey(record: RelationshipRecord) {
  if (record.id) return record.id;
  return [
    record.sourcePersonId,
    record.targetEntityType ?? '',
    record.targetEntityId,
    record.type,
    record.displayLabel,
    record.provenance,
  ].join('|');
}

function buildRelationshipReviewRows(inductees: Inductee[], relationships: RelationshipRecord[], drafts: RelationshipDraftMap, sourceLeads: SourceRelationshipReviewDraft[] = []): RelationshipReviewRow[] {
  const graph = buildConnectionGraph(inductees, relationships);
  const uniqueEdges = new Map<string, ConnectionEdge>();

  graph.adjacency.forEach((edges) => {
    edges.forEach((edge) => uniqueEdges.set(edge.id, edge));
  });

  const graphRows = Array.from(uniqueEdges.values())
    .map<RelationshipReviewRow | null>((edge) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) return null;

      const sourceNode = fromNode.kind === 'person' ? fromNode : toNode.kind === 'person' ? toNode : fromNode;
      const targetNode = sourceNode.id === fromNode.id ? toNode : fromNode;
      const draft = drafts[edge.id];
      const effectiveLabel = cleanPortalString(draft?.displayLabel) || edge.label;
      const effectiveNote = cleanPortalString(draft?.referenceNote) || edge.referenceNote || '';
      const effectiveProvenance = draft?.provenanceOverride ?? edge.provenance;
      const effectiveType = draft?.typeOverride ?? edge.type;
      const reviewStatus: RelationshipReviewRow['reviewStatus'] = draft?.reviewStatus ?? (edge.provenance === 'inferred' ? 'unreviewed' : 'approved');
      const searchText = [
        sourceNode.label,
        targetNode.label,
        effectiveLabel,
        effectiveNote,
        effectiveProvenance,
        relationshipProvenanceLabel(effectiveProvenance),
        effectiveType,
        relationshipTypeLabel(effectiveType),
        edge.source,
        relationshipSourceLabel(edge.source),
        sourceNode.kind,
        targetNode.kind,
        nodeKindLabel(sourceNode.kind),
        nodeKindLabel(targetNode.kind),
        reviewStatus,
      ].join(' ').toLowerCase();

      return {
        id: edge.id,
        edge,
        sourceNode,
        targetNode,
        draft,
        effectiveLabel,
        effectiveNote,
        effectiveProvenance,
        effectiveType,
        reviewStatus,
        searchText,
      };
    })
    .filter((row): row is RelationshipReviewRow => Boolean(row));

  const sourceRows = buildSourceRelationshipReviewRows(inductees, sourceLeads, drafts, new Set(graphRows.map((row) => relationshipPairKey(row))));
  return [...graphRows, ...sourceRows];
}

function buildSourceRelationshipReviewRows(inductees: Inductee[], sourceLeads: SourceRelationshipReviewDraft[], drafts: RelationshipDraftMap, existingPairKeys: Set<string>): RelationshipReviewRow[] {
  const peopleById = new Map(inductees.map((inductee) => [inductee.id, inductee]));
  const uniqueRows = new Map<string, RelationshipReviewRow>();

  sourceLeads.forEach((lead) => {
    const sourcePersonId = cleanPortalString(lead.sourcePersonId);
    const targetEntityId = cleanPortalString(lead.targetEntityId);
    const sourceInductee = peopleById.get(sourcePersonId);
    const targetInductee = peopleById.get(targetEntityId);
    if (!sourceInductee || !targetInductee || sourceInductee.id === targetInductee.id) return;

    const type = sourceRelationshipType(lead.type);
    const label = cleanPortalString(lead.displayLabel) || sourceRelationshipLabel(lead, sourceInductee, targetInductee, type);
    const provenance = sourceRelationshipProvenance(lead.provenanceCandidate);
    const pairKey = [sourceInductee.id, targetInductee.id].sort().join('|');
    const reviewPairKey = `${pairKey}|${type}`;
    if (existingPairKeys.has(reviewPairKey)) return;

    const id = `source-curation|${sourceInductee.id}|${targetInductee.id}|${type}|${slugifyRelationshipRowId(label)}`;
    const sourceRowKey = `${sourceInductee.id}|${targetInductee.id}|${type}|${slugifyRelationshipRowId(label)}`;
    if (uniqueRows.has(sourceRowKey)) return;
    const draft = drafts[id];
    const sourceNode = relationshipPersonNode(sourceInductee);
    const targetNode = relationshipPersonNode(targetInductee);
    const edge: ConnectionEdge = {
      id,
      from: sourceNode.id,
      to: targetNode.id,
      type,
      label,
      provenance,
      referenceNote: sourceRelationshipReferenceNote(lead),
      source: 'sourceCuration',
      weight: provenance === 'documented' ? 3 : 8,
    };
    const effectiveLabel = cleanPortalString(draft?.displayLabel) || edge.label;
    const effectiveNote = cleanPortalString(draft?.referenceNote) || edge.referenceNote || '';
    const effectiveProvenance = draft?.provenanceOverride ?? edge.provenance;
    const effectiveType = draft?.typeOverride ?? edge.type;
    const reviewStatus: RelationshipReviewRow['reviewStatus'] = draft?.reviewStatus ?? 'unreviewed';
    const searchText = [
      sourceNode.label,
      targetNode.label,
      effectiveLabel,
      effectiveNote,
      effectiveProvenance,
      relationshipProvenanceLabel(effectiveProvenance),
      effectiveType,
      relationshipTypeLabel(effectiveType),
      relationshipSourceLabel(edge.source),
      cleanPortalString(lead.provenanceCandidate),
      cleanPortalString(lead.reviewAction),
      cleanPortalString(lead.publicUse),
      reviewStatus,
    ].join(' ').toLowerCase();

    uniqueRows.set(sourceRowKey, {
      id,
      edge,
      sourceNode,
      targetNode,
      draft,
      sourceLead: lead,
      effectiveLabel,
      effectiveNote,
      effectiveProvenance,
      effectiveType,
      reviewStatus,
      searchText,
    });
  });

  return Array.from(uniqueRows.values());
}

function relationshipPairKey(row: RelationshipReviewRow) {
  if (row.sourceNode.kind !== 'person' || row.targetNode.kind !== 'person') return row.id;
  return `${[row.sourceNode.entityId, row.targetNode.entityId].sort().join('|')}|${row.effectiveType}`;
}

function relationshipPersonNode(inductee: Inductee): ConnectionNode {
  return {
    id: `person:${inductee.id}`,
    entityId: inductee.id,
    kind: 'person',
    label: inductee.name,
    inductee,
  };
}

function sourceRelationshipType(value: string | undefined): RelationshipType {
  return relationshipTypeValues.has(value as RelationshipType) ? value as RelationshipType : 'colleague';
}

function sourceRelationshipProvenance(value: string | undefined): RelationshipProvenance {
  const candidate = cleanPortalString(value).toLowerCase();
  if (candidate.includes('documented')) return 'documented';
  return 'inferred';
}

function sourceRelationshipLabel(lead: SourceRelationshipReviewDraft, source: Inductee, target: Inductee, type: RelationshipType) {
  const targetLabel = cleanPortalString(lead.targetDisplayName) || target.name;
  return `${source.name} / ${targetLabel} / ${relationshipTypeLabel(type)}`;
}

function sourceRelationshipReferenceNote(lead: SourceRelationshipReviewDraft) {
  return sourceNote('Original-site relationship lead', [
    lead.referenceNote,
    lead.provenanceCandidate,
    lead.evidenceTypes?.join('; '),
    lead.sourcePageUrls?.join('; '),
    lead.reviewAction,
    lead.publicUse,
  ]);
}

function slugifyRelationshipRowId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 72) || 'relationship';
}

function buildRelationshipQueueOptions(rows: RelationshipReviewRow[]): Array<{ mode: RelationshipQueueMode; label: string; count: number }> {
  const count = (mode: RelationshipQueueMode) => rows.filter((row) => matchesRelationshipQueue(row, mode)).length;
  return [
    { mode: 'needs-review', label: 'Needs Review', count: count('needs-review') },
    { mode: 'source-leads', label: 'Source Leads', count: count('source-leads') },
    { mode: 'inferred', label: 'Inferred', count: count('inferred') },
    { mode: 'curated', label: 'Curated', count: count('curated') },
    { mode: 'documented', label: 'Documented', count: count('documented') },
    { mode: 'people', label: 'Person Links', count: count('people') },
    { mode: 'entities', label: 'Entity Links', count: count('entities') },
    { mode: 'approved', label: 'Approved', count: count('approved') },
    { mode: 'hidden', label: 'Hidden', count: count('hidden') },
    { mode: 'all', label: 'All Links', count: rows.length },
  ];
}

function matchesRelationshipQueue(row: RelationshipReviewRow, queue: RelationshipQueueMode) {
  if (queue === 'all') return true;
  if (queue === 'needs-review') return row.reviewStatus === 'unreviewed' || row.reviewStatus === 'needs-research';
  if (queue === 'source-leads') return row.edge.source === 'sourceCuration';
  if (queue === 'inferred') return row.effectiveProvenance === 'inferred';
  if (queue === 'curated') return row.effectiveProvenance === 'curated';
  if (queue === 'documented') return row.effectiveProvenance === 'documented';
  if (queue === 'people') return row.sourceNode.kind === 'person' && row.targetNode.kind === 'person';
  if (queue === 'entities') return row.targetNode.kind !== 'person';
  if (queue === 'approved') return row.reviewStatus === 'approved';
  if (queue === 'hidden') return row.reviewStatus === 'hidden';
  return true;
}

function relationshipPriorityRank(row: RelationshipReviewRow) {
  if (row.reviewStatus === 'hidden') return 8;
  if (row.reviewStatus === 'needs-research') return 0;
  if (row.edge.source === 'sourceCuration' && row.reviewStatus === 'unreviewed') return 1;
  if (row.reviewStatus === 'unreviewed' && row.effectiveProvenance === 'inferred') return 2;
  if (row.edge.source === 'relatedIds') return 3;
  if (row.effectiveProvenance === 'inferred') return 4;
  if (row.effectiveProvenance === 'documented') return 5;
  if (row.effectiveProvenance === 'curated') return 6;
  return 7;
}

function relationshipTypeLabel(type: RelationshipType) {
  const labels: Record<RelationshipType, string> = {
    inducted_by: 'Inducted by',
    same_class: 'Same class',
    shared_theme: 'Shared theme',
    shared_organization: 'Shared organization',
    shared_community: 'Shared community',
    civic_collaboration: 'Civic collaboration',
    mentor: 'Mentor',
    colleague: 'Colleague',
    family: 'Family',
    related_place: 'Related place',
    related_event: 'Related event',
  };
  return labels[type];
}

function relationshipProvenanceLabel(provenance: RelationshipProvenance) {
  const labels: Record<RelationshipProvenance, string> = {
    documented: 'Documented',
    curated: 'Curated',
    inferred: 'Inferred',
  };
  return labels[provenance];
}

function relationshipSourceLabel(source: ConnectionEdge['source']) {
  const labels: Record<ConnectionEdge['source'], string> = {
    relationship: 'Explicit relationship',
    metadata: 'Prepared metadata',
    relatedIds: 'Legacy suggestion',
    sourceCuration: 'Original-site source lead',
  };
  return labels[source];
}

function nodeKindLabel(kind: ConnectionNode['kind']) {
  const labels: Record<ConnectionNode['kind'], string> = {
    person: 'Person',
    organization: 'Organization',
    place: 'Place',
    community: 'Community',
    event: 'Event',
    theme: 'Theme',
    media: 'Media',
  };
  return labels[kind];
}

function entityInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function relationshipStatusValue(value: string) {
  return relationshipReviewStatusValues.has(value as RelationshipReviewStatus) ? value as RelationshipReviewStatus : undefined;
}

function cleanPortalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export {
  buildRelationshipQueueOptions,
  buildRelationshipReviewRows,
  entityInitials,
  materializeApprovedRelationshipRecords,
  matchesRelationshipQueue,
  nodeKindLabel,
  relationshipPriorityRank,
  relationshipProvenanceLabel,
  relationshipSourceLabel,
  relationshipStatusValue,
  relationshipTypeLabel,
};
