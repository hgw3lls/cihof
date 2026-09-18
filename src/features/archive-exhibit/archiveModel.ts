import { useEffect, useState } from 'react';
import { loadRuntimeDataBundle, subscribeRuntimeDataBundleChanges } from '../../data/runtimeDataBundle';
import type { EntityRelationshipRecord, Inductee, RuntimeVideoAsset } from '../../data/types';

export type Scene = 'people' | 'links' | 'years';
export type Film = { person: Inductee; asset: RuntimeVideoAsset; index: number; approved: boolean; key: string };
export type Link = { person: Inductee; kind: 'archive' | 'class'; context: string };

export function useArchiveRelationships() {
  const [relationships, setRelationships] = useState<EntityRelationshipRecord[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void loadRuntimeDataBundle().then((bundle) => {
        const document = bundle.entityRelationships as { relationships?: unknown } | undefined;
        const entries = Array.isArray(document?.relationships) ? document.relationships : [];
        if (!cancelled) setRelationships(entries.filter(isPersonRelationship));
      }).catch(() => { if (!cancelled) setRelationships([]); });
    };
    load();
    const unsubscribe = subscribeRuntimeDataBundleChanges(load);
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  return relationships;
}

function isPersonRelationship(value: unknown): value is EntityRelationshipRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<EntityRelationshipRecord>;
  return typeof item.sourceEntityId === 'string' && item.sourceEntityId.startsWith('person:')
    && typeof item.targetEntityId === 'string' && item.targetEntityId.startsWith('person:')
    && (item.type === 'inducted_by_candidate' || item.type === 'related_to');
}

export function archiveLinks(person: Inductee, people: Inductee[], relationships: EntityRelationshipRecord[]): Link[] {
  const byId = new Map(people.map((item) => [item.id, item]));
  const seen = new Set([person.id]);
  const links: Link[] = [];
  for (const relationship of relationships) {
    const source = relationship.sourceEntityId === `person:${person.id}`;
    const target = relationship.targetEntityId === `person:${person.id}`;
    if (!source && !target) continue;
    const id = (source ? relationship.targetEntityId : relationship.sourceEntityId).slice(7);
    const related = byId.get(id);
    if (!related || seen.has(id)) continue;
    seen.add(id);
    links.push({ person: related, kind: 'archive', context: relationship.shortDescription || relationship.displayLabel || 'Archive relationship' });
  }
  for (const related of people) {
    if (related.classYear !== person.classYear || seen.has(related.id)) continue;
    seen.add(related.id);
    links.push({ person: related, kind: 'class', context: `Also in the Class of ${person.classYear}` });
  }
  return links;
}

export function publicReadyFilm(asset: RuntimeVideoAsset) {
  return Boolean(asset.approvedForKiosk && asset.rightsStatus === 'approved'
    && asset.captionStatus === 'approved' && asset.captionRuntimePath
    && asset.transcriptStatus === 'approved' && asset.transcriptRuntimePath
    && asset.runtimePath && asset.posterRuntimePath);
}

export function assetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export function portraitUrl(person: Inductee) {
  return assetUrl(person.primaryImageUrl);
}

export function duration(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds)) return 'FILM';
  const value = Math.round(seconds ?? 0);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
