import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { allowsTarget, type VisitorTarget } from '@cihof/content';
import { dataFile } from '../paths.ts';
import { parseRows } from './review.ts';

/**
 * Curated tours: a theme a curator names ("Newcomer Support") and the people
 * it walks a visitor through, one at a time.
 *
 * A tour is visitor text like any other. It reaches a display only once a
 * curator has approved it (`reviewStatus: "approved"` in
 * data/cihof_story_lenses.json, with a `review` naming the version approved),
 * only on the targets that approval named (the display, the public website, or
 * both, kept apart as for all visitor content), and only while it is still
 * the tour that was approved: the version is a
 * fingerprint of its words and of the rules that choose its people, so an
 * edit to either holds it back until it is approved again. An editor's
 * preview also shows the drafts, each marked. Approvals are made in the staff
 * review app, or with a sheet and `npm run tours:apply`. Its people are chosen here, at build time, from the published
 * biographies and honours by the terms and themes the curator set, with the
 * people they pinned first and the people they excluded left out, so every
 * display of a release walks the same tour.
 */
export type RuntimeTour = {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly description: string;
  /** In the order the tour visits them. */
  readonly personIds: readonly string[];
  /** Only in an editor's preview: shown although nobody has approved it. */
  readonly unreviewed?: true;
};

type StoredLens = {
  readonly id?: unknown;
  readonly label?: unknown;
  readonly prompt?: unknown;
  readonly description?: unknown;
  readonly terms?: unknown;
  readonly themes?: unknown;
  readonly pinnedPersonIds?: unknown;
  readonly excludedPersonIds?: unknown;
  readonly reviewStatus?: unknown;
  readonly review?: { readonly contentVersion?: unknown; readonly decisionReference?: unknown; readonly reviewedAt?: unknown; readonly note?: unknown };
  readonly publication?: { readonly kiosk?: unknown; readonly publicWeb?: unknown };
  readonly maxPortraits?: unknown;
  readonly enabled?: unknown;
};

export type StoredTours = { readonly lenses?: readonly StoredLens[] };

/**
 * The version an approval names: a fingerprint of what a curator decides,
 * which is the tour's words and the rules that choose its people. The people
 * themselves are chosen from the published biographies and honours, which are
 * reviewed in their own right.
 */
export function tourVersion(lens: StoredLens): string {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const fields = [
    text(lens.label), text(lens.prompt), text(lens.description),
    strings(lens.terms), strings(lens.themes), strings(lens.pinnedPersonIds), strings(lens.excludedPersonIds),
    typeof lens.maxPortraits === 'number' ? lens.maxPortraits : null,
  ];
  return `tour-${createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 12)}`;
}

/** Approved, and still the tour that was approved. */
export function tourApproved(lens: StoredLens): boolean {
  return lens.reviewStatus === 'approved' && lens.review?.contentVersion === tourVersion(lens);
}

/** Where its approval lets it be shown. Nothing is assumed: a flag not set is not given. */
export function tourTargets(lens: StoredLens): { kiosk: boolean; publicWeb: boolean } {
  return { kiosk: lens.publication?.kiosk === true, publicWeb: lens.publication?.publicWeb === true };
}

/** Approved, still the tour that was approved, and approved for this target. */
export function tourPublished(lens: StoredLens, target: VisitorTarget): boolean {
  return tourApproved(lens) && allowsTarget(tourTargets(lens), target);
}

type TourPerson = {
  readonly id: string;
  readonly sortName: string;
  readonly biography: string;
  readonly contributions: readonly string[];
};

export function readTours(): StoredTours {
  return JSON.parse(readFileSync(dataFile('cihof_story_lenses.json'), 'utf8')) as StoredTours;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : []);
const fold = (value: string) => value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').trim();

export function publishedTours(
  people: readonly TourPerson[],
  target: VisitorTarget,
  { preview = false, stored = readTours() }: { preview?: boolean; stored?: StoredTours } = {},
): RuntimeTour[] {
  const tours: RuntimeTour[] = [];
  for (const lens of stored.lenses ?? []) {
    if (lens.enabled === false || typeof lens.id !== 'string' || typeof lens.label !== 'string') continue;
    const approved = tourPublished(lens, target);
    if (!approved && !preview) continue;
    const personIds = tourPeople(people, lens);
    if (personIds.length === 0) continue;
    tours.push({
      id: lens.id,
      label: lens.label,
      prompt: typeof lens.prompt === 'string' ? lens.prompt : '',
      description: typeof lens.description === 'string' ? lens.description : '',
      personIds,
      ...(approved ? {} : { unreviewed: true as const }),
    });
  }
  return tours;
}

/**
 * Who a tour visits: people whose biography uses the tour's terms (each term
 * counting up to six times) or whose honours match its themes (eight each),
 * scoring six or more, highest first. Pinned people lead in the curator's
 * order; excluded people never appear.
 */
export function tourPeople(people: readonly TourPerson[], lens: StoredLens): string[] {
  const terms = strings(lens.terms).map(fold).filter(Boolean);
  const themes = strings(lens.themes).map(fold).filter(Boolean);
  const excluded = new Set(strings(lens.excludedPersonIds));
  const known = new Set(people.map((person) => person.id));
  const pinned = strings(lens.pinnedPersonIds).filter((id) => known.has(id) && !excluded.has(id));
  const scored = people
    .map((person) => {
      const biography = fold(person.biography);
      const honours = person.contributions.map(fold);
      let score = 0;
      for (const term of terms) score += Math.min(biography.split(term).length - 1, 6);
      for (const theme of themes) if (honours.some((each) => each.includes(theme) || theme.includes(each))) score += 8;
      return { person, score };
    })
    .filter((entry) => entry.score >= 6 && !excluded.has(entry.person.id) && !pinned.includes(entry.person.id))
    .sort((a, b) => b.score - a.score || a.person.sortName.localeCompare(b.person.sortName));
  const limit = typeof lens.maxPortraits === 'number' && lens.maxPortraits > 0 ? lens.maxPortraits : 48;
  return [...pinned, ...scored.map((entry) => entry.person.id)].slice(0, limit);
}

export type TourDecision = {
  readonly tourId: string;
  /** `approve` shows it on the displays; `withdraw` takes an approved tour off them. */
  readonly decision: 'approve' | 'withdraw';
  /** For an approval, who may see it; asked, never assumed wider. */
  readonly targets: { readonly kiosk: boolean; readonly publicWeb: boolean };
  readonly decisionReference: string;
  readonly note: string;
};

/**
 * Reads a curator's decisions on the tours from a sheet (tourId, decision,
 * contentVersion, targets, decisionReference, note). An approval names the
 * version the reviewer saw, and is refused if the tour has changed since, so
 * nobody approves a tour they did not look at; and it names who may see it
 * (`kiosk`, `public-web`, or both, comma-separated), since the display and the
 * website are decided apart. An empty decision leaves a tour as it is.
 */
export function tourDecisions(csvText: string, stored: StoredTours = readTours()) {
  const parsed = parseRows(csvText.replace(/^\uFEFF/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const required = ['tourId', 'decision', 'contentVersion', 'targets', 'decisionReference', 'note'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as TourDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const lenses = new Map((stored.lenses ?? []).filter((lens) => typeof lens.id === 'string').map((lens) => [lens.id as string, lens]));
  const decisions: TourDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const tourId = cell(cells, 'tourId');
    const decision = cell(cells, 'decision').toLowerCase();
    if (!tourId) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }
    const lens = lenses.get(tourId);
    if (!lens) { errors.push(`line ${line}: there is no tour "${tourId}"`); return; }
    if (seen.has(tourId)) { errors.push(`line ${line}: the tour "${tourId}" appears twice`); return; }
    seen.add(tourId);
    if (decision !== 'approve' && decision !== 'withdraw') { errors.push(`line ${line}: decision is approve, withdraw or empty, not "${decision}"`); return; }
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a decision needs a decisionReference`); return; }
    let targets = { kiosk: false, publicWeb: false };
    if (decision === 'approve') {
      const names = cell(cells, 'targets').split(',').map((name) => name.trim()).filter(Boolean);
      const unknown = names.filter((name) => name !== 'kiosk' && name !== 'public-web');
      if (unknown.length > 0) { errors.push(`line ${line}: "${unknown.join(', ')}" is not a target; use kiosk, public-web, or both`); return; }
      if (names.length === 0) { errors.push(`line ${line}: an approval needs targets, saying who may see the tour (kiosk, or kiosk,public-web)`); return; }
      targets = { kiosk: names.includes('kiosk'), publicWeb: names.includes('public-web') };
      if (lens.enabled === false) { errors.push(`line ${line}: the tour "${tourId}" is switched off, so there is nothing to approve`); return; }
      if (cell(cells, 'contentVersion') !== tourVersion(lens)) {
        errors.push(`line ${line}: the tour "${tourId}" has changed since this sheet was made, so the approval would cover a tour nobody reviewed. Look at it again.`);
        return;
      }
    } else if (lens.reviewStatus !== 'approved') {
      errors.push(`line ${line}: the tour "${tourId}" is not approved, so there is nothing to withdraw`);
      return;
    }
    decisions.push({ tourId, decision, targets, decisionReference: reference, note: cell(cells, 'note') });
  });

  return { decisions, errors, blank };
}

/**
 * The decisions written into the tours document, in memory. An approval
 * records the version it covers and the targets it names; a withdrawal puts
 * the tour back to a draft, shown nowhere, and says who withdrew it. Nothing
 * else about a tour changes.
 */
export function applyTourDecisions(stored: StoredTours, decisions: readonly TourDecision[], reviewedAt: string): StoredTours {
  const next = structuredClone(stored) as { lenses?: Record<string, unknown>[] } & Record<string, unknown>;
  const byId = new Map(decisions.map((decision) => [decision.tourId, decision]));
  next.lenses = (next.lenses ?? []).map((lens) => {
    const decision = typeof lens['id'] === 'string' ? byId.get(lens['id']) : undefined;
    if (!decision) return lens;
    return {
      ...lens,
      reviewStatus: decision.decision === 'approve' ? 'approved' : 'draft',
      review: {
        ...(decision.decision === 'approve' ? { contentVersion: tourVersion(lens as StoredLens) } : { withdrawn: true }),
        decisionReference: decision.decisionReference,
        reviewedAt,
        ...(decision.note ? { note: decision.note } : {}),
      },
      publication: decision.decision === 'approve' ? { ...decision.targets } : { kiosk: false, publicWeb: false },
    };
  });
  return next as StoredTours;
}
