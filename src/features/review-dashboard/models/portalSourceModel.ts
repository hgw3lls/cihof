import {
  honoredForSummary as buildDefaultHonoredForSummary,
  inducteeContextLabel,
} from '../../../data/inducteeNarrative';
import type { Inductee, StorySectionRecord } from '../../../data/types';
import { isMeaningfulDraft } from '../services/portalDrafts';
import type { DraftMap, DraftPatch, ReviewDraft } from '../services/portalDrafts';
import type { MediaManifest, MediaManifestRecord, VideoAsset } from '../services/portalReports';
import type { SourceCurationPacket, SourceStorySectionReviewDraft } from './portalSourcePacket';

export type SourceQueueMode = 'profiles' | 'media' | 'video' | 'relationships' | 'places' | 'organizations' | 'stories' | 'archives' | 'aliases' | 'classes' | 'unresolved';

export type SourceCandidateRow = {
  id: string;
  mode: SourceQueueMode;
  label: string;
  subtitle: string;
  detail: string;
  personId?: string;
  personName?: string;
  sourceUrl?: string;
  sourcePageUrl?: string;
  confidence?: number;
  action?: string;
  fields: Array<{ label: string; value: string }>;
  stageKind: 'profile-note' | 'media-image' | 'video-source' | 'relationship-note' | 'place-note' | 'organization-note' | 'story-note' | 'archive-note' | 'alias-note' | 'class-note' | 'unresolved-note';
  note: string;
  countryCandidates?: string[];
  imageAltText?: string;
  youtubeVideoId?: string;
};

export type ContentAccessRow = {
  inductee: Inductee;
  storyRecord?: StorySectionRecord;
  storyBeatCount: number;
  sourceRows: SourceCandidateRow[];
  archiveRows: SourceCandidateRow[];
  videoLeadRows: SourceCandidateRow[];
  manifestVideos: VideoAsset[];
  approvedVideoCount: number;
  pendingVideoCount: number;
  sourceCount: number;
  focusedCopyReady: boolean;
  score: number;
  signals: string[];
};

export type FocusedCopySuggestion = {
  documentedContextLine: string;
  honoredForSummary: string;
  lifeWorkSummary: string;
  sourceNote: string;
  sourceCount: number;
  sourceLabels: string[];
};

export type BulkSourceStageMode = 'primary' | 'review-note';

export const sourceQueueLabels: Record<SourceQueueMode, string> = {
  profiles: 'Profiles',
  media: 'Image Leads',
  video: 'Video Leads',
  relationships: 'Relationships',
  places: 'Places',
  organizations: 'Organizations',
  stories: 'Story Leads',
  archives: 'Archive Leads',
  aliases: 'Aliases',
  classes: 'Class Evidence',
  unresolved: 'Unresolved',
};

const sourceEvidenceModeOrder: SourceQueueMode[] = ['profiles', 'stories', 'archives', 'relationships', 'places', 'organizations', 'media', 'video', 'aliases', 'classes', 'unresolved'];

function buildContentAccessRows(
  inductees: Inductee[],
  storyRecords: StorySectionRecord[],
  sourceRows: SourceCandidateRow[],
  manifest: MediaManifest | null,
): ContentAccessRow[] {
  const storyById = new Map(storyRecords.map((record) => [record.inducteeId, record]));
  const sourceRowsByPerson = new Map<string, SourceCandidateRow[]>();
  sourceRows.forEach((row) => {
    if (!row.personId) return;
    const current = sourceRowsByPerson.get(row.personId) ?? [];
    current.push(row);
    sourceRowsByPerson.set(row.personId, current);
  });

  return inductees.map((inductee) => {
    const storyRecord = storyById.get(inductee.id);
    const profileSourceRows = sourceRowsByPerson.get(inductee.id) ?? [];
    const archiveRows = profileSourceRows.filter((row) => row.mode === 'archives');
    const videoLeadRows = profileSourceRows.filter((row) => row.mode === 'video');
    const manifestVideos = manifest?.assets?.[inductee.id]?.videos ?? [];
    const approvedVideoCount = manifestVideos.filter((video) => video.approvedForKiosk).length;
    const pendingVideoCount = manifestVideos.filter((video) => !isVideoVisitorReady(video)).length;
    const storyBeatCount = storyRecord?.beats.length ?? 0;
    const focusedCopyReady = Boolean(inductee.documentedContextLine && inductee.honoredForSummary && inductee.lifeWorkSummary);
    const sourceCount = profileSourceRows.length;
    const signals = buildContentAccessSignals({
      archiveRows,
      approvedVideoCount,
      focusedCopyReady,
      pendingVideoCount,
      sourceCount,
      storyBeatCount,
      videoLeadRows,
    });

    return {
      inductee,
      storyRecord,
      storyBeatCount,
      sourceRows: profileSourceRows,
      archiveRows,
      videoLeadRows,
      manifestVideos,
      approvedVideoCount,
      pendingVideoCount,
      sourceCount,
      focusedCopyReady,
      signals,
      score: contentAccessScore({
        archiveRows,
        approvedVideoCount,
        focusedCopyReady,
        pendingVideoCount,
        sourceCount,
        storyBeatCount,
        videoLeadRows,
      }),
    };
  });
}

function buildContentAccessSummary(rows: ContentAccessRow[]) {
  return {
    storyProfiles: rows.filter((row) => row.storyBeatCount > 0).length,
    storyBeats: rows.reduce((sum, row) => sum + row.storyBeatCount, 0),
    archiveProfiles: rows.filter((row) => row.archiveRows.length > 0).length,
    archiveLeads: rows.reduce((sum, row) => sum + row.archiveRows.length, 0),
    directArchiveLeads: rows.reduce((sum, row) => sum + row.archiveRows.filter((archiveRow) => archiveConnectionFromRow(archiveRow) === 'direct').length, 0),
    sourceProfiles: rows.filter((row) => row.sourceCount > 0).length,
    sourceRows: rows.reduce((sum, row) => sum + row.sourceCount, 0),
    approvedVideos: rows.reduce((sum, row) => sum + row.approvedVideoCount, 0),
    pendingManifestVideos: rows.reduce((sum, row) => sum + row.pendingVideoCount, 0),
    videoLeadRows: rows.reduce((sum, row) => sum + row.videoLeadRows.length, 0),
  };
}

function buildContentAccessSignals({
  archiveRows,
  approvedVideoCount,
  focusedCopyReady,
  pendingVideoCount,
  sourceCount,
  storyBeatCount,
  videoLeadRows,
}: {
  archiveRows: SourceCandidateRow[];
  approvedVideoCount: number;
  focusedCopyReady: boolean;
  pendingVideoCount: number;
  sourceCount: number;
  storyBeatCount: number;
  videoLeadRows: SourceCandidateRow[];
}) {
  const signals: string[] = [];
  if (storyBeatCount > 0) signals.push(`${storyBeatCount} story beat${storyBeatCount === 1 ? '' : 's'}`);
  if (focusedCopyReady) signals.push('Focused copy ready');
  if (archiveRows.length > 0) {
    const directCount = archiveRows.filter((row) => archiveConnectionFromRow(row) === 'direct').length;
    signals.push(`${archiveRows.length} archive lead${archiveRows.length === 1 ? '' : 's'}`);
    if (directCount > 0) signals.push(`${directCount} direct archive`);
  }
  if (sourceCount > 0) signals.push(`${sourceCount} source row${sourceCount === 1 ? '' : 's'}`);
  if (approvedVideoCount > 0) signals.push(`${approvedVideoCount} approved video${approvedVideoCount === 1 ? '' : 's'}`);
  if (pendingVideoCount + videoLeadRows.length > 0) signals.push(`${pendingVideoCount + videoLeadRows.length} media pending`);
  return signals.length > 0 ? signals : ['No surfaced content yet'];
}

function contentAccessScore({
  archiveRows,
  approvedVideoCount,
  focusedCopyReady,
  pendingVideoCount,
  sourceCount,
  storyBeatCount,
  videoLeadRows,
}: {
  archiveRows: SourceCandidateRow[];
  approvedVideoCount: number;
  focusedCopyReady: boolean;
  pendingVideoCount: number;
  sourceCount: number;
  storyBeatCount: number;
  videoLeadRows: SourceCandidateRow[];
}) {
  const directArchiveCount = archiveRows.filter((row) => archiveConnectionFromRow(row) === 'direct').length;
  const contextualArchiveCount = archiveRows.filter((row) => archiveConnectionFromRow(row) === 'contextual').length;
  return storyBeatCount * 30
    + (focusedCopyReady ? 24 : 0)
    + directArchiveCount * 18
    + (archiveRows.length - directArchiveCount - contextualArchiveCount) * 12
    + contextualArchiveCount * 8
    + Math.min(sourceCount, 20) * 2
    + approvedVideoCount * 12
    + Math.min(pendingVideoCount + videoLeadRows.length, 6) * 3;
}

function compareStoryAccessRows(a: ContentAccessRow, b: ContentAccessRow) {
  return b.storyBeatCount - a.storyBeatCount
    || Number(b.focusedCopyReady) - Number(a.focusedCopyReady)
    || b.score - a.score
    || a.inductee.name.localeCompare(b.inductee.name);
}

function compareArchiveAccessRows(a: ContentAccessRow, b: ContentAccessRow) {
  return b.archiveRows.filter((row) => archiveConnectionFromRow(row) === 'direct').length - a.archiveRows.filter((row) => archiveConnectionFromRow(row) === 'direct').length
    || b.archiveRows.length - a.archiveRows.length
    || b.score - a.score
    || a.inductee.name.localeCompare(b.inductee.name);
}

function isVideoVisitorReady(video: VideoAsset) {
  return Boolean(
    video.approvedForKiosk
    && video.runtimePath
    && video.rightsStatus === 'approved'
    && video.captionStatus === 'ready'
    && video.transcriptStatus === 'ready',
  );
}

function archiveConnectionFromRow(row: SourceCandidateRow) {
  const text = row.subtitle.toLowerCase();
  if (text.includes('contextual')) return 'contextual';
  if (text.includes('institutional')) return 'institutional';
  return 'direct';
}

function contentAccessDetail(row: ContentAccessRow, mode: SourceQueueMode) {
  if (mode === 'stories' && row.storyRecord) {
    const headlines = row.storyRecord.beats.slice(0, 3).map((beat) => beat.headline).filter(Boolean).join(' / ');
    return headlines || `${row.storyBeatCount} curated story beat${row.storyBeatCount === 1 ? '' : 's'} ready for profile review.`;
  }

  if (mode === 'archives') {
    const firstLead = row.archiveRows[0];
    return firstLead
      ? `${firstLead.subtitle}: ${firstLead.detail}`
      : 'Archive lead path is ready for staff review.';
  }

  if (mode === 'video') {
    return row.approvedVideoCount > 0
      ? `${row.approvedVideoCount} approved video${row.approvedVideoCount === 1 ? '' : 's'} plus ${row.pendingVideoCount + row.videoLeadRows.length} pending item${row.pendingVideoCount + row.videoLeadRows.length === 1 ? '' : 's'}.`
      : `${row.pendingVideoCount + row.videoLeadRows.length} video item${row.pendingVideoCount + row.videoLeadRows.length === 1 ? '' : 's'} need rights, captions, transcript, or local file review.`;
  }

  const strongestRow = row.sourceRows[0];
  return strongestRow
    ? `${sourceQueueLabels[strongestRow.mode]}: ${strongestRow.detail}`
    : 'Source evidence is available for staff review.';
}

function contentSectionStatusLabel(tone: 'ready' | 'review' | 'pending') {
  if (tone === 'ready') return 'Visitor-visible now';
  if (tone === 'pending') return 'Access pending';
  return 'Staff review path';
}

function buildSourceCandidateRows(packet: SourceCurationPacket): SourceCandidateRow[] {
  const rows: SourceCandidateRow[] = [];

  (packet.curationIndex ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `profiles-${personId || index}`,
      mode: 'profiles',
      label: cleanPortalString(record.inducteeName) || personId || 'Profile source lead',
      subtitle: sourceYearRegion(record.classYear, record.region),
      detail: cleanPortalString(record.nextBestAction) || 'Review harvested original-site profile evidence.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.primarySourceProfileUrl),
      confidence: priorityConfidence(record.reviewPriority),
      action: cleanPortalString(record.nextBestAction),
      fields: compactSourceFields(
        ['Primary source', record.primarySourceProfileUrl],
        ['Profile sources', record.sourceProfileCount],
        ['New image leads', record.newImageReviewCount],
        ['New profile video leads', record.newProfileVideoReviewCount],
        ['Context video leads', record.newContextVideoReviewCount],
        ['Relationship leads', record.relationshipReviewCount],
        ['Place leads', record.placeReviewCount],
        ['Organization leads', record.organizationReviewCount],
        ['Primary story leads', record.primaryStoryLeadCount],
        ['Manual flags', record.manualFlags?.join('; ')],
      ),
      stageKind: 'profile-note',
      note: sourceNote('Source profile review', [
        record.nextBestAction,
        record.primarySourceProfileUrl,
        record.manualFlags?.join('; '),
      ]),
    });
  });

  (packet.sourceProfileReferences ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `profile-source-${personId || 'unknown'}-${index}`,
      mode: 'profiles',
      label: cleanPortalString(record.sourceTitle) || cleanPortalString(record.inducteeName) || 'Source profile',
      subtitle: `${cleanPortalString(record.matchType) || 'source profile'} / ${sourceYearRegion(record.classYear)}`,
      detail: 'Resolved original-site source profile reference.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.canonicalUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Source title', record.sourceTitle],
        ['Source URL', record.sourceUrl],
        ['Canonical URL', record.canonicalUrl],
        ['Modified', record.sourceModified],
        ['Region candidates', record.sourceRegionCandidates?.join('; ')],
        ['Class candidates', record.sourceClassYearCandidates?.join('; ')],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'profile-note',
      note: sourceNote('Resolved original-site profile source', [
        record.sourceTitle,
        record.sourceUrl,
        record.reviewAction,
      ]),
    });
  });

  (packet.mediaReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `media-${personId || 'unknown'}-${index}`,
      mode: 'media',
      label: cleanPortalString(record.inducteeName) || personId || 'Image lead',
      subtitle: `${cleanPortalString(record.roleCandidate) || 'image'} / ${record.alreadyInMediaManifest ? 'in manifest' : 'new source'}`,
      detail: cleanPortalString(record.sourcePageTitle) || cleanPortalString(record.sourceUrl) || 'Review image lead for rights and portrait suitability.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      imageAltText: cleanPortalString(record.altText),
      fields: compactSourceFields(
        ['Media type', record.mediaType],
        ['Role candidate', record.roleCandidate],
        ['Dimensions', record.width && record.height ? `${record.width} x ${record.height}` : ''],
        ['Alt text', record.altText],
        ['Caption', record.caption],
        ['Rights status', record.rightsStatus],
        ['Already in manifest', record.alreadyInMediaManifest ? 'Yes' : 'No'],
        ['Source page', record.sourcePageUrl],
        ['Review action', record.reviewAction],
      ),
      stageKind: cleanPortalString(record.sourceUrl) ? 'media-image' : 'profile-note',
      note: sourceNote('Image source lead', [
        record.roleCandidate,
        record.sourceUrl,
        record.sourcePageUrl,
        record.rightsStatus,
        'Rights and suitability still require staff review.',
      ]),
    });
  });

  (packet.videoReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `video-${personId || 'unknown'}-${index}`,
      mode: 'video',
      label: cleanPortalString(record.inducteeName) || personId || 'Video lead',
      subtitle: `${cleanPortalString(record.assignment) || 'video'} / ${record.alreadyInMediaManifest ? 'in manifest' : 'new source'}`,
      detail: cleanPortalString(record.sourcePageTitle) || cleanPortalString(record.sourceUrl) || 'Review video lead for context, rights, captions, and transcript.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      youtubeVideoId: cleanPortalString(record.youtubeVideoId),
      fields: compactSourceFields(
        ['YouTube ID', record.youtubeVideoId],
        ['Assignment', record.assignment],
        ['Rights status', record.rightsStatus],
        ['Already in manifest', record.alreadyInMediaManifest ? 'Yes' : 'No'],
        ['Source page', record.sourcePageUrl],
        ['Review action', record.reviewAction],
      ),
      stageKind: cleanPortalString(record.sourceUrl) || cleanPortalString(record.youtubeVideoId) ? 'video-source' : 'profile-note',
      note: sourceNote('Video source lead', [
        record.assignment,
        record.sourceUrl,
        record.sourcePageUrl,
        record.rightsStatus,
        'Rights, captions, transcript, and context still require staff review.',
      ]),
    });
  });

  (packet.relationshipReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.sourcePersonId);
    rows.push({
      id: `relationship-${personId || 'unknown'}-${index}`,
      mode: 'relationships',
      label: `${cleanPortalString(record.sourcePersonName) || personId || 'Source person'} -> ${cleanPortalString(record.targetDisplayName) || cleanPortalString(record.targetEntityId) || 'target'}`,
      subtitle: `${cleanPortalString(record.provenanceCandidate) || 'candidate'} / ${cleanPortalString(record.type) || 'relationship'}`,
      detail: cleanPortalString(record.referenceNote) || 'Review relationship evidence before public display.',
      personId,
      personName: cleanPortalString(record.sourcePersonName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Target type', record.targetEntityType],
        ['Target ID', record.targetEntityId],
        ['Display label', record.displayLabel],
        ['Evidence count', record.evidenceCount],
        ['Evidence types', record.evidenceTypes?.join('; ')],
        ['Public use', record.publicUse],
        ['Source pages', record.sourcePageUrls?.join('; ')],
      ),
      stageKind: 'relationship-note',
      note: sourceNote('Relationship source lead', [
        `${record.sourcePersonName ?? personId} -> ${record.targetDisplayName ?? record.targetEntityId}`,
        record.type,
        record.referenceNote,
        record.sourcePageUrls?.join('; '),
        'Approve in the Relationships tab before public use.',
      ]),
    });
  });

  (packet.placeReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `place-${personId || 'unknown'}-${index}`,
      mode: 'places',
      label: `${cleanPortalString(record.inducteeName) || personId || 'Profile'} / ${cleanPortalString(record.placeLabel) || 'Place lead'}`,
      subtitle: `${cleanPortalString(record.safeguardStatus) || 'geography review'} / ${cleanPortalString(record.migrationDirection) || 'not-inferred'}`,
      detail: 'Review place evidence. Do not infer migration direction from this lead.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      countryCandidates: cleanPortalList(record.inferredCountryTags),
      fields: compactSourceFields(
        ['Place', record.placeLabel],
        ['Scope hint', record.placeScopeHint],
        ['Evidence count', record.evidenceCount],
        ['Evidence types', record.evidenceTypes?.join('; ')],
        ['Existing nationality tags', record.existingCountryTags?.join('; ')],
        ['Nationality candidates', record.inferredCountryTags?.join('; ')],
        ['Safeguard', record.safeguardStatus],
        ['Migration direction', record.migrationDirection],
        ['Source pages', record.sourcePageUrls?.join('; ')],
      ),
      stageKind: 'place-note',
      note: sourceNote('Place source lead', [
        record.placeLabel,
        record.safeguardStatus,
        record.migrationDirection,
        record.sourcePageUrls?.join('; '),
        'Geography candidate only; do not infer migration direction.',
      ]),
    });
  });

  (packet.placePhraseReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `place-phrase-${personId || 'unknown'}-${index}`,
      mode: 'places',
      label: `${cleanPortalString(record.inducteeName) || personId || 'Profile'} / ${cleanPortalString(record.phraseLabel) || 'Place phrase'}`,
      subtitle: `${cleanPortalString(record.phraseQuality) || 'phrase'} / ${cleanPortalString(record.safeguardStatus) || 'geography review'}`,
      detail: 'Exploratory place phrase. Staff should verify whether this is a usable place signal.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      countryCandidates: cleanPortalList(record.inferredCountryTags),
      fields: compactSourceFields(
        ['Phrase', record.phraseLabel],
        ['Quality', record.phraseQuality],
        ['Evidence count', record.evidenceCount],
        ['Existing nationality tags', record.existingCountryTags?.join('; ')],
        ['Nationality candidates', record.inferredCountryTags?.join('; ')],
        ['Safeguard', record.safeguardStatus],
        ['Migration direction', record.migrationDirection],
        ['Source pages', record.sourcePageUrls?.join('; ')],
      ),
      stageKind: 'place-note',
      note: sourceNote('Exploratory place phrase lead', [
        record.phraseLabel,
        record.phraseQuality,
        record.safeguardStatus,
        record.sourcePageUrls?.join('; '),
        'Geography candidate only; do not infer migration direction.',
      ]),
    });
  });

  (packet.organizationReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `organization-${personId || 'unknown'}-${index}`,
      mode: 'organizations',
      label: cleanPortalString(record.organizationName) || 'Organization lead',
      subtitle: `${cleanPortalString(record.inducteeName) || personId || 'Profile'} / ${sourceYearRegion(record.classYear)}`,
      detail: 'Review organization as documented context, story signal, or relationship evidence.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Organization', record.organizationName],
        ['Evidence count', record.evidenceCount],
        ['Public use', record.publicUse],
        ['Source pages', record.sourcePageUrls?.join('; ')],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'organization-note',
      note: sourceNote('Organization source lead', [
        record.organizationName,
        record.sourcePageUrls?.join('; '),
        'Review as context before public use.',
      ]),
    });
  });

  (packet.storySectionReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    const archiveLead = isArchiveSourceLead(record);
    const connectionStrength = archiveSourceConnection(record);
    rows.push({
      id: `story-${personId || 'unknown'}-${index}`,
      mode: archiveLead ? 'archives' : 'stories',
      label: cleanPortalString(record.inducteeName) || personId || (archiveLead ? 'Archive lead' : 'Story lead'),
      subtitle: archiveLead
        ? `${archiveSourceRepository(record)} / ${connectionStrength} / ${cleanPortalString(record.priority) || 'lead'}`
        : `${cleanPortalString(record.suggestedTheme) || 'story'} / ${cleanPortalString(record.priority) || 'lead'}`,
      detail: cleanPortalString(record.excerpt) || 'Review source excerpt as a rewrite lead.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourcePageUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: archiveLead ? archiveSourceConfidence(record) : record.priority === 'primary-story-lead' ? 0.9 : 0.58,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Source title', record.sourcePageTitle],
        ['Repository', archiveLead ? archiveSourceRepository(record) : ''],
        ['Connection', archiveLead ? connectionStrength : ''],
        ['Status', archiveLead ? 'catalog lead / staff review' : ''],
        ['Suggested theme', record.suggestedTheme],
        ['Block index', record.blockIndex],
        ['Word count', record.wordCount],
        ['Candidate use', record.candidateUse],
        ['Copyright note', record.copyrightNote],
        ['Review action', record.reviewAction],
      ),
      stageKind: archiveLead ? 'archive-note' : 'story-note',
      note: sourceNote(archiveLead ? 'Archive source lead' : 'Story rewrite lead', [
        record.suggestedTheme,
        record.excerpt,
        record.sourcePageUrl,
        record.candidateUse,
        record.copyrightNote,
        archiveLead ? 'Visitor display requires inspection, attribution, loan, and reproduction clearance.' : '',
      ]),
    });
  });

  (packet.profileUrlAliasDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `alias-${personId || 'unknown'}-${index}`,
      mode: 'aliases',
      label: cleanPortalString(record.inducteeName) || personId || 'Profile alias',
      subtitle: `${cleanPortalString(record.matchType) || 'alias'} / ${cleanPortalString(record.publishStatus) || 'review'}`,
      detail: 'Review alternate original-site URL before changing canonical profile links.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.alternateSourceUrl),
      sourcePageUrl: cleanPortalString(record.currentProfileUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Current URL', record.currentProfileUrl],
        ['Alternate URL', record.alternateSourceUrl],
        ['Source title', record.sourceTitle],
        ['Publish status', record.publishStatus],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'alias-note',
      note: sourceNote('Profile URL alias lead', [
        record.alternateSourceUrl,
        record.currentProfileUrl,
        record.publishStatus,
      ]),
    });
  });

  (packet.duplicateSourceGroups ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `duplicate-source-${personId || 'unknown'}-${index}`,
      mode: 'aliases',
      label: cleanPortalString(record.inducteeName) || personId || 'Duplicate source group',
      subtitle: `${record.sources?.length ?? 0} source records`,
      detail: 'Review duplicate original-site source records before using as canonical references.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sources?.[0]?.sourceUrl,
      sourcePageUrl: record.sources?.[0]?.sourceUrl,
      confidence: record.sources?.reduce((max, source) => Math.max(max, source.confidence ?? 0), 0),
      fields: compactSourceFields(
        ['Sources', record.sources?.map((source) => source.sourceUrl).join('; ')],
        ['Match types', record.sources?.map((source) => source.matchType).filter(Boolean).join('; ')],
      ),
      stageKind: 'alias-note',
      note: sourceNote('Duplicate source group lead', [
        record.sources?.map((source) => `${source.sourceTitle ?? 'Untitled'}: ${source.sourceUrl}`).join('; '),
      ]),
    });
  });

  (packet.classEvidenceReviewDrafts ?? []).forEach((record, index) => {
    rows.push({
      id: `class-evidence-${index}`,
      mode: 'classes',
      label: cleanPortalString(record.title) || 'Class evidence lead',
      subtitle: `${cleanPortalString(record.sourceKind) || 'class source'} / ${record.primaryClassYearCandidates?.join('; ') || 'year review'}`,
      detail: 'Review class page evidence before applying to individual profiles.',
      sourceUrl: cleanPortalString(record.sourcePageUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Primary class years', record.primaryClassYearCandidates?.join('; ')],
        ['All class years', record.allClassYearCandidates?.join('; ')],
        ['Images', record.imageCount],
        ['Attached media', record.attachedMediaCount],
        ['YouTube IDs', record.youtubeVideoIds?.join('; ')],
        ['Mentioned inductees', record.mentionedInducteeCount],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'class-note',
      note: sourceNote('Class evidence lead', [
        record.title,
        record.sourcePageUrl,
        record.primaryClassYearCandidates?.join('; '),
      ]),
    });
  });

  (packet.unresolvedSourceRecords ?? []).forEach((record, index) => {
    rows.push({
      id: `unresolved-${record.wpId ?? index}`,
      mode: 'unresolved',
      label: cleanPortalString(record.sourceTitle) || cleanPortalString(record.sourceTitleName) || 'Unresolved source',
      subtitle: `${cleanPortalString(record.sourceKind) || 'source'} / no deterministic match`,
      detail: 'Resolve manually to an existing profile or a future new record.',
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.sourceUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Source title', record.sourceTitle],
        ['Source title name', record.sourceTitleName],
        ['Region candidates', record.sourceRegionCandidates?.join('; ')],
        ['Class candidates', record.sourceClassYearCandidates?.join('; ')],
        ['Notes', record.notes?.join('; ')],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'unresolved-note',
      note: sourceNote('Unresolved original-site source', [
        record.sourceTitle,
        record.sourceUrl,
        record.notes?.join('; '),
      ]),
    });
  });

  return rows;
}

function buildSourceQueueOptions(rows: SourceCandidateRow[]) {
  return (Object.entries(sourceQueueLabels) as Array<[SourceQueueMode, string]>).map(([mode, label]) => ({
    mode,
    label,
    count: rows.filter((row) => row.mode === mode).length,
  }));
}

function sourceDraftPatchForRow(row: SourceCandidateRow, stageKind: SourceCandidateRow['stageKind'], target: Inductee, draft: ReviewDraft | undefined, mediaRecord: MediaManifestRecord | undefined): DraftPatch {
  if (stageKind === 'media-image' && row.sourceUrl) {
    const patch: DraftPatch = {
      imageSourceUrl: row.sourceUrl,
      imageRightsStatus: 'needs-review',
      mediaNotes: addListValue(draft?.mediaNotes ?? mediaRecord?.notes ?? [], row.note),
    };
    if (row.imageAltText) patch.primaryImageAltText = row.imageAltText;
    return patch;
  }

  if (stageKind === 'video-source') {
    const patch: DraftPatch = {
      videoRightsStatus: 'needs-review',
      captionStatus: 'review-needed',
      transcriptStatus: 'review-needed',
      mediaNotes: addListValue(draft?.mediaNotes ?? mediaRecord?.notes ?? [], row.note),
    };
    if (row.sourceUrl) patch.videoSourceUrls = addListValue(draft?.videoSourceUrls ?? [], row.sourceUrl);
    if (row.youtubeVideoId) patch.youtubeVideoIds = addListValue(draft?.youtubeVideoIds ?? [], row.youtubeVideoId);
    return patch;
  }

  if (stageKind === 'place-note') {
    const countryCandidates = row.countryCandidates ?? [];
    const patch: DraftPatch = {
      countryNotes: appendSourceText(draft?.countryNotes ?? target.countryTagsNote, row.note),
      curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
    };
    if (countryCandidates.length > 0) patch.approvedCountryTags = addListValues(draft?.approvedCountryTags ?? target.countryTags, countryCandidates);
    return patch;
  }

  if ((stageKind === 'profile-note' || stageKind === 'class-note') && !draft?.documentedContextLine && !target.documentedContextLine) {
    return {
      documentedContextLine: sourceContextLine(row),
      curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
    };
  }

  if (stageKind === 'story-note' && !draft?.lifeWorkSummary && !target.lifeWorkSummary) {
    return {
      lifeWorkSummary: row.detail || row.note,
      curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
    };
  }

  return {
    curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
  };
}

function sourceReviewNotePatchForRow(row: SourceCandidateRow, target: Inductee, draft: ReviewDraft | undefined): DraftPatch {
  const patch: DraftPatch = {
    curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
  };
  if (row.mode === 'places') {
    patch.countryNotes = appendSourceText(draft?.countryNotes ?? target.countryTagsNote, row.note);
  }
  return patch;
}

function getProfileSourceRows(rows: SourceCandidateRow[], personId: string) {
  return rows
    .filter((row) => row.personId === personId)
    .sort(compareProfileSourceRows);
}

function groupProfileSourceRows(rows: SourceCandidateRow[]) {
  return sourceEvidenceModeOrder
    .map((mode) => ({
      mode,
      rows: rows.filter((row) => row.mode === mode).sort(compareProfileSourceRows),
    }))
    .filter((group) => group.rows.length > 0);
}

function compareProfileSourceRows(a: SourceCandidateRow, b: SourceCandidateRow) {
  return sourceEvidenceModeOrder.indexOf(a.mode) - sourceEvidenceModeOrder.indexOf(b.mode)
    || (b.confidence ?? 0) - (a.confidence ?? 0)
    || a.label.localeCompare(b.label);
}

function buildSourceBulkRows(rows: SourceCandidateRow[], peopleById: Map<string, Inductee>, drafts: DraftMap, mode: 'context' | 'story' | 'traces') {
  const candidates = rows.filter((row) => {
    if (!row.personId) return false;
    const target = peopleById.get(row.personId);
    if (!target) return false;
    const draft = drafts[target.id];

    if (mode === 'context') {
      return (row.stageKind === 'profile-note' || row.stageKind === 'class-note')
        && !draft?.documentedContextLine
        && !target.documentedContextLine;
    }

    if (mode === 'story') {
      return row.stageKind === 'story-note'
        && !draft?.lifeWorkSummary
        && !target.lifeWorkSummary;
    }

    return (row.mode === 'relationships' || row.mode === 'places' || row.mode === 'organizations')
      && !sourceReviewNoteAlreadyStaged(row, target, draft);
  });

  return mode === 'traces' ? candidates : firstSourceRowPerProfile(candidates);
}

function firstSourceRowPerProfile(rows: SourceCandidateRow[]) {
  const seen = new Set<string>();
  return [...rows].sort(compareProfileSourceRows).filter((row) => {
    if (!row.personId || seen.has(row.personId)) return false;
    seen.add(row.personId);
    return true;
  });
}

function buildBulkSourceDrafts(currentDrafts: DraftMap, rows: SourceCandidateRow[], inductees: Inductee[], manifest: MediaManifest | null, stageMode: BulkSourceStageMode) {
  const peopleById = new Map(inductees.map((inductee) => [inductee.id, inductee]));
  const nextDrafts: DraftMap = { ...currentDrafts };
  const changedProfileIds = new Set<string>();
  const updatedAt = new Date().toISOString();
  let changed = 0;

  rows.forEach((row) => {
    if (!row.personId) return;
    const target = peopleById.get(row.personId);
    if (!target) return;
    const existingDraft = nextDrafts[target.id];
    const patch = stageMode === 'review-note'
      ? sourceReviewNotePatchForRow(row, target, existingDraft)
      : sourceDraftPatchForRow(row, row.stageKind, target, existingDraft, manifest?.assets?.[target.id]);
    if (!draftPatchHasChange(existingDraft, patch)) return;

    const nextDraft: ReviewDraft = {
      ...(existingDraft ?? { id: target.id }),
      ...patch,
      id: target.id,
      updatedAt,
    };
    if (isMeaningfulDraft(nextDraft)) {
      nextDrafts[target.id] = nextDraft;
      changed += 1;
      changedProfileIds.add(target.id);
    } else if (existingDraft) {
      delete nextDrafts[target.id];
      changed += 1;
      changedProfileIds.add(target.id);
    }
  });

  return {
    drafts: nextDrafts,
    changed,
    profileCount: changedProfileIds.size,
  };
}

function sourceReviewNoteAlreadyStaged(row: SourceCandidateRow, target: Inductee, draft: ReviewDraft | undefined) {
  return (draft?.curatorNotes ?? []).includes(row.note)
    || (row.mode === 'places' && cleanPortalString(draft?.countryNotes ?? target.countryTagsNote).includes(row.note));
}

function draftPatchHasChange(existingDraft: ReviewDraft | undefined, patch: DraftPatch) {
  const existingRecord = (existingDraft ?? {}) as Record<string, unknown>;
  return Object.entries(patch).some(([key, value]) => JSON.stringify(existingRecord[key] ?? null) !== JSON.stringify(value ?? null));
}

function sourceContextLine(row: SourceCandidateRow) {
  return [row.subtitle, row.detail, row.label]
    .map(cleanPortalString)
    .filter(Boolean)
    .join(' / ')
    .slice(0, 120);
}

function buildFocusedCopySuggestion(inductee: Inductee, sourceRows: SourceCandidateRow[]): FocusedCopySuggestion | null {
  const documentedContextLine = buildFocusedContextLineStarter(inductee, sourceRows);
  const honoredForSummary = limitPortalWords(cleanProfileCopyText(buildDefaultHonoredForSummary(inductee), inductee.name), 52);
  const lifeWorkSummary = limitPortalWords(cleanProfileCopyText(inductee.lifeWorkSummary || inductee.bioText || inductee.storySummary, inductee.name), 110);
  const sourceLabels = sourceRows
    .filter((row) => row.mode === 'profiles' || row.mode === 'stories' || row.mode === 'archives' || row.mode === 'relationships' || row.mode === 'places' || row.mode === 'organizations')
    .sort(compareProfileSourceRows)
    .slice(0, 5)
    .map((row) => `${sourceQueueLabels[row.mode]}: ${row.label}`);

  if (!documentedContextLine && !honoredForSummary && !lifeWorkSummary) return null;

  const sourceUrls = Array.from(new Set(sourceRows.flatMap((row) => [row.sourceUrl, row.sourcePageUrl]).map(cleanPortalString).filter(Boolean))).slice(0, 4);

  return {
    documentedContextLine,
    honoredForSummary,
    lifeWorkSummary,
    sourceCount: sourceRows.length,
    sourceLabels,
    sourceNote: sourceNote('Focused Hall copy starter', [
      `${sourceRows.length} linked original-site lead${sourceRows.length === 1 ? '' : 's'}`,
      sourceUrls.join('; '),
      'Browser-local draft only; verify and rewrite before approval.',
    ]),
  };
}

function buildFocusedContextLineStarter(inductee: Inductee, sourceRows: SourceCandidateRow[]) {
  const profileSourceLinked = sourceRows.some((row) => row.mode === 'profiles' && (row.sourceUrl || row.sourcePageUrl));
  const context = inducteeContextLabel(inductee);
  return limitPortalCharacters(
    [
      inductee.classYear ? `Class of ${inductee.classYear}` : '',
      context,
      profileSourceLinked ? 'original CIHOF profile source linked' : '',
    ].filter(Boolean).join(' / '),
    120,
  );
}

function buildFocusedCopyPatch(suggestion: FocusedCopySuggestion | null, inductee: Inductee, draft: ReviewDraft | undefined, replaceExisting: boolean): DraftPatch {
  if (!suggestion) return {};
  const patch: DraftPatch = {};
  stageFocusedCopyField(patch, 'documentedContextLine', suggestion.documentedContextLine, inductee, draft, replaceExisting);
  stageFocusedCopyField(patch, 'honoredForSummary', suggestion.honoredForSummary, inductee, draft, replaceExisting);
  stageFocusedCopyField(patch, 'lifeWorkSummary', suggestion.lifeWorkSummary, inductee, draft, replaceExisting);
  if (patchHasEditableField(patch)) {
    patch.curatorNotes = addListValue(draft?.curatorNotes ?? [], suggestion.sourceNote);
  }
  return patch;
}

function stageFocusedCopyField(
  patch: DraftPatch,
  field: 'documentedContextLine' | 'honoredForSummary' | 'lifeWorkSummary',
  nextValue: string,
  inductee: Inductee,
  draft: ReviewDraft | undefined,
  replaceExisting: boolean,
) {
  const cleanedValue = cleanPortalString(nextValue);
  if (!cleanedValue) return;
  const currentValue = cleanPortalString(draft?.[field] ?? inductee[field]);
  if (currentValue === cleanedValue) return;
  if (!replaceExisting && currentValue) return;
  patch[field] = cleanedValue;
}

function patchHasEditableField(patch: DraftPatch) {
  return Boolean(patch.documentedContextLine || patch.honoredForSummary || patch.lifeWorkSummary);
}

function cleanProfileCopyText(text: string, name: string) {
  const withoutMediaTail = text.split(/Watch the video|Here is a video|See more photos|Congratulations|Back to /i)[0] || text;
  return stripLeadingProfileName(withoutMediaTail.replace(/\s+/g, ' ').trim(), name);
}

function stripLeadingProfileName(text: string, name: string) {
  const variants = [
    name,
    name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);
  let nextText = text;
  for (let index = 0; index < 2; index += 1) {
    const match = variants.find((variant) => nextText.toLowerCase().startsWith(variant.toLowerCase()));
    if (!match) break;
    nextText = nextText.slice(match.length).replace(/^[-:,\s]+/, '').trim();
  }
  return nextText;
}

function limitPortalCharacters(text: string, maxLength: number) {
  const normalized = cleanPortalString(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).replace(/\s+\S*$/, '')}...`;
}

function limitPortalWords(text: string, maxWords: number) {
  const words = cleanPortalString(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ').replace(/[,;:]+$/, '')}...`;
}

function matchesSourceCandidate(row: SourceCandidateRow, search: string) {
  return [
    row.label,
    row.subtitle,
    row.detail,
    row.personId,
    row.personName,
    row.sourceUrl,
    row.sourcePageUrl,
    row.action,
    row.note,
    ...row.fields.flatMap((field) => [field.label, field.value]),
  ].join(' ').toLowerCase().includes(search);
}

function sourcePrimaryActionLabel(row: SourceCandidateRow) {
  switch (row.stageKind) {
    case 'media-image':
      return 'Stage Image Source';
    case 'video-source':
      return 'Stage Video Source';
    case 'place-note':
      return 'Stage Place Candidate';
    case 'relationship-note':
      return 'Stage Relationship Note';
    case 'organization-note':
      return 'Stage Organization Note';
    case 'story-note':
      return 'Stage Story Lead';
    case 'archive-note':
      return 'Stage Archive Note';
    case 'alias-note':
      return 'Stage Alias Note';
    case 'class-note':
      return 'Stage Class Note';
    case 'unresolved-note':
      return 'Stage Manual Note';
    default:
      return 'Stage Profile Note';
  }
}

function sourceStageLabel(stageKind: SourceCandidateRow['stageKind']) {
  switch (stageKind) {
    case 'media-image':
      return 'image source';
    case 'video-source':
      return 'video source';
    case 'place-note':
      return 'place candidate';
    case 'relationship-note':
      return 'relationship note';
    case 'organization-note':
      return 'organization note';
    case 'story-note':
      return 'story lead';
    case 'archive-note':
      return 'archive review note';
    case 'alias-note':
      return 'alias note';
    case 'class-note':
      return 'class evidence';
    case 'unresolved-note':
      return 'manual source note';
    default:
      return 'profile note';
  }
}

function compactSourceFields(...fields: Array<[string, unknown]>): Array<{ label: string; value: string }> {
  return fields
    .map(([label, value]) => ({ label, value: sourceValueLabel(value) }))
    .filter((field) => field.value.length > 0);
}

function sourceValueLabel(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(sourceValueLabel).filter(Boolean).join('; ');
  return cleanPortalString(value);
}

function sourceYearRegion(classYear?: number, region?: string) {
  return [classYear ? `Class of ${classYear}` : '', cleanPortalString(region)].filter(Boolean).join(' / ') || 'Year review';
}

function isArchiveSourceLead(record: SourceStorySectionReviewDraft) {
  return [
    record.sourcePageTitle,
    record.suggestedTheme,
    record.candidateUse,
    record.reviewAction,
    record.copyrightNote,
  ].map(cleanPortalString).join(' ').toLowerCase().match(/\b(wrhs|western reserve historical society|archive|archival|finding-aid|catalog)\b/) !== null;
}

function archiveSourceRepository(record: SourceStorySectionReviewDraft) {
  const text = `${record.sourcePageTitle ?? ''} ${record.sourcePageUrl ?? ''}`;
  return /\bWRHS\b|wrhs\.org|Western Reserve Historical Society/i.test(text)
    ? 'WRHS'
    : 'Archive';
}

function archiveSourceConnection(record: SourceStorySectionReviewDraft) {
  const text = [
    record.suggestedTheme,
    record.candidateUse,
    record.excerpt,
  ].map(cleanPortalString).join(' ').toLowerCase();
  if (/contextual|context only|not (?:his|her|their) personal|does not establish|not verified/.test(text)) return 'contextual';
  if (/\bdirect\b/.test(text)) return 'direct';
  if (/institutional|firm|organization|venue|community memory|center|library/.test(text)) return 'institutional';
  return 'direct';
}

function archiveSourceConfidence(record: SourceStorySectionReviewDraft) {
  if (record.priority === 'primary-story-lead') return 0.86;
  return archiveSourceConnection(record) === 'contextual' ? 0.54 : 0.68;
}

function sourceNote(label: string, values: Array<unknown>) {
  const detail = values.map(sourceValueLabel).filter(Boolean).join(' / ');
  return detail ? `${label}: ${detail}` : label;
}

function priorityConfidence(priority?: string) {
  if (priority === 'high') return 0.9;
  if (priority === 'medium') return 0.64;
  if (priority === 'standard') return 0.44;
  return undefined;
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function sourceGuardrailLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()) + ': ';
}

function addListValues(values: string[], nextValues: string[]) {
  return nextValues.reduce((current, value) => addListValue(current, value), values);
}

function appendSourceText(existingValue: string | undefined, nextValue: string) {
  const existing = cleanPortalString(existingValue);
  if (!existing) return nextValue;
  if (existing.includes(nextValue)) return existing;
  return `${existing}\n${nextValue}`;
}

function addListValue(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function cleanPortalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPortalList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanPortalString(item)).filter(Boolean)));
}

export {
  buildBulkSourceDrafts,
  buildContentAccessRows,
  buildContentAccessSummary,
  buildFocusedCopyPatch,
  buildFocusedCopySuggestion,
  buildSourceBulkRows,
  buildSourceCandidateRows,
  buildSourceQueueOptions,
  compareArchiveAccessRows,
  compareStoryAccessRows,
  contentAccessDetail,
  contentSectionStatusLabel,
  formatConfidence,
  getProfileSourceRows,
  groupProfileSourceRows,
  matchesSourceCandidate,
  patchHasEditableField,
  sourceDraftPatchForRow,
  sourceGuardrailLabel,
  sourceNote,
  sourcePrimaryActionLabel,
  sourceReviewNotePatchForRow,
  sourceStageLabel,
};
