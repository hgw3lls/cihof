import { useEffect, useMemo, useRef, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { QRCodePanel } from '../../components/QRCodePanel';
import { RouteLine } from '../../components/RouteLine';
import { stopMediaElement } from '../../app/mediaControl';
import { honoredForSummary, inducteeContextLabel } from '../../data/inducteeNarrative';
import { isVisitorReadyArchiveLead, useArchiveLeads } from '../../data/useArchiveLeads';
import { useMediaManifest, useMediaRecordMap } from '../../data/useMediaManifest';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import { buildPersonGallery, canonicalContinuationUrl, mediaAvailability } from './personDetailModel';
import type {
  ArchiveLead,
  Inductee,
  RelationshipProvenance,
  RelationshipRecord,
  RelationshipType,
} from '../../data/types';
import { MediaExperience } from './MediaExperience';
import { StoryMode } from './StoryMode';

type InducteeDetailProps = {
  inductee: Inductee | null;
  allInductees: Inductee[];
  relationships: RelationshipRecord[];
  kioskMode: boolean;
  qrEnabled: boolean;
  soundEnabled: boolean;
  initialAction?: DetailAction;
  previousInductee: Inductee | null;
  nextInductee: Inductee | null;
  staffMode?: boolean;
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

export type DetailAction = 'overview' | 'story' | 'watch' | 'connections' | 'archive' | 'continue';

export function InducteeDetail({
  inductee,
  allInductees,
  relationships,
  kioskMode,
  qrEnabled,
  soundEnabled,
  initialAction = 'overview',
  previousInductee,
  nextInductee,
  staffMode = false,
  wallDebug = false,
  onClose,
  onHome,
  onReset,
  onSelect,
  onFindConnection,
}: InducteeDetailProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<DetailAction>('overview');
  const detailRef = useRef<HTMLElement | null>(null);
  const actionStageRef = useRef<HTMLElement | null>(null);
  const actionFocusFrameRef = useRef<number | null>(null);
  const { records: storySectionRecords } = useStorySections();
  const storySectionMap = useStorySectionMap(storySectionRecords);
  const { records: mediaRecords } = useMediaManifest();
  const mediaRecordMap = useMediaRecordMap(mediaRecords);
  const { records: archiveLeadRecords } = useArchiveLeads();

  const related = useMemo(() => {
    if (!inductee) return [];
    return buildRelated(inductee, allInductees, relationships);
  }, [allInductees, inductee, relationships]);

  const mediaRecord = inductee ? mediaRecordMap.get(inductee.id) : undefined;
  const gallery = useMemo(() => {
    if (!inductee) return [];
    return buildPersonGallery(inductee, mediaRecord);
  }, [inductee, mediaRecord]);
  const storyRecord = inductee ? storySectionMap.get(inductee.id) : undefined;
  const archiveItems = useMemo(() => {
    if (!inductee) return [];
    return archiveLeadRecords
      .filter((record) => record.inducteeId === inductee.id && isVisitorReadyArchiveLead(record))
      .slice(0, 4);
  }, [archiveLeadRecords, inductee]);

  useEffect(() => {
    if (!inductee) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (event.key === 'Escape') setLightboxIndex(null);
        if (event.key === 'ArrowLeft') setLightboxIndex((current) => cycleImage(current, gallery.length, -1));
        if (event.key === 'ArrowRight') setLightboxIndex((current) => cycleImage(current, gallery.length, 1));
        return;
      }
      if (activeAction !== 'overview') {
        if (event.key === 'Escape') setActiveAction('overview');
        return;
      }
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && previousInductee) selectPerson(previousInductee);
      if (event.key === 'ArrowRight' && nextInductee) selectPerson(nextInductee);
    };

    if (staffMode) document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      if (staffMode) document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeAction, gallery.length, inductee, lightboxIndex, nextInductee, onClose, onSelect, previousInductee, staffMode]);

  useEffect(() => {
    setLightboxIndex(null);
    setActiveAction(initialAction);
    detailRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [inductee?.id, initialAction]);

  useEffect(() => {
    if (activeAction === 'archive' && archiveItems.length === 0) setActiveAction('overview');
  }, [activeAction, archiveItems.length]);

  useEffect(() => {
    return () => {
      if (actionFocusFrameRef.current !== null) window.cancelAnimationFrame(actionFocusFrameRef.current);
    };
  }, []);

  if (!inductee) return null;

  const activeLightboxUrl = lightboxIndex === null ? '' : gallery[lightboxIndex];
  const explicitContext = inducteeContextLabel(inductee);
  const summary = honoredForSummary(inductee);
  const connectionSummary = summarizeConnections(related);
  const watchAvailability = mediaAvailability(inductee, mediaRecord, kioskMode);
  const continuationUrl = qrEnabled ? canonicalContinuationUrl(inductee) : '';
  const detailModeClass = staffMode ? 'detail--staff' : 'detail--visitor';
  const archiveAvailable = archiveItems.length > 0;

  function selectPerson(person: Inductee) {
    stopDetailMedia();
    onSelect(person);
  }

  function setAction(action: DetailAction) {
    if (action === 'continue' && !continuationUrl) return;
    if (action !== 'watch') stopDetailMedia();
    setActiveAction(action);
    if (action !== 'overview') {
      if (actionFocusFrameRef.current !== null) window.cancelAnimationFrame(actionFocusFrameRef.current);
      actionFocusFrameRef.current = window.requestAnimationFrame(() => {
        actionFocusFrameRef.current = null;
        actionStageRef.current?.focus({ preventScroll: true });
      });
    }
  }

  function stopDetailMedia() {
    detailRef.current?.querySelectorAll('video, audio').forEach((media) => {
      if (!(media instanceof HTMLMediaElement)) return;
      stopMediaElement(media);
    });
    detailRef.current?.querySelectorAll('iframe').forEach((frame) => {
      frame.src = frame.src;
    });
    window.dispatchEvent(new Event('cihof:stop-media'));
  }

  return (
    <aside className={`detail detail--museum ${detailModeClass} detail--action-${activeAction}`} aria-label={`${inductee.name} recognition record`} ref={detailRef}>
      <section className="detail__surface">
        {(staffMode || wallDebug) && (
          <header className="detail__topbar" aria-label="Person view controls">
            <button type="button" onClick={onClose}>Back</button>
            <button type="button" onClick={onHome}>Home</button>
            <button type="button" onClick={() => onFindConnection(inductee)}>Find In Common</button>
            <button type="button" onClick={onReset}>Reset</button>
          </header>
        )}

        <div className={`detail__scene detail__scene--${activeAction}`}>
          <div className="detail__stage">
            <section className="detail__identity" aria-label={`${inductee.name} honored life`}>
              <figure
                className="detail__portrait person-focus__portrait"
                data-transition-person={inductee.id}
                data-transition-role="person-portrait"
              >
                <FallbackImage
                  alt={inductee.imageAltText}
                  className="detail__portraitImage"
                  fallbackClassName="detail__heroFallback"
                  fallbackLabel={initials(inductee.name)}
                  loading="eager"
                  src={inductee.primaryImageUrl}
                />
              </figure>

              <div className="detail__identityText">
                <p className="person-focus__lens">HONORED LIFE</p>
                <h2 className="detail__name">{inductee.name}</h2>
                <p className="person-focus__class">{inductee.classYear ? `Class of ${inductee.classYear}` : 'Class year unknown'}</p>
                {explicitContext && <p className="person-focus__context">{explicitContext}</p>}
                <section className="person-focus__why" aria-label="Why this person is honored">
                  <h3>HONORED FOR</h3>
                  <p className="detail__summary">{summary}</p>
                </section>
                {wallDebug && <WallDebugPanel inductee={inductee} />}
              </div>

              <div className="detail__traceLayer" aria-hidden="true">
                <RouteLine className="detail__trace detail__trace--portrait" path="kink" tone="route" start="dot" end="dot" />
                <RouteLine className="detail__trace detail__trace--context" path="horizontal" tone="quiet" end="none" />
                <span className="detail__traceNote detail__traceNote--class">{inductee.classYear ? `Class ${inductee.classYear}` : 'Class pending'}</span>
                {explicitContext && <span className="detail__traceNote detail__traceNote--context">{explicitContext}</span>}
              </div>
            </section>
          </div>

          <section className={`detail__actionStage detail__actionStage--${activeAction}`} aria-label="Selected action" ref={actionStageRef} tabIndex={-1}>
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

            {activeAction === 'watch' && (
              watchAvailability.playable ? (
                <MediaExperience
                  gallery={gallery}
                  inductee={inductee}
                  kioskMode={kioskMode}
                  mediaRecord={mediaRecord}
                  soundEnabled={soundEnabled}
                  onOpenImage={setLightboxIndex}
                />
              ) : (
                <section className="person-watch-empty" aria-label="Watch unavailable">
                  <div>
                    <p className="museum-kicker">Watch Induction</p>
                    <h3>NO APPROVED MEDIA INSTALLED</h3>
                  </div>
                  <p>{watchAvailability.message}</p>
                  <FallbackImage
                    alt={inductee.imageAltText}
                    className="person-watch-empty__image"
                    fallbackClassName="person-watch-empty__fallback"
                    fallbackLabel={initials(inductee.name)}
                    src={inductee.primaryImageUrl}
                  />
                </section>
              )
            )}

            {activeAction === 'connections' && (
              <section className="person-connections" aria-label="Related inductees">
                <header className="person-connections__header">
                  <div>
                    <p className="museum-kicker">In Common</p>
                    <h3>WHAT CONNECTS THEM</h3>
                  </div>
                  <span>{connectionSummary}</span>
                </header>
                <div className="detail__relatedGrid">
                  {related.map((item, index) => (
                    <button
                      aria-label={`${item.inductee.name}. ${item.relationship.displayLabel}. ${provenanceLabel(item.relationship.provenance)}.`}
                      className={`detail__relatedCard detail__relatedCard--${item.relationship.provenance}`}
                      data-transition-person={item.inductee.id}
                      data-transition-role="person-related"
                      key={`${item.relationship.sourcePersonId}-${item.relationship.targetEntityId}-${item.relationship.type}-${index}`}
                      type="button"
                      onClick={() => selectPerson(item.inductee)}
                    >
                      <FallbackImage
                        alt={item.inductee.imageAltText}
                        className="detail__relatedImage"
                        fallbackClassName="detail__relatedFallback"
                        fallbackLabel={initials(item.inductee.name)}
                        src={item.inductee.primaryImageUrl}
                      />
                      <span className="detail__relatedBody">
                        <strong>{item.inductee.name}</strong>
                        <small className="detail__relationshipLabel">{item.relationship.displayLabel}</small>
                        <span className="detail__relationshipMeta" aria-label="Relationship context">
                          <span>{relationshipTypeLabel(item.relationship.type)}</span>
                          <span className={`detail__relationshipProvenance detail__relationshipProvenance--${item.relationship.provenance}`}>
                            {provenanceLabel(item.relationship.provenance)}
                          </span>
                        </span>
                        {item.relationship.referenceNote && <em className="detail__relationshipNote">{item.relationship.referenceNote}</em>}
                      </span>
                    </button>
                  ))}
                  {related.length === 0 && <div className="detail__relatedEmpty">No reviewed relationship data is available for this inductee yet.</div>}
                </div>
              </section>
            )}

            {activeAction === 'archive' && archiveAvailable && (
              <ArchiveMode
                inductee={inductee}
                items={archiveItems}
                onExit={() => setAction('overview')}
              />
            )}

            {activeAction === 'continue' && continuationUrl && (
              <QRCodePanel
                value={continuationUrl}
                title={inductee.name}
                instruction="Scan to continue on the Cleveland International Hall of Fame website."
                onAutoClose={() => setAction('overview')}
                onClose={() => setAction('overview')}
              />
            )}
          </section>
        </div>

        <nav className={[
          'detail__actionRail',
          continuationUrl ? 'detail__actionRail--with-continuation' : '',
          watchAvailability.playable ? 'detail__actionRail--has-watch' : 'detail__actionRail--no-watch',
          archiveAvailable ? 'detail__actionRail--has-archive' : '',
        ].filter(Boolean).join(' ')} aria-label="Actions for this inductee">
          <button type="button" className={activeAction === 'story' ? 'detail__actionButton detail__actionButton--story detail__actionButton--active' : 'detail__actionButton detail__actionButton--story'} onClick={() => setAction('story')}>
            <span>LIFE + WORK</span>
          </button>
          {watchAvailability.playable && (
            <button
              type="button"
              className={activeAction === 'watch' ? 'detail__actionButton detail__actionButton--watch detail__actionButton--active' : 'detail__actionButton detail__actionButton--watch'}
              onClick={() => setAction('watch')}
            >
              <span>WATCH INDUCTION</span>
              <small>{watchAvailability.status}</small>
            </button>
          )}
          <button type="button" className={activeAction === 'connections' ? 'detail__actionButton detail__actionButton--connections detail__actionButton--active' : 'detail__actionButton detail__actionButton--connections'} onClick={() => setAction('connections')}>
            <span>IN COMMON</span>
          </button>
          {archiveAvailable && (
            <button type="button" className={activeAction === 'archive' ? 'detail__actionButton detail__actionButton--archive detail__actionButton--active' : 'detail__actionButton detail__actionButton--archive'} onClick={() => setAction('archive')}>
              <span>FROM ARCHIVE</span>
              <small>{archiveItems.length} item{archiveItems.length === 1 ? '' : 's'}</small>
            </button>
          )}
          <button type="button" className="detail__actionButton detail__actionButton--accent" onClick={() => onFindConnection(inductee)}>
            <span>FOLLOW THE TRACE -&gt;</span>
          </button>
          {continuationUrl && (
            <button
              type="button"
              className={activeAction === 'continue' ? 'detail__actionButton detail__actionButton--active detail__actionButton--continue' : 'detail__actionButton detail__actionButton--continue'}
              onClick={() => setAction('continue')}
            >
              <span>TAKE IT WITH YOU -&gt;</span>
            </button>
          )}
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

function ArchiveMode({
  inductee,
  items,
  onExit,
}: {
  inductee: Inductee;
  items: ArchiveLead[];
  onExit: () => void;
}) {
  return (
    <section className="person-archive" aria-label={`${inductee.name} archive items`}>
      <header className="person-archive__header">
        <div>
          <p className="museum-kicker">From The Archive</p>
          <h3>ARCHIVAL RECORDS</h3>
        </div>
        <span>{items.length} cleared item{items.length === 1 ? '' : 's'}</span>
      </header>

      <div className="person-archive__grid">
        {items.map((item) => (
          <article className={`person-archive-card person-archive-card--${item.connectionStrength}`} key={item.id}>
            <div className="person-archive-card__meta">
              <span>{connectionStrengthLabel(item.connectionStrength)}</span>
              {item.sourceType && <span>{item.sourceType}</span>}
            </div>
            <h4>{item.title}</h4>
            <p>{item.displayText}</p>
            <dl>
              <div>
                <dt>Repository</dt>
                <dd>{item.repository}</dd>
              </div>
              {item.collectionTitle && (
                <div>
                  <dt>Collection</dt>
                  <dd>{item.collectionTitle}</dd>
                </div>
              )}
              {item.callNumber && (
                <div>
                  <dt>Call No.</dt>
                  <dd>{item.callNumber}</dd>
                </div>
              )}
              {item.creditLine && (
                <div>
                  <dt>Credit</dt>
                  <dd>{item.creditLine}</dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>

      <button className="person-archive__exit" type="button" onClick={onExit}>Back To Record</button>
    </section>
  );
}

function connectionStrengthLabel(value: ArchiveLead['connectionStrength']) {
  if (value === 'direct') return 'Direct';
  if (value === 'institutional') return 'Institutional';
  return 'Context';
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
    referenceNote: 'Suggested from existing related records; needs curatorial review.',
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
    shared_theme: 'Shared field',
    shared_organization: 'Shared organization',
    shared_community: 'Shared community',
    civic_collaboration: 'Civic work',
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
    documented: 'Record',
    curated: 'Reviewed',
    inferred: 'Review needed',
  };
  return labels[provenance];
}

function summarizeConnections(related: RelatedItem[]) {
  if (related.length === 0) return 'No reviewed ties yet';
  const noun = related.length === 1 ? 'tie' : 'ties';
  const allInferred = related.every((item) => item.relationship.provenance === 'inferred');
  return allInferred ? `${related.length} needs review ${noun}` : `${related.length} reviewed ${noun}`;
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
