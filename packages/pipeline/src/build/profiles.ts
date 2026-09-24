import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { PublishedPerson } from '@cihof/content';
import { dataFile } from '../paths.ts';
import { csvCell, parseRows } from './review.ts';

/**
 * Approving a profile: a curator's statement that what a visitor sees for a
 * person is right to show.
 *
 * An approval follows the house rule for any approval: a status, a decision
 * reference saying who decided and when, and a content version saying exactly
 * what was approved. The content version is a fingerprint of everything a
 * visitor sees on the profile, the portrait file included, so an approval
 * covers those words and that picture and no others. When any of it changes
 * afterwards the profile reads as changed since approval, never as still
 * approved.
 *
 * Approval does not decide whether a person is shown. `isEligible` is
 * deliberately not tied to it, and gating on it would empty the exhibit. It
 * records that the institution stands behind what is on screen.
 *
 * Stored on the curated record:
 *
 *   profileReview: { status: 'approved' | 'changes-requested',
 *                    decisionReference, contentVersion, reviewedAt, note? }
 */

export type ProfileReview = {
  readonly status: 'approved' | 'changes-requested';
  readonly decisionReference: string;
  readonly contentVersion: string;
  readonly reviewedAt: string;
  readonly note?: string;
};

export type ProfileState = 'unreviewed' | 'approved' | 'changed-since-approval' | 'changes-requested';

/** The portrait files' checksums, so a replaced picture changes the version too. */
export function readPortraitChecksums(): Map<string, string> {
  const manifest = JSON.parse(readFileSync(dataFile('media_manifest.json'), 'utf8')) as {
    assets?: Record<string, { images?: { primary?: { checksumSha256?: string } } }>;
  };
  const checksums = new Map<string, string>();
  for (const [id, asset] of Object.entries(manifest.assets ?? {})) {
    const checksum = asset.images?.primary?.checksumSha256;
    if (checksum) checksums.set(id, checksum);
  }
  return checksums;
}

/** A fingerprint of everything a visitor sees on this person's profile. */
export function profileContentVersion(person: PublishedPerson, portraitChecksum = ''): string {
  const visible = {
    name: person.name,
    sortName: person.sortName,
    classYear: person.classYear,
    portrait: person.portrait
      ? { src: person.portrait.src, alt: person.portrait.alt, rights: person.portrait.rights, focalPoint: person.portrait.focalPoint ?? '', file: portraitChecksum }
      : null,
    biography: person.biography?.text ?? '',
    contribution: person.contribution?.text ?? '',
    context: person.context?.text ?? '',
    communities: person.communities.values,
    contributions: person.contributions.values,
    countries: person.countries.values,
    presentedBy: person.presentedBy?.recordedName ?? '',
    sourceUrl: person.sourceUrl ?? '',
  };
  return `profile-${createHash('sha256').update(JSON.stringify(visible)).digest('hex').slice(0, 12)}`;
}

export function profileState(review: ProfileReview | undefined, currentVersion: string): ProfileState {
  if (!review) return 'unreviewed';
  if (review.status === 'changes-requested') return 'changes-requested';
  return review.contentVersion === currentVersion ? 'approved' : 'changed-since-approval';
}

/** Reads each curated record's profile review, if it has one. */
export function readProfileReviews(): Map<string, ProfileReview> {
  const curated = JSON.parse(readFileSync(dataFile('cihof_curated_metadata.json'), 'utf8')) as {
    inductees: Record<string, { profileReview?: ProfileReview }>;
  };
  const reviews = new Map<string, ProfileReview>();
  for (const [id, record] of Object.entries(curated.inductees)) {
    if (record.profileReview) reviews.set(id, record.profileReview);
  }
  return reviews;
}

export type ProfileRow = {
  readonly id: string;
  readonly name: string;
  readonly classYear: string;
  readonly state: ProfileState;
  readonly contentVersion: string;
};

export function buildProfileSheet(
  people: readonly PublishedPerson[],
  reviews: ReadonlyMap<string, ProfileReview> = readProfileReviews(),
  checksums: ReadonlyMap<string, string> = readPortraitChecksums(),
): ProfileRow[] {
  return [...people]
    .sort((a, b) => (a.classYear ?? 0) - (b.classYear ?? 0) || a.sortName.localeCompare(b.sortName))
    .map((person) => {
      const contentVersion = profileContentVersion(person, checksums.get(person.id) ?? '');
      return {
        id: person.id,
        name: person.name,
        classYear: person.classYear === null ? '' : String(person.classYear),
        state: profileState(reviews.get(person.id), contentVersion),
        contentVersion,
      };
    });
}

export const profileReviewerColumns = ['decision', 'decisionReference', 'note'] as const;

/**
 * The sheet, one row per person. `contentVersion` is the profile as it stood
 * when the sheet was made; an approval is refused if the profile has changed
 * since, because the reviewer did not see what it now says.
 */
export function profileSheetCsv(rows: readonly ProfileRow[]): string {
  const header = ['id', 'name', 'classYear', 'currentStatus', 'contentVersion', ...profileReviewerColumns];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([row.id, row.name, row.classYear, row.state, row.contentVersion, '', '', ''].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export type ProfileDecision = {
  readonly id: string;
  readonly name: string;
  readonly status: ProfileReview['status'];
  readonly contentVersion: string;
  readonly decisionReference: string;
  readonly note: string;
};

/**
 * Reads the reviewer's columns. `approve` needs the sheet's contentVersion to
 * match the profile as it is now; `changes` needs a note saying what.
 */
export function profileDecisions(csvText: string, rows: readonly ProfileRow[]) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const missing = ['id', 'contentVersion', ...profileReviewerColumns].filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { decisions: [], errors: [`the sheet is missing the column(s) ${missing.join(', ')}; make a new one with npm run review:profiles`], blank: 0 };
  }
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const decisions: ProfileDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const id = cell(cells, 'id');
    const decision = cell(cells, 'decision').toLowerCase();
    if (!id) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }
    const row = byId.get(id);
    if (!row) { errors.push(`line ${line}: ${id} is not a person the exhibit builds`); return; }
    const who = `${row.name} (${id})`;
    if (seen.has(id)) { errors.push(`line ${line}: ${who} appears twice`); return; }
    seen.add(id);
    if (!['approve', 'changes'].includes(decision)) { errors.push(`line ${line}: ${who}: decision is approve, changes or empty, not "${decision}"`); return; }
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: ${who} has a decision with no decisionReference`); return; }
    const note = cell(cells, 'note');
    if (decision === 'changes' && !note) { errors.push(`line ${line}: ${who}: say in the note what needs changing`); return; }
    if (decision === 'approve' && cell(cells, 'contentVersion') !== row.contentVersion) {
      errors.push(`line ${line}: ${who} has changed since this sheet was made, so the approval would cover words nobody reviewed. Look at it again.`);
      return;
    }
    decisions.push({
      id, name: row.name, status: decision === 'approve' ? 'approved' : 'changes-requested',
      contentVersion: row.contentVersion, decisionReference: reference, note,
    });
  });

  return { decisions, errors, blank };
}

/** The decisions written into a curated-roster document, in memory. */
export function applyProfileDecisions(
  curated: { inductees: Record<string, Record<string, unknown>> },
  decisions: readonly ProfileDecision[],
  reviewedAt: string,
) {
  const next = structuredClone(curated);
  for (const decision of decisions) {
    const record = next.inductees[decision.id];
    if (!record) throw new Error(`No curated record for ${decision.id}`);
    const review: ProfileReview = {
      status: decision.status,
      decisionReference: decision.decisionReference,
      contentVersion: decision.contentVersion,
      reviewedAt,
      ...(decision.note ? { note: decision.note } : {}),
    };
    record['profileReview'] = review;
    // The legacy field follows the review, so older reports agree with it.
    record['approvalStatus'] = decision.status === 'approved' ? 'approved' : 'draft';
  }
  return next;
}

export function profileProgress(rows: readonly ProfileRow[]) {
  const count = (state: ProfileState) => rows.filter((row) => row.state === state).length;
  return {
    total: rows.length,
    approved: count('approved'),
    changedSinceApproval: count('changed-since-approval'),
    changesRequested: count('changes-requested'),
    unreviewed: count('unreviewed'),
  };
}
