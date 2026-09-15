import { useEffect, useState } from 'react';
import { normalizeInducteePayload } from '../../data/normalizeInductees';
import { loadRuntimeDataBundle } from '../../data/runtimeDataBundle';
import type { Inductee } from '../../data/types';

type AdminReviewPriority = 'high' | 'medium' | 'standard';
type AdminReviewCategory = 'heritage' | 'community' | 'media' | 'story' | 'profile';

type AdminReviewIssue = {
  category: AdminReviewCategory;
  label: string;
  detail: string;
};

type AdminReviewItem = {
  id: string;
  name: string;
  classYear: number | null;
  priority: AdminReviewPriority;
  detail: string;
  issues: AdminReviewIssue[];
  status: {
    approvalStatus: string;
    reviewPriority: string;
    countryTagsSource: string;
    themeTagsSource: string;
    imageRightsStatus: string;
    videoRightsStatus: string;
    mediaReviewStatus: string;
  };
};

type AdminReviewMetric = {
  label: string;
  value: number;
  detail: string;
};

type AdminReviewSnapshot = {
  capturedAt: string;
  dataSource: 'imported-browser-bundle' | 'built-in-bundle';
  generatedAt: string;
  totalProfiles: number;
  queuedProfiles: number;
  metrics: AdminReviewMetric[];
  items: AdminReviewItem[];
};

export function AdminReviewQueue({ overrideActive }: { overrideActive: boolean }) {
  const [snapshot, setSnapshot] = useState<AdminReviewSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const nextSnapshot = await buildAdminReviewSnapshot(overrideActive);
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError('');
        }
      } catch (reviewError) {
        if (!cancelled) {
          setError(reviewError instanceof Error ? reviewError.message : 'Could not build review queue.');
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [overrideActive]);

  return (
    <div className="admin-review">
      <p>
        Read-only curation QA for taxonomy confidence, media clearance, visitor-facing copy, and profile approval.
      </p>

      {error && <span className="admin-data-panel__status">{error}</span>}

      {snapshot ? (
        <>
          <div className="admin-review__metrics" aria-label="Review queue metrics">
            {snapshot.metrics.map((metric) => (
              <section key={metric.label} className="admin-review__metric" aria-label={`${metric.label} review count`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </section>
            ))}
          </div>

          <div className="admin-data-panel__actions">
            <button type="button" onClick={() => void refreshAdminReviewQueue(setSnapshot, setError, overrideActive)}>
              Refresh Queue
            </button>
            <button type="button" onClick={() => downloadJson(snapshot, reviewQueueFilename())}>
              Export Review Queue
            </button>
          </div>

          <section className="admin-review__queue" aria-label="Curatorial review queue">
            <header className="admin-review__queueHeader">
              <div>
                <h3>Curatorial Review Queue</h3>
                <small>{snapshot.queuedProfiles} of {snapshot.totalProfiles} profiles need review</small>
              </div>
              <span>{snapshot.dataSource === 'imported-browser-bundle' ? 'Imported data' : 'Built-in data'}</span>
            </header>

            {snapshot.items.length > 0 ? (
              <ol className="admin-review__list">
                {snapshot.items.slice(0, 30).map((item) => (
                  <li key={item.id} className="admin-review__item">
                    <article aria-label={`${item.name} review issues`}>
                      <header>
                        <div>
                          <h4>{item.name}</h4>
                          <small>{item.classYear ? `Class of ${item.classYear}` : 'Class year unknown'} / {item.detail}</small>
                        </div>
                        <span className={`admin-review__priority admin-review__priority--${item.priority}`}>{item.priority}</span>
                      </header>
                      <div className="admin-review__tags" aria-label="Issue categories">
                        {item.issues.map((issue) => (
                          <span key={`${item.id}-${issue.label}`} className={`admin-review__tag admin-review__tag--${issue.category}`}>
                            {issue.label}
                          </span>
                        ))}
                      </div>
                      <ul>
                        {item.issues.slice(0, 5).map((issue) => (
                          <li key={`${item.id}-${issue.category}-${issue.label}`}>{issue.detail}</li>
                        ))}
                      </ul>
                    </article>
                  </li>
                ))}
              </ol>
            ) : (
              <span className="admin-review__empty">No records are currently flagged.</span>
            )}
          </section>
        </>
      ) : (
        <span className="admin-data-panel__mode">Building review queue...</span>
      )}
    </div>
  );
}

async function refreshAdminReviewQueue(
  setSnapshot: (snapshot: AdminReviewSnapshot) => void,
  setError: (error: string) => void,
  overrideActive: boolean,
) {
  try {
    setSnapshot(await buildAdminReviewSnapshot(overrideActive));
    setError('');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Could not build review queue.');
  }
}

async function buildAdminReviewSnapshot(overrideActive: boolean): Promise<AdminReviewSnapshot> {
  const bundle = await loadRuntimeDataBundle();
  const inductees = normalizeInducteePayload(bundle.inductees);
  const items = inductees
    .map(buildAdminReviewItem)
    .filter((item): item is AdminReviewItem => Boolean(item))
    .sort((a, b) => {
      const priority = adminReviewPriorityRank(a.priority) - adminReviewPriorityRank(b.priority);
      if (priority !== 0) return priority;
      if ((b.classYear ?? 0) !== (a.classYear ?? 0)) return (b.classYear ?? 0) - (a.classYear ?? 0);
      return a.name.localeCompare(b.name);
    });

  return {
    capturedAt: new Date().toISOString(),
    dataSource: overrideActive ? 'imported-browser-bundle' : 'built-in-bundle',
    generatedAt: typeof bundle.generatedAt === 'string' ? bundle.generatedAt : '',
    totalProfiles: inductees.length,
    queuedProfiles: items.length,
    metrics: buildAdminReviewMetrics(inductees.length, items),
    items,
  };
}


function buildAdminReviewItem(person: Inductee): AdminReviewItem | null {
  const issues: AdminReviewIssue[] = [];
  const nationalityTags = readyReviewTags(person.countryTags);
  const communityTags = readyReviewTags(person.communityTags);

  if (nationalityTags.length === 0) {
    issues.push({
      category: 'heritage',
      label: 'Nationality',
      detail: communityTags.length > 0
        ? 'Confirm this as a community-led profile rather than a nationality-led profile.'
        : 'Add a visitor-facing nationality term or mark the profile as community-led.',
    });
  } else if (!isApprovedMetadataSource(person.countryTagsSource)) {
    issues.push({
      category: 'heritage',
      label: 'Nationality',
      detail: `Nationality terms are present, but the source is still ${formatAdminStatus(person.countryTagsSource)}.`,
    });
  }

  if (communityTags.length === 0) {
    issues.push({
      category: 'community',
      label: 'Community',
      detail: 'Add community taxonomy such as Hispanic, Middle Eastern, civic leadership, media, or institutional impact.',
    });
  }

  if (!isApprovedStatus(person.imageRightsStatus)) {
    issues.push({
      category: 'media',
      label: 'Image Rights',
      detail: `Image rights status is ${formatAdminStatus(person.imageRightsStatus)}.`,
    });
  }

  if (needsAltTextReview(person)) {
    issues.push({
      category: 'media',
      label: 'Alt Text',
      detail: 'Primary image alt text is missing, generic, or only repeats the profile name.',
    });
  }

  if (person.hasVideo && !isApprovedStatus(person.videoRightsStatus)) {
    issues.push({
      category: 'media',
      label: 'Video Rights',
      detail: `Video rights status is ${formatAdminStatus(person.videoRightsStatus)}.`,
    });
  }

  if (person.hasVideo && needsCaptionTranscriptReview(person.mediaReviewStatus)) {
    issues.push({
      category: 'media',
      label: 'Captions',
      detail: `Video media review status is ${formatAdminStatus(person.mediaReviewStatus)}.`,
    });
  }

  if (!hasVisitorSummary(person)) {
    issues.push({
      category: 'story',
      label: 'Summary',
      detail: 'Visitor-facing summary copy is missing or too thin for the kiosk profile.',
    });
  }

  if (!isApprovedStatus(person.approvalStatus) || isPriorityReview(person.reviewPriority)) {
    issues.push({
      category: 'profile',
      label: 'Profile Approval',
      detail: `Profile status is ${formatAdminStatus(person.approvalStatus)} with ${formatAdminStatus(person.reviewPriority)} review priority.`,
    });
  }

  if (issues.length === 0) return null;

  return {
    id: person.id,
    name: person.name,
    classYear: person.classYear,
    priority: adminReviewPriorityFor(person, issues),
    detail: adminReviewDetail(person, nationalityTags, communityTags),
    issues,
    status: {
      approvalStatus: person.approvalStatus,
      reviewPriority: person.reviewPriority,
      countryTagsSource: person.countryTagsSource,
      themeTagsSource: person.themeTagsSource,
      imageRightsStatus: person.imageRightsStatus,
      videoRightsStatus: person.videoRightsStatus,
      mediaReviewStatus: person.mediaReviewStatus,
    },
  };
}

function buildAdminReviewMetrics(totalProfiles: number, items: AdminReviewItem[]): AdminReviewMetric[] {
  const categoryCount = (category: AdminReviewCategory) => (
    items.filter((item) => item.issues.some((issue) => issue.category === category)).length
  );
  const mediaCount = items.filter((item) => item.issues.some((issue) => issue.category === 'media')).length;
  const highPriority = items.filter((item) => item.priority === 'high').length;

  return [
    { label: 'Queued', value: items.length, detail: `${totalProfiles} total profiles` },
    { label: 'High Priority', value: highPriority, detail: 'Marked high or media-blocked' },
    { label: 'Nationality', value: categoryCount('heritage'), detail: 'Missing or inferred metadata' },
    { label: 'Community', value: categoryCount('community'), detail: 'Needs taxonomy term' },
    { label: 'Media', value: mediaCount, detail: 'Rights, captions, or alt text' },
    { label: 'Profile', value: categoryCount('profile'), detail: 'Draft or priority review' },
  ];
}

function adminReviewPriorityFor(person: Inductee, issues: AdminReviewIssue[]): AdminReviewPriority {
  const priority = normalizeAdminStatus(person.reviewPriority);
  if (priority === 'high' || priority === 'medium' || priority === 'standard') return priority;
  if (issues.some((issue) => issue.label === 'Video Rights' || issue.label === 'Captions')) return 'high';
  if (issues.length >= 3) return 'medium';
  return 'standard';
}

function adminReviewPriorityRank(priority: AdminReviewPriority) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function adminReviewDetail(person: Inductee, nationalityTags: string[], communityTags: string[]) {
  const tags = [
    nationalityTags[0],
    communityTags[0],
    person.region && isReadyReviewLabel(person.region) ? person.region : '',
  ].filter(Boolean);
  return tags.slice(0, 2).join(' / ') || 'taxonomy pending';
}

function readyReviewTags(tags: string[]) {
  const seen = new Set<string>();
  return tags.map((tag) => tag.trim()).filter((tag) => {
    const key = normalizeAdminStatus(tag);
    if (!isReadyReviewLabel(tag) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isReadyReviewLabel(value: string) {
  const key = normalizeAdminStatus(value);
  return Boolean(key)
    && key !== 'na'
    && key !== 'n-a'
    && key !== 'n/a'
    && key !== 'none'
    && key !== 'unknown'
    && key !== 'unspecified'
    && key !== 'not-applicable';
}

function isApprovedMetadataSource(value: string) {
  const key = normalizeAdminStatus(value);
  return key === 'curated' || key === 'documented' || key === 'approved';
}

function isApprovedStatus(value: string) {
  const key = normalizeAdminStatus(value);
  return key === 'approved' || key === 'reviewed' || key === 'cleared' || key === 'published';
}

function isPriorityReview(value: string) {
  const key = normalizeAdminStatus(value);
  return key === 'high' || key === 'medium';
}

function needsAltTextReview(person: Inductee) {
  const alt = normalizeAdminStatus(person.imageAltText);
  const name = normalizeAdminStatus(person.name);
  return !alt
    || alt === name
    || alt === 'image'
    || alt === 'photo'
    || alt === 'portrait'
    || alt === 'profile-image'
    || alt === 'headshot';
}

function needsCaptionTranscriptReview(value: string) {
  const key = normalizeAdminStatus(value);
  return !key || key.includes('caption') || key.includes('transcript') || key.includes('review');
}

function hasVisitorSummary(person: Inductee) {
  return [person.honoredForSummary, person.storySummary, person.lifeWorkSummary, person.documentedContextLine]
    .some((value) => value.trim().replace(/\s+/g, ' ').length >= 24);
}

function normalizeAdminStatus(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function formatAdminStatus(value: string) {
  const normalized = value.trim();
  return normalized || 'missing';
}

function reviewQueueFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `cihof-review-queue-${date}.json`;
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
