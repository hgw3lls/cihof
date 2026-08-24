import { useEffect, useMemo, useRef, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { QRCodePanel } from '../../components/QRCodePanel';
import { stopMediaElement } from '../../app/mediaControl';
import { useMediaManifest, useMediaRecordMap } from '../../data/useMediaManifest';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import type {
  Inductee,
  RelationshipProvenance,
  RelationshipRecord,
  RelationshipType,
  RuntimeAudioAsset,
  RuntimeMediaRecord,
  RuntimeVideoAsset,
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

export type DetailAction = 'overview' | 'story' | 'watch' | 'connections' | 'continue';

type WatchAvailability = {
  playable: boolean;
  status: string;
  message: string;
};

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

  const related = useMemo(() => {
    if (!inductee) return [];
    return buildRelated(inductee, allInductees, relationships);
  }, [allInductees, inductee, relationships]);

  const mediaRecord = inductee ? mediaRecordMap.get(inductee.id) : undefined;
  const gallery = useMemo(() => {
    if (!inductee) return [];
    const manifestImages = [
      mediaRecord?.images?.primary?.runtimePath,
      ...(mediaRecord?.images?.gallery ?? []).map((image) => image.runtimePath),
    ].filter((url): url is string => Boolean(url));
    return Array.from(new Set([inductee.primaryImageUrl, ...manifestImages, ...inductee.imageUrls].filter(Boolean))).slice(0, 12);
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
    return () => {
      if (actionFocusFrameRef.current !== null) window.cancelAnimationFrame(actionFocusFrameRef.current);
    };
  }, []);

  if (!inductee) return null;

  const activeLightboxUrl = lightboxIndex === null ? '' : gallery[lightboxIndex];
  const explicitContext = explicitContextLabel(inductee);
  const summary = whySummary(inductee);
  const connectionSummary = summarizeConnections(related);
  const watchAvailability = mediaAvailability(inductee, mediaRecord, kioskMode);
  const continuationUrl = qrEnabled ? canonicalContinuationUrl(inductee) : '';
  const detailModeClass = staffMode ? 'detail--staff' : 'detail--visitor';

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
    <aside className={`detail detail--museum ${detailModeClass} detail--action-${activeAction}`} aria-label={`${inductee.name} details`} ref={detailRef}>
      <section className="detail__surface">
        {(staffMode || wallDebug) && (
          <header className="detail__topbar" aria-label="Person view controls">
            <button type="button" onClick={onClose}>Back</button>
            <button type="button" onClick={onHome}>Home</button>
            <button type="button" onClick={() => onFindConnection(inductee)}>Find A Connection</button>
            <button type="button" onClick={onReset}>Reset</button>
          </header>
        )}

        <div className={`detail__scene detail__scene--${activeAction}`}>
          <div className="detail__stage">
            <section className="detail__identity" aria-label={`${inductee.name} profile`}>
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
                <p className="person-focus__lens">PERSON</p>
                <h2 className="detail__name">{inductee.name}</h2>
                <p className="person-focus__class">{inductee.classYear ? `Class of ${inductee.classYear}` : 'Class year unknown'}</p>
                {explicitContext && <p className="person-focus__context">{explicitContext}</p>}
                <section className="person-focus__why" aria-label="Why they are in the Hall of Fame">
                  <h3>WHY ARE THEY HERE?</h3>
                  <p className="detail__summary">{summary}</p>
                </section>
                {wallDebug && <WallDebugPanel inductee={inductee} />}
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
                    <p className="museum-kicker">Watch</p>
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
                    <p className="museum-kicker">Connections</p>
                    <h3>WHO THEY CONNECT TO</h3>
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
              </section>
            )}

            {activeAction === 'continue' && continuationUrl && (
              <QRCodePanel
                value={continuationUrl}
                title={inductee.name}
                instruction="Scan with your phone to continue this story on the CIHOF website."
                onAutoClose={() => setAction('overview')}
                onClose={() => setAction('overview')}
              />
            )}
          </section>
        </div>

        <nav className={continuationUrl ? 'detail__actionRail detail__actionRail--with-continuation' : 'detail__actionRail'} aria-label="Person actions">
          <button type="button" className={activeAction === 'story' ? 'detail__actionButton detail__actionButton--active' : 'detail__actionButton'} onClick={() => setAction('story')}>
            <span>STORY</span>
          </button>
          <button
            type="button"
            className={activeAction === 'watch' ? 'detail__actionButton detail__actionButton--active' : 'detail__actionButton'}
            onClick={() => setAction('watch')}
          >
            <span>WATCH</span>
            <small>{watchAvailability.status}</small>
          </button>
          <button type="button" className={activeAction === 'connections' ? 'detail__actionButton detail__actionButton--active' : 'detail__actionButton'} onClick={() => setAction('connections')}>
            <span>CONNECTIONS</span>
          </button>
          <button type="button" className="detail__actionButton detail__actionButton--accent" onClick={() => onFindConnection(inductee)}>
            <span>FOLLOW A THREAD -&gt;</span>
          </button>
          {continuationUrl && (
            <button
              type="button"
              className={activeAction === 'continue' ? 'detail__actionButton detail__actionButton--active detail__actionButton--continue' : 'detail__actionButton detail__actionButton--continue'}
              onClick={() => setAction('continue')}
            >
              <span>CONTINUE THIS STORY -&gt;</span>
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

function explicitContextLabel(inductee: Inductee) {
  const community = firstText(inductee.communityTags);
  if (community) return community;

  if (isExplicitSource(inductee.themeTagsSource)) {
    const theme = firstText(inductee.themeTags);
    if (theme) return theme;
  }

  if (isExplicitSource(inductee.countryTagsSource)) {
    const country = firstText(inductee.countryTags);
    if (country) return country;
  }

  if (inductee.inductedBy) return `Inducted by ${inductee.inductedBy}`;
  return '';
}

function firstText(values: string[]) {
  return values.find((value) => value.trim().length > 0)?.trim() ?? '';
}

function isExplicitSource(source: string) {
  return source === 'curated' || source === 'documented';
}

function mediaAvailability(inductee: Inductee, mediaRecord: RuntimeMediaRecord | undefined, kioskMode: boolean): WatchAvailability {
  const approvedVideos = (mediaRecord?.videos ?? []).filter(isApprovedPlayableMediaForDetail);
  const approvedAudio = [...(mediaRecord?.oralHistories ?? []), ...(mediaRecord?.audio ?? [])].filter(isApprovedPlayableMediaForDetail);
  const legacyLocalVideos = mediaRecord ? [] : inductee.localVideoPaths.filter(Boolean);
  const youtubeIds = new Set([
    ...(mediaRecord?.videos ?? []).map((video) => video.youtubeVideoId).filter((id): id is string => Boolean(id)),
    ...inductee.youtubeVideoIds,
  ]);
  const playableCount = approvedVideos.length + approvedAudio.length + legacyLocalVideos.length + (!kioskMode ? youtubeIds.size : 0);

  if (playableCount > 0) {
    return {
      playable: true,
      status: approvedVideos.length + legacyLocalVideos.length > 0 ? 'Footage ready' : approvedAudio.length > 0 ? 'Audio ready' : 'Stream available',
      message: '',
    };
  }

  if (kioskMode && youtubeIds.size > 0) {
    return {
      playable: false,
      status: 'Needs local media',
      message: 'Streaming fallback media exists for this inductee, but it is hidden in museum kiosk mode until an approved local file is installed.',
    };
  }

  if ((mediaRecord?.videos?.length ?? 0) > 0 || inductee.hasVideo) {
    return {
      playable: false,
      status: 'Awaiting approval',
      message: 'Induction footage is referenced in the collection data, but no rights-approved local playback file is available for this installation yet.',
    };
  }

  return {
    playable: false,
    status: 'No media yet',
    message: 'No approved induction footage or oral history media is linked for this inductee yet. Their story remains available through the profile text and collection images.',
  };
}

function canonicalContinuationUrl(inductee: Inductee) {
  const candidate = inductee.profileUrl.trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch {
    return '';
  }
}

function isApprovedPlayableMediaForDetail(asset: RuntimeVideoAsset | RuntimeAudioAsset) {
  const captionsReady = asset.captionStatus === undefined || asset.captionStatus === 'approved' || asset.captionStatus === 'not-applicable';
  const transcriptReady = asset.transcriptStatus === 'approved' || asset.transcriptStatus === 'not-applicable' || Boolean(asset.transcript?.text);
  return Boolean(asset.approvedForKiosk && asset.rightsStatus === 'approved' && captionsReady && transcriptReady && asset.runtimePath);
}

function whySummary(inductee: Inductee) {
  const preferred = cleanSummaryText(inductee.bioText || inductee.storySummary, inductee.name);
  const fallback = cleanSummaryText(inductee.storySummary, inductee.name);
  const source = wordCount(preferred) >= 24 ? preferred : fallback;
  const opening = firstCompleteSentence(source);
  const highlight = inductee.storyHighlights
    .map((item) => cleanSummaryText(item, inductee.name))
    .find((item) => item && !item.includes('...') && !isRepeatedSummaryPiece(item, opening));
  return limitWords([opening, highlight].filter(Boolean).join(' ') || source, 46);
}

function cleanSummaryText(text: string, name: string) {
  const withoutMediaTail = text.split(/Watch the video|Here is a video|See more photos|Congratulations|Back to /i)[0] || text;
  return stripLeadingName(withoutMediaTail.replace(/\s+/g, ' ').trim(), name);
}

function stripLeadingName(text: string, name: string) {
  const variants = [
    name,
    name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);
  const lower = text.toLowerCase();
  const match = variants.find((variant) => lower.startsWith(variant.toLowerCase()));
  return match ? text.slice(match.length).replace(/^[-:,\s]+/, '').trim() : text;
}

function limitWords(text: string, maxWords: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ').replace(/[,;:]+$/, '')}...`;
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function firstCompleteSentence(text: string) {
  const protectedText = text
    .replace(/\b(i\.e|e\.g|Mr|Mrs|Ms|Dr|Jr|Sr|St|Fr|Hon|Rev)\./g, (match) => match.replace(/\./g, '<dot>'))
    .replace(/\b([A-Z])\./g, '$1<dot>');
  const sentence = protectedText.match(/[^.!?]+[.!?]+/)?.[0] ?? text;
  return sentence.replace(/<dot>/g, '.').trim();
}

function isRepeatedSummaryPiece(piece: string, base: string) {
  const pieceWords = normalizedWords(piece);
  const baseText = ` ${normalizedWords(base).join(' ')} `;
  for (let index = 0; index <= pieceWords.length - 4; index += 1) {
    if (baseText.includes(` ${pieceWords.slice(index, index + 4).join(' ')} `)) return true;
  }
  return false;
}

function normalizedWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
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
