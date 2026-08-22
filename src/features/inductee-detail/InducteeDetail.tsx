import { useEffect, useMemo, useRef, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { countryOrRegionLabel } from '../../data/inducteeLabels';
import { portraitImageUrl } from '../../data/portraitImages';
import { useMediaManifest, useMediaRecordMap } from '../../data/useMediaManifest';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import type { Inductee, RelationshipProvenance, RelationshipRecord, RelationshipType } from '../../data/types';
import { MediaExperience } from './MediaExperience';
import { StoryMode } from './StoryMode';

type InducteeDetailProps = {
  inductee: Inductee | null;
  allInductees: Inductee[];
  relationships: RelationshipRecord[];
  kioskMode: boolean;
  previousInductee: Inductee | null;
  nextInductee: Inductee | null;
  wallDebug?: boolean;
  onClose: () => void;
  onHome: () => void;
  onReset: () => void;
  onSelect: (inductee: Inductee) => void;
  onFindConnection: (inductee: Inductee) => void;
};

type RelatedItem = {
  inductee: Inductee;
  relationship: RelationshipRecord;
};

type DetailFact = {
  label: string;
  value: string;
};

type DetailAction = 'overview' | 'story' | 'media' | 'photos';

export function InducteeDetail({
  inductee,
  allInductees,
  relationships,
  kioskMode,
  previousInductee,
  nextInductee,
  wallDebug = false,
  onClose,
  onHome,
  onReset,
  onSelect,
  onFindConnection,
}: InducteeDetailProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<DetailAction>('overview');
  const [movementCue, setMovementCue] = useState('');
  const detailRef = useRef<HTMLElement | null>(null);
  const actionStageRef = useRef<HTMLElement | null>(null);
  const { records: storySectionRecords } = useStorySections();
  const storySectionMap = useStorySectionMap(storySectionRecords);
  const { records: mediaRecords } = useMediaManifest();
  const mediaRecordMap = useMediaRecordMap(mediaRecords);

  const related = useMemo(() => {
    if (!inductee) return [];
    return buildRelated(inductee, allInductees, relationships);
  }, [allInductees, inductee, relationships]);

  const differentInductee = useMemo(() => {
    if (!inductee) return null;
    return pickDifferentInductee(allInductees, inductee);
  }, [allInductees, inductee]);

  const mediaRecord = inductee ? mediaRecordMap.get(inductee.id) : undefined;
  const gallery = useMemo(() => {
    if (!inductee) return [];
    const manifestImages = [
      portraitImageUrl(inductee, 'profile'),
      portraitImageUrl(inductee, 'source'),
      mediaRecord?.images?.primary?.runtimePath,
      ...(mediaRecord?.images?.gallery ?? []).map((image) => image.runtimePath),
    ].filter((url): url is string => Boolean(url));
    return Array.from(new Set([...manifestImages, ...inductee.imageUrls].filter(Boolean))).slice(0, 12);
  }, [inductee, mediaRecord]);
  const storyRecord = inductee ? storySectionMap.get(inductee.id) : undefined;

  useEffect(() => {
    if (!inductee) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (event.key === 'Escape') setLightboxIndex(null);
        if (event.key === 'ArrowLeft') setLightboxIndex((current) => cycleImage(current, gallery.length, -1));
        if (event.key === 'ArrowRight') setLightboxIndex((current) => cycleImage(current, gallery.length, 1));
        return;
      }
      if (activeAction === 'story') {
        if (event.key === 'Escape') setActiveAction('overview');
        return;
      }
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && previousInductee) selectPerson(previousInductee);
      if (event.key === 'ArrowRight' && nextInductee) selectPerson(nextInductee);
    };

    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeAction, gallery.length, inductee, lightboxIndex, nextInductee, onClose, onSelect, previousInductee]);

  useEffect(() => {
    setLightboxIndex(null);
    setActiveAction('overview');
    detailRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [inductee?.id]);

  useEffect(() => {
    if (!movementCue) return undefined;
    const timeout = window.setTimeout(() => setMovementCue(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [movementCue]);

  if (!inductee) return null;

  const activeLightboxUrl = lightboxIndex === null ? '' : gallery[lightboxIndex];
  const primaryCountryLabel = countryOrRegionLabel(inductee);
  const communityLabel = inductee.communityTags[0] ?? '';
  const themeTags = inductee.themeTags.slice(0, 4);
  const summary = inductee.storySummary || summarizeSentences(inductee.bioText, 2, 310);
  const connectionSummary = summarizeConnections(related);
  const biography = cleanDetailBiography(inductee.bioText) || summary;
  const overviewHighlights = (inductee.storyHighlights.length > 0 ? inductee.storyHighlights : [summary]).slice(0, 3);
  const localVideoCount = mediaRecord?.videos?.filter((video) => Boolean(video.runtimePath)).length ?? inductee.localVideoPaths.length;
  const audioCount = (mediaRecord?.audio?.length ?? 0) + (mediaRecord?.oralHistories?.length ?? 0);
  const youtubeCount = Array.from(
    new Set([
      ...(mediaRecord?.videos ?? []).map((video) => video.youtubeVideoId).filter((id): id is string => Boolean(id)),
      ...inductee.youtubeVideoIds,
    ]),
  ).length;
  const mediaLabel = [
    gallery.length > 0 ? `${gallery.length} image${gallery.length === 1 ? '' : 's'}` : '',
    localVideoCount > 0 ? `${localVideoCount} local video${localVideoCount === 1 ? '' : 's'}` : '',
    audioCount > 0 ? `${audioCount} audio/oral history item${audioCount === 1 ? '' : 's'}` : '',
    youtubeCount > 0 ? `${youtubeCount} YouTube fallback${youtubeCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' / ') || 'No linked media yet';
  const locationLabel = inductee.countryTags.length > 0
    ? inductee.countryTags.join(' / ')
    : inductee.region && inductee.region !== 'Unknown Region'
      ? inductee.region
      : '';
  const detailFacts: DetailFact[] = [
    { label: 'Class', value: inductee.classYear ? String(inductee.classYear) : 'Year unknown' },
    locationLabel ? { label: inductee.countryTags.length > 0 ? 'Country / Heritage' : 'Broad Region', value: locationLabel } : null,
    inductee.communityTags.length > 0 ? { label: 'Community', value: inductee.communityTags.slice(0, 4).join(' / ') } : null,
    inductee.inductedBy ? { label: 'Inducted By', value: inductee.inductedBy } : null,
    inductee.themeTags.length > 0 ? { label: 'Themes', value: inductee.themeTags.slice(0, 6).join(' / ') } : null,
    { label: 'Media', value: mediaLabel },
    inductee.profileUrl ? { label: 'Source', value: kioskMode ? 'Original profile hidden in kiosk mode' : 'Original CIHOF profile available' } : null,
  ].filter((fact): fact is DetailFact => Boolean(fact));
  const sourceNote = buildSourceNote(inductee);

  function selectPerson(person: Inductee) {
    if (person.id !== inductee?.id) setMovementCue(`Moving through the wall: ${inductee?.name ?? 'Selected portrait'} to ${person.name}`);
    stopDetailMedia();
    onSelect(person);
  }

  function setAction(action: DetailAction) {
    if (action !== 'media') stopDetailMedia();
    setActiveAction(action);
    if (action === 'overview') return;
    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      actionStageRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      actionStageRef.current?.focus({ preventScroll: true });
    });
  }

  function stopDetailMedia() {
    detailRef.current?.querySelectorAll('video, audio').forEach((media) => {
      if (!(media instanceof HTMLMediaElement)) return;
      media.pause();
      media.currentTime = 0;
    });
    detailRef.current?.querySelectorAll('iframe').forEach((frame) => {
      frame.src = frame.src;
    });
    window.dispatchEvent(new Event('cihof:stop-media'));
  }

  return (
    <aside className="detail detail--museum" aria-label={`${inductee.name} details`} ref={detailRef}>
      <section className="detail__surface">
        <header className="detail__topbar" aria-label="Person view controls">
          <button type="button" onClick={onClose}>Back</button>
          <button type="button" onClick={onHome}>Home</button>
          <button type="button" onClick={() => onFindConnection(inductee)}>Find A Connection</button>
          <button type="button" onClick={onReset}>Reset</button>
        </header>

        {movementCue && <div className="detail__movementCue" role="status">{movementCue}</div>}

        <div className="detail__stage">
          <section className="detail__identity" aria-label={`${inductee.name} profile`}>
            <div className="detail__portrait">
              <FallbackImage
                alt={inductee.imageAltText}
                className="detail__portraitImage"
                fallbackClassName="detail__heroFallback"
                fallbackLabel={initials(inductee.name)}
                loading="eager"
                src={portraitImageUrl(inductee, 'profile')}
              />
            </div>

            <div className="detail__identityText">
              <p className="museum-kicker">{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}</p>
              <h2 className="detail__name">{inductee.name}</h2>
              <div className="detail__facts">
                {primaryCountryLabel && <span>{primaryCountryLabel}</span>}
                {communityLabel && <span>{communityLabel}</span>}
                {inductee.inductedBy && <span>Inducted by {inductee.inductedBy}</span>}
              </div>
              {wallDebug && <WallDebugPanel inductee={inductee} />}
              <p className="detail__summary">{summary}</p>
              {themeTags.length > 0 && (
                <div className="detail__themeTags" aria-label="Story themes">
                  {themeTags.map((theme) => (
                    <span key={theme}>{theme}</span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="detail__connections" aria-label="Related inductees">
            <div className="detail__connectionsHeader">
              <p className="museum-kicker">Who They Connect To</p>
              <span>{connectionSummary}</span>
            </div>
            <div className="detail__relatedGrid">
              {related.map((item, index) => (
                <button
                  aria-label={`${item.inductee.name}. ${item.relationship.displayLabel}. ${provenanceLabel(item.relationship.provenance)}.`}
                  className={`detail__relatedCard detail__relatedCard--${item.relationship.provenance}`}
                  key={`${item.relationship.sourcePersonId}-${item.relationship.targetEntityId}-${item.relationship.type}-${index}`}
                  type="button"
                  onClick={() => selectPerson(item.inductee)}
                >
                  <FallbackImage
                    alt={item.inductee.imageAltText}
                    className="detail__relatedImage"
                    fallbackClassName="detail__relatedFallback"
                    fallbackLabel={initials(item.inductee.name)}
                    src={portraitImageUrl(item.inductee, 'thumbnail')}
                  />
                  <span className="detail__relatedBody">
                    <strong>{item.inductee.name}</strong>
                    <small className="detail__relationshipLabel">{item.relationship.displayLabel}</small>
                    <span className="detail__relationshipMeta" aria-label="Relationship reason metadata">
                      <span>{relationshipTypeLabel(item.relationship.type)}</span>
                      <span className={`detail__relationshipProvenance detail__relationshipProvenance--${item.relationship.provenance}`}>
                        {provenanceLabel(item.relationship.provenance)}
                      </span>
                    </span>
                    {item.relationship.referenceNote && <em className="detail__relationshipNote">{item.relationship.referenceNote}</em>}
                  </span>
                </button>
              ))}
              {related.length === 0 && <div className="detail__relatedEmpty">No relationship metadata is available for this inductee yet.</div>}
            </div>
          </aside>
        </div>

        <section
          className={`detail__actionStage detail__actionStage--${activeAction}`}
          aria-label="Selected action"
          ref={actionStageRef}
          tabIndex={-1}
        >
          {activeAction === 'overview' && (
            <article className="detail__overviewPanel">
              <p className="museum-kicker">At A Glance</p>
              <div className="detail__overviewGrid">
                {overviewHighlights.map((highlight, index) => (
                  <span key={`${highlight}-${index}`}>{highlight}</span>
                ))}
              </div>

              <section className="detail__recordPanel" aria-label={`${inductee.name} collection record`}>
                <div className="detail__recordHeader">
                  <div>
                    <p className="museum-kicker">Collection Record</p>
                    <h3>Biography + Details</h3>
                  </div>
                  <div className="detail__recordActions" aria-label="Record shortcuts">
                    <button type="button" onClick={() => setAction('story')}>Their Story</button>
                    <button type="button" onClick={() => setAction('media')}>Media</button>
                    <button type="button" onClick={() => setAction('photos')}>Photos</button>
                  </div>
                </div>

                <div className="detail__recordGrid">
                  <section className="detail__bioBlock" aria-label="Biography record">
                    <h4>Biography</h4>
                    <p className="detail__bioText">{biography}</p>
                  </section>

                  <aside className="detail__recordMeta" aria-label="Profile details">
                    {detailFacts.map((fact) => (
                      <div className="detail__recordFact" key={fact.label}>
                        <span>{fact.label}</span>
                        <strong>{fact.value}</strong>
                      </div>
                    ))}
                    {sourceNote && <p className="detail__recordNote">{sourceNote}</p>}
                    {inductee.profileUrl && !kioskMode && (
                      <a className="source-link" href={inductee.profileUrl} target="_blank" rel="noreferrer">
                        Original profile
                      </a>
                    )}
                    {inductee.profileUrl && kioskMode && <span className="source-link source-link--disabled">Original profile hidden in kiosk mode</span>}
                  </aside>
                </div>

                {related.length > 0 && (
                  <section className="detail__recordRelated" aria-label="Related people in this record">
                    <div className="detail__recordRelatedHeader">
                      <p className="museum-kicker">Related People</p>
                      <button type="button" onClick={() => onFindConnection(inductee)}>Find A Connection</button>
                    </div>
                    <div className="detail__miniRelated">
                      {related.slice(0, 4).map((item, index) => (
                        <button
                          className={`detail__miniRelatedCard detail__miniRelatedCard--${item.relationship.provenance}`}
                          key={`${item.inductee.id}-${item.relationship.type}-${index}`}
                          type="button"
                          onClick={() => selectPerson(item.inductee)}
                        >
                          <FallbackImage
                            alt={item.inductee.imageAltText}
                            className="detail__miniRelatedImage"
                            fallbackClassName="detail__miniRelatedFallback"
                            fallbackLabel={initials(item.inductee.name)}
                            src={portraitImageUrl(item.inductee, 'thumbnail')}
                          />
                          <span>
                            <strong>{item.inductee.name}</strong>
                            <small>{item.relationship.displayLabel}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </section>
            </article>
          )}

          {activeAction === 'story' && (
            <StoryMode
              allInductees={allInductees}
              gallery={gallery}
              inductee={inductee}
              storyRecord={storyRecord}
              onExit={() => setAction('overview')}
              onSelectPerson={selectPerson}
            />
          )}

          {activeAction === 'media' && (
            <MediaExperience
              gallery={gallery}
              inductee={inductee}
              kioskMode={kioskMode}
              mediaRecord={mediaRecord}
              onOpenImage={setLightboxIndex}
            />
          )}

          {activeAction === 'photos' && (
            <section className="detail__photoPanel" aria-label="See photos">
              <p className="museum-kicker">See Photos</p>
              {gallery.length > 0 ? (
                <div className="gallery-grid">
                  {gallery.map((url, index) => (
                    <button className="gallery-grid__button" key={url} type="button" onClick={() => setLightboxIndex(index)}>
                      <FallbackImage alt={`${inductee.imageAltText} Image ${index + 1}.`} fallbackClassName="gallery-grid__fallback" fallbackLabel={initials(inductee.name)} src={url} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="video-empty">No image gallery is linked for this inductee yet.</div>
              )}
            </section>
          )}
        </section>

        <nav className="detail__actionRail" aria-label="Person actions">
          <button type="button" aria-pressed={activeAction === 'story'} className={activeAction === 'story' ? 'detail__actionButton detail__actionButton--active' : 'detail__actionButton'} onClick={() => setAction('story')}>
            Their Story
          </button>
          <button type="button" aria-pressed={activeAction === 'media'} className={activeAction === 'media' ? 'detail__actionButton detail__actionButton--active' : 'detail__actionButton'} onClick={() => setAction('media')}>
            Watch / Listen
          </button>
          <button type="button" aria-pressed={activeAction === 'photos'} className={activeAction === 'photos' ? 'detail__actionButton detail__actionButton--active' : 'detail__actionButton'} onClick={() => setAction('photos')}>
            See Photos
          </button>
          <button type="button" className="detail__actionButton detail__actionButton--accent" disabled={!differentInductee} onClick={() => differentInductee && selectPerson(differentInductee)}>
            Show Me Someone Different
          </button>
        </nav>
      </section>

      {activeLightboxUrl && (
        <div className="lightbox" role="dialog" aria-label={`${inductee.name} image viewer`}>
          <button className="lightbox__scrim" type="button" aria-label="Close image viewer" onClick={() => setLightboxIndex(null)} />
          <div className="lightbox__content">
            <FallbackImage alt={`${inductee.imageAltText} Enlarged image.`} className="lightbox__image" fallbackClassName="lightbox__fallback" fallbackLabel={initials(inductee.name)} loading="eager" src={activeLightboxUrl} />
            <div className="lightbox__bar">
              <button type="button" onClick={() => setLightboxIndex((current) => cycleImage(current, gallery.length, -1))}>Previous</button>
              <span>{(lightboxIndex ?? 0) + 1} / {gallery.length}</span>
              <button type="button" onClick={() => setLightboxIndex((current) => cycleImage(current, gallery.length, 1))}>Next</button>
              <button type="button" onClick={() => setLightboxIndex(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function WallDebugPanel({ inductee }: { inductee: Inductee }) {
  const coordinates = inductee.wallCoordinates
    ? `X ${formatCoordinate(inductee.wallCoordinates.x)} / Y ${formatCoordinate(inductee.wallCoordinates.y)}${inductee.wallCoordinates.width !== undefined ? ` / W ${formatCoordinate(inductee.wallCoordinates.width)}` : ''}${inductee.wallCoordinates.height !== undefined ? ` / H ${formatCoordinate(inductee.wallCoordinates.height)}` : ''}${inductee.wallCoordinates.unit ? ` / ${inductee.wallCoordinates.unit}` : ''}`
    : 'No wall coordinates';

  return (
    <div className="detail__wallDebug" aria-label="Physical portrait wall debug metadata">
      <span>Physical Wall Debug</span>
      <strong>{inductee.wallLabel || inductee.id}</strong>
      <span>
        Panel {inductee.physicalPanel || 'Unset'} / Row {inductee.physicalRow ?? 'Unset'} / Column {inductee.physicalColumn ?? 'Unset'}
      </span>
      <span>{coordinates}</span>
      <span>{inductee.physicalPortraitPresent ? 'Physical portrait present' : 'Physical portrait not marked present'}</span>
    </div>
  );
}

function formatCoordinate(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function cycleImage(current: number | null, total: number, direction: -1 | 1) {
  if (current === null || total <= 0) return null;
  return (current + direction + total) % total;
}

function buildRelated(active: Inductee, allInductees: Inductee[], relationships: RelationshipRecord[]) {
  const byId = new Map(allInductees.map((item) => [item.id, item]));
  const explicitRelationships = uniqueRelatedItems(
    relationships
      .map((relationship) => relationshipToRelatedItem(active, relationship, byId))
      .filter((item): item is RelatedItem => Boolean(item))
      .sort(compareRelatedItems),
  );

  if (explicitRelationships.length > 0) return explicitRelationships.slice(0, 8);

  return active.relatedIds
    .map((id) => byId.get(id))
    .filter((item): item is Inductee => item !== undefined && item.id !== active.id)
    .map((item) => ({ inductee: item, relationship: buildInferredRelationship(active, item) }))
    .slice(0, 8);
}

function relationshipToRelatedItem(active: Inductee, relationship: RelationshipRecord, byId: Map<string, Inductee>): RelatedItem | null {
  if (relationship.sourcePersonId === active.id) {
    const target = byId.get(relationship.targetEntityId);
    if (!target || target.id === active.id) return null;
    return { inductee: target, relationship };
  }

  if (relationship.targetEntityId === active.id) {
    const source = byId.get(relationship.sourcePersonId);
    if (!source || source.id === active.id) return null;
    return { inductee: source, relationship };
  }

  return null;
}

function uniqueRelatedItems(items: RelatedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.inductee.id)) return false;
    seen.add(item.inductee.id);
    return true;
  });
}

function compareRelatedItems(a: RelatedItem, b: RelatedItem) {
  return (
    provenanceRank(a.relationship.provenance) - provenanceRank(b.relationship.provenance) ||
    relationshipTypeRank(a.relationship.type) - relationshipTypeRank(b.relationship.type) ||
    a.inductee.name.localeCompare(b.inductee.name)
  );
}

function provenanceRank(provenance: RelationshipProvenance) {
  if (provenance === 'documented') return 0;
  if (provenance === 'curated') return 1;
  return 2;
}

function relationshipTypeRank(type: RelationshipType) {
  return relationshipTypeOrder.indexOf(type);
}

const relationshipTypeOrder: RelationshipType[] = [
  'inducted_by',
  'same_class',
  'shared_community',
  'shared_organization',
  'civic_collaboration',
  'mentor',
  'colleague',
  'family',
  'shared_theme',
  'related_place',
  'related_event',
];

function buildInferredRelationship(active: Inductee, related: Inductee): RelationshipRecord {
  const inferred = inferFallbackConnection(active, related);
  return {
    sourcePersonId: active.id,
    targetEntityId: related.id,
    type: inferred.type,
    displayLabel: inferred.displayLabel,
    provenance: 'inferred',
    referenceNote: 'Suggested from existing relatedIds and shared metadata; needs curatorial review.',
  };
}

function inferFallbackConnection(active: Inductee, related: Inductee): { type: RelationshipType; displayLabel: string } {
  if (active.inductedBy && active.inductedBy === related.inductedBy) {
    return { type: 'inducted_by', displayLabel: `Shared inducer: ${active.inductedBy}` };
  }
  if (active.classYear !== null && active.classYear === related.classYear) {
    return { type: 'same_class', displayLabel: `Same class: ${active.classYear}` };
  }

  const sharedCommunity = active.communityTags.find((tag) => related.communityTags.includes(tag));
  if (sharedCommunity) return { type: 'shared_community', displayLabel: `Same community: ${sharedCommunity}` };

  const sharedCountry = active.countryTags.find((tag) => related.countryTags.includes(tag));
  if (sharedCountry) return { type: 'related_place', displayLabel: `Same country: ${sharedCountry}` };

  const organization = sharedOrganizations(active, related)[0];
  if (organization) return { type: 'shared_organization', displayLabel: `Shared organization: ${organization}` };

  const civicTheme = sharedCivicThemes(active, related)[0];
  if (civicTheme) return { type: 'civic_collaboration', displayLabel: `Similar civic work: ${civicTheme}` };

  const sharedTheme = active.themeTags.find((theme) => related.themeTags.includes(theme));
  if (sharedTheme) return { type: 'shared_theme', displayLabel: `Shared theme: ${sharedTheme}` };

  return { type: 'shared_theme', displayLabel: 'Suggested relationship for review' };
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

function provenanceLabel(provenance: RelationshipProvenance) {
  const labels: Record<RelationshipProvenance, string> = {
    documented: 'Documented',
    curated: 'Curated',
    inferred: 'Inferred',
  };
  return labels[provenance];
}

function summarizeConnections(related: RelatedItem[]) {
  if (related.length === 0) return 'No links yet';
  const noun = related.length === 1 ? 'link' : 'links';
  const allInferred = related.every((item) => item.relationship.provenance === 'inferred');
  return allInferred ? `${related.length} inferred ${noun}` : `${related.length} reviewed ${noun}`;
}

function pickDifferentInductee(allInductees: Inductee[], current: Inductee) {
  return allInductees
    .filter((item) => item.id !== current.id)
    .map((item) => ({ item, score: differenceScore(current, item) }))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))[0]?.item ?? null;
}

function differenceScore(current: Inductee, candidate: Inductee) {
  let score = 0;
  const sharedCountries = overlapCount(current.countryTags, candidate.countryTags);
  if (sharedCountries === 0) score += current.countryTags.length > 0 || candidate.countryTags.length > 0 ? 42 : 0;
  else score -= sharedCountries * 14;

  score += current.region !== candidate.region ? 28 : -8;
  score += overlapCount(current.communityTags, candidate.communityTags) === 0 ? 28 : -10;
  score += overlapCount(current.themeTags, candidate.themeTags) === 0 ? 22 : -8;
  if (typeof current.classYear === 'number' && typeof candidate.classYear === 'number') {
    score += Math.min(Math.abs(current.classYear - candidate.classYear) / 3, 26);
  }
  if (candidate.featured || candidate.featuredCandidate) score += 4;
  return score;
}

function sharedOrganizations(active: Inductee, related: Inductee) {
  const activeOrgs = extractOrganizations(active.bioText);
  const relatedOrgs = new Set(extractOrganizations(related.bioText));
  return activeOrgs.filter((item) => relatedOrgs.has(item)).slice(0, 2);
}

function extractOrganizations(text: string) {
  const organizationPattern = /\b([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,5}\s+(?:Foundation|Association|Society|Council|Center|Centre|Clinic|University|College|Orchestra|Opera|Museum|League|Institute|Hospital|Church|Federation|Club|School|Theatre|Theater|Board|Committee))\b/g;
  return Array.from(text.matchAll(organizationPattern), (match) => match[1])
    .map((item) => item.trim())
    .filter((item, index, all) => item.length > 4 && all.indexOf(item) === index);
}

function sharedCivicThemes(active: Inductee, related: Inductee) {
  const civicTerms = ['civic', 'community', 'service', 'education', 'health', 'arts', 'culture', 'advocacy', 'public', 'leadership'];
  return active.themeTags.filter((theme) => {
    const lower = theme.toLowerCase();
    return related.themeTags.includes(theme) && civicTerms.some((term) => lower.includes(term));
  });
}

function overlapCount(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item)).length;
}

function cleanDetailBiography(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function buildSourceNote(inductee: Inductee) {
  const notes: string[] = [];
  if (inductee.countryTags.length > 0 && inductee.countryTagsSource && inductee.countryTagsSource !== 'curated') {
    notes.push('Country / heritage labels are awaiting curatorial review and should not be treated as documented facts yet.');
  }
  if (inductee.themeTags.length > 0 && inductee.themeTagsSource && inductee.themeTagsSource !== 'curated') {
    notes.push('Theme labels are awaiting curatorial review.');
  }
  return notes.join(' ');
}

function summarizeSentences(text: string, sentenceCount: number, maxLength: number) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  const summary = sentences.slice(0, sentenceCount).join(' ').trim() || text;
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength).trim()}...`;
}
