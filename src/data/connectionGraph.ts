import type {
  Inductee,
  RelationshipEntityType,
  RelationshipProvenance,
  RelationshipRecord,
  RelationshipType,
} from './types';

export type ConnectionNodeKind = RelationshipEntityType;
export type ConnectionEdgeSource = 'relationship' | 'metadata' | 'relatedIds';

export type ConnectionNode = {
  id: string;
  entityId: string;
  kind: ConnectionNodeKind;
  label: string;
  inductee?: Inductee;
};

export type ConnectionEdge = {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  label: string;
  provenance: RelationshipProvenance;
  referenceNote?: string;
  source: ConnectionEdgeSource;
  weight: number;
};

export type ConnectionGraph = {
  nodes: Map<string, ConnectionNode>;
  adjacency: Map<string, ConnectionEdge[]>;
};

export type ConnectionPath = {
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
  totalWeight: number;
};

type MutableGraph = ConnectionGraph & {
  edgeIds: Set<string>;
};

type SearchState = {
  nodeId: string;
  nodeIds: string[];
  edges: ConnectionEdge[];
  cost: number;
};

export function buildConnectionGraph(inductees: Inductee[], relationships: RelationshipRecord[]): ConnectionGraph {
  const graph: MutableGraph = { nodes: new Map(), adjacency: new Map(), edgeIds: new Set() };
  const peopleById = new Map(inductees.map((item) => [item.id, item]));
  const peopleByName = new Map(inductees.map((item) => [normalizeName(item.name), item]));

  inductees.forEach((inductee) => {
    addNode(graph, personNode(inductee));
  });

  relationships.forEach((relationship) => {
    addExplicitRelationship(graph, relationship, peopleById);
  });

  inductees.forEach((inductee) => {
    addMetadataRelationships(graph, inductee, peopleById, peopleByName);
  });

  return { nodes: graph.nodes, adjacency: graph.adjacency };
}

export function findConnectionPath(graph: ConnectionGraph, sourcePersonId: string, targetPersonId: string, maxEdges = 6): ConnectionPath | null {
  const sourceId = personNodeId(sourcePersonId);
  const targetId = personNodeId(targetPersonId);
  if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId) || sourceId === targetId) return null;

  const queue: SearchState[] = [{ nodeId: sourceId, nodeIds: [sourceId], edges: [], cost: 0 }];
  const best = new Map<string, number>();

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost || a.edges.length - b.edges.length);
    const current = queue.shift();
    if (!current) break;

    if (current.nodeId === targetId && current.edges.length > 0) {
      return {
        nodes: current.nodeIds.map((id) => graph.nodes.get(id)).filter((node): node is ConnectionNode => Boolean(node)),
        edges: current.edges,
        totalWeight: current.cost,
      };
    }

    if (current.edges.length >= maxEdges) continue;

    const stateKey = `${current.nodeId}:${current.edges.length}`;
    const knownCost = best.get(stateKey);
    if (knownCost !== undefined && knownCost < current.cost) continue;

    const edges = graph.adjacency.get(current.nodeId) ?? [];
    edges.forEach((edge) => {
      const nextNodeId = edge.from === current.nodeId ? edge.to : edge.from;
      if (current.nodeIds.includes(nextNodeId)) return;

      const nextCost = current.cost + edge.weight;
      const nextDepth = current.edges.length + 1;
      const nextKey = `${nextNodeId}:${nextDepth}`;
      const bestCost = best.get(nextKey);
      if (bestCost !== undefined && bestCost <= nextCost) return;

      best.set(nextKey, nextCost);
      queue.push({
        nodeId: nextNodeId,
        nodeIds: [...current.nodeIds, nextNodeId],
        edges: [...current.edges, edge],
        cost: nextCost,
      });
    });
  }

  return null;
}

export function connectedPeopleForNode(graph: ConnectionGraph, nodeId: string, limit = 12) {
  const people = new Map<string, Inductee>();
  const edges = graph.adjacency.get(nodeId) ?? [];

  edges.forEach((edge) => {
    const otherId = edge.from === nodeId ? edge.to : edge.from;
    const node = graph.nodes.get(otherId);
    if (node?.kind === 'person' && node.inductee) people.set(node.id, node.inductee);
  });

  return Array.from(people.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

function addExplicitRelationship(graph: MutableGraph, relationship: RelationshipRecord, peopleById: Map<string, Inductee>) {
  const source = peopleById.get(relationship.sourcePersonId);
  if (!source) return;

  const sourceNode = personNode(source);
  const targetPerson = peopleById.get(relationship.targetEntityId);
  const targetNode = targetPerson
    ? personNode(targetPerson)
    : entityNode({
      entityId: relationship.targetEntityId,
      kind: relationship.targetEntityType ?? inferTargetKind(relationship.type),
      label: relationship.targetDisplayName || titleFromEntityId(relationship.targetEntityId),
    });

  addNode(graph, sourceNode);
  addNode(graph, targetNode);
  addEdge(graph, {
    from: sourceNode.id,
    to: targetNode.id,
    type: relationship.type,
    label: relationship.displayLabel,
    provenance: relationship.provenance,
    referenceNote: relationship.referenceNote,
    source: 'relationship',
  });
}

function addMetadataRelationships(
  graph: MutableGraph,
  inductee: Inductee,
  peopleById: Map<string, Inductee>,
  peopleByName: Map<string, Inductee>,
) {
  const source = personNode(inductee);
  addNode(graph, source);

  if (inductee.classYear) {
    const classNode = entityNode({
      entityId: `class-${inductee.classYear}`,
      kind: 'event',
      label: `Class of ${inductee.classYear}`,
    });
    addNode(graph, classNode);
    addEdge(graph, {
      from: source.id,
      to: classNode.id,
      type: 'same_class',
      label: `Class of ${inductee.classYear}`,
      provenance: 'curated',
      referenceNote: 'Class year in the current record.',
      source: 'metadata',
    });
  }

  if (inductee.inductedBy) {
    const matchedPerson = peopleByName.get(normalizeName(inductee.inductedBy));
    const targetNode = matchedPerson && matchedPerson.id !== inductee.id
      ? personNode(matchedPerson)
      : entityNode({
        entityId: `inducted-by-${inductee.inductedBy}`,
        kind: 'organization',
        label: inductee.inductedBy,
      });

    addNode(graph, targetNode);
    addEdge(graph, {
      from: source.id,
      to: targetNode.id,
      type: 'inducted_by',
      label: `Inducted by ${inductee.inductedBy}`,
      provenance: 'curated',
      referenceNote: 'Inducted-by field in the current record.',
      source: 'metadata',
    });
  }

  if (inductee.region) {
    const regionNode = entityNode({
      entityId: `region-${inductee.region}`,
      kind: 'place',
      label: inductee.region,
    });
    addNode(graph, regionNode);
    addEdge(graph, {
      from: source.id,
      to: regionNode.id,
      type: 'related_place',
      label: `Region: ${inductee.region}`,
      provenance: 'curated',
      referenceNote: 'Region in the current record.',
      source: 'metadata',
    });
  }

  inductee.communityTags.forEach((community) => {
    const communityNode = entityNode({ entityId: `community-${community}`, kind: 'community', label: community });
    addNode(graph, communityNode);
    addEdge(graph, {
      from: source.id,
      to: communityNode.id,
      type: 'shared_community',
      label: `Community: ${community}`,
      provenance: 'inferred',
      referenceNote: 'Community tag from prepared metadata; needs curatorial review.',
      source: 'metadata',
    });
  });

  inductee.themeTags.forEach((theme) => {
    const themeNode = entityNode({ entityId: `theme-${theme}`, kind: 'theme', label: theme });
    addNode(graph, themeNode);
    addEdge(graph, {
      from: source.id,
      to: themeNode.id,
      type: 'shared_theme',
      label: `Theme: ${theme}`,
      provenance: 'inferred',
      referenceNote: 'Theme tag from prepared metadata; needs curatorial review.',
      source: 'metadata',
    });
  });

  inductee.relatedIds.forEach((relatedId) => {
    const related = peopleById.get(relatedId);
    if (!related || related.id === inductee.id) return;
    addEdge(graph, {
      from: source.id,
      to: personNodeId(related.id),
      type: 'shared_theme',
      label: 'Suggested related profile',
      provenance: 'inferred',
      referenceNote: 'Generated relatedIds in current data; needs curatorial review.',
      source: 'relatedIds',
    });
  });
}

function addNode(graph: MutableGraph, node: ConnectionNode) {
  if (!graph.nodes.has(node.id)) graph.nodes.set(node.id, node);
  if (!graph.adjacency.has(node.id)) graph.adjacency.set(node.id, []);
}

function addEdge(
  graph: MutableGraph,
  edge: Omit<ConnectionEdge, 'id' | 'weight'>,
) {
  const sortedNodes = [edge.from, edge.to].sort();
  const id = `${sortedNodes[0]}|${sortedNodes[1]}|${edge.type}|${edge.label}|${edge.provenance}`;
  if (edge.from === edge.to || graph.edgeIds.has(id)) return;

  const completeEdge: ConnectionEdge = { ...edge, id, weight: edgeWeight(edge.type, edge.provenance, edge.source) };
  graph.edgeIds.add(id);
  graph.adjacency.get(edge.from)?.push(completeEdge);
  graph.adjacency.get(edge.to)?.push(completeEdge);
}

function edgeWeight(type: RelationshipType, provenance: RelationshipProvenance, source: ConnectionEdgeSource) {
  const provenanceWeight: Record<RelationshipProvenance, number> = {
    documented: 1,
    curated: source === 'relationship' ? 2 : 4,
    inferred: source === 'relationship' ? 7 : 9,
  };
  const typeWeight: Record<RelationshipType, number> = {
    inducted_by: 0,
    mentor: 0,
    colleague: 0,
    family: 0,
    civic_collaboration: 1,
    shared_organization: 1,
    same_class: 2,
    shared_community: 3,
    related_event: 3,
    related_place: 5,
    shared_theme: 5,
  };
  const sourcePenalty = source === 'relatedIds' ? 8 : 0;
  return provenanceWeight[provenance] + typeWeight[type] + sourcePenalty;
}

function personNode(inductee: Inductee): ConnectionNode {
  return {
    id: personNodeId(inductee.id),
    entityId: inductee.id,
    kind: 'person',
    label: inductee.name,
    inductee,
  };
}

function personNodeId(id: string) {
  return `person:${id}`;
}

function entityNode({ entityId, kind, label }: { entityId: string; kind: ConnectionNodeKind; label: string }): ConnectionNode {
  return {
    id: entityNodeId(kind, entityId),
    entityId,
    kind,
    label,
  };
}

function entityNodeId(kind: ConnectionNodeKind, entityId: string) {
  const normalized = slug(entityId);
  if (normalized.startsWith(`${kind}-`)) return `${kind}:${normalized.slice(kind.length + 1)}`;
  return `${kind}:${normalized}`;
}

function inferTargetKind(type: RelationshipType): RelationshipEntityType {
  if (type === 'related_place') return 'place';
  if (type === 'related_event' || type === 'same_class') return 'event';
  if (type === 'shared_community') return 'community';
  if (type === 'shared_theme') return 'theme';
  return 'organization';
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleFromEntityId(entityId: string) {
  const meaningful = entityId.split(':').pop() || entityId;
  return meaningful
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}
