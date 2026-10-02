import type { PublishedPerson } from '@cihof/content';
import { composeContextLine, composeHonoredFor } from '../compose.ts';
import { inducteeId } from '../identity.ts';
import { readRoster } from '../sources/manifest.ts';
import { normalizeCommunityTags } from '../text/biography.ts';
import { profileContentVersion } from './profiles.ts';
import { parseRows } from './review.ts';

/**
 * Profile edits: what a curator may change about a profile in the staff
 * review app's profile editor.
 *
 * The words and tags a visitor reads that are the museum's own: the name and
 * how it is alphabetised; the communities, honours and countries; the
 * "Honoured for" and context lines; and the portrait's description and where
 * its face sits. Not the class year or who presented them, which are the
 * institution's roster (and the class year is part of every id); not the
 * biography, corrected on its own sheet (bios:apply); not the portrait file,
 * its rights, or any approval. An edit changes what visitors see, so the tool
 * that applies it (profiles:edit) records each difference under the decision,
 * and the profile's approval lapses until somebody approves it as edited
 * (profiles:apply, the only writer of approvals).
 *
 * The two lines were first written by a generator from the tags, and are
 * stored as text, so changing the tags does not change them. An edit may keep
 * a line, take the generator's wording for the edited tags, or put the
 * curator's own words, which are then credited to the curator
 * (`honoredForCurated`, `contextLineCurated`) while the line says exactly that.
 */
export type ProfileEdit = {
  readonly name: string;
  readonly sortName: string;
  readonly communities: readonly string[];
  /** The honours: the approved theme tags. */
  readonly contributions: readonly string[];
  readonly countries: readonly string[];
  readonly honoredFor: string;
  readonly contextLine: string;
  readonly portraitAlt: string;
  /** `center`, the usual (the face towards the top), or a position such as `50% 30%`. */
  readonly focalPoint: string;
};

export const profileEditLimits = { name: 80, line: 240, portraitAlt: 300, tag: 60, tags: 12 } as const;
const focalPattern = /^(center|(100|[1-9]?\d)% (100|[1-9]?\d)%)$/;

type RawRecord = Record<string, unknown> & { image?: Record<string, unknown> };
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) => (Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : []);

/** A profile's editable parts as they are stored now; `name` falls back to the roster's, as the display does. */
export function profileEditOf(record: RawRecord, person: Pick<PublishedPerson, 'name' | 'sortName'>): ProfileEdit {
  const image = record.image && typeof record.image === 'object' ? record.image : {};
  return {
    name: text(record['displayName']).trim() || person.name,
    sortName: text(record['sortName']).trim() || person.sortName,
    communities: list(record['approvedCommunityTags']),
    contributions: list(record['approvedThemeTags']),
    countries: list(record['approvedCountryTags']),
    honoredFor: text(record['honoredForSummary']).trim(),
    contextLine: text(record['documentedContextLine']).trim(),
    portraitAlt: text(image['primaryAltText']).trim(),
    focalPoint: text(image['focalPoint']).trim() || 'center',
  };
}

/** What is wrong with an edit, in words for the curator; empty when nothing is. */
export function profileEditProblems(edit: ProfileEdit): string[] {
  const problems: string[] = [];
  for (const [field, label] of [['name', 'The name'], ['sortName', 'The name as it is alphabetised']] as const) {
    const value = edit[field].trim();
    if (!value) problems.push(`${label} is empty.`);
    else if (value.length > profileEditLimits.name) problems.push(`${label} is ${value.length} characters; keep it to ${profileEditLimits.name}.`);
  }
  for (const [field, label] of [['honoredFor', 'The "Honoured for" line'], ['contextLine', 'The context line']] as const) {
    if (edit[field].trim().length > profileEditLimits.line) problems.push(`${label} is ${edit[field].trim().length} characters; keep it to ${profileEditLimits.line}.`);
  }
  if (edit.portraitAlt.trim().length > profileEditLimits.portraitAlt) problems.push(`The picture description is too long; keep it to ${profileEditLimits.portraitAlt} characters.`);
  for (const [field, label] of [['communities', 'communities'], ['contributions', 'honours'], ['countries', 'countries']] as const) {
    const tags = edit[field];
    if (tags.length > profileEditLimits.tags) problems.push(`There are ${tags.length} ${label}; keep it to ${profileEditLimits.tags}.`);
    for (const tag of tags) {
      const value = tag.trim();
      if (value.length < 2) problems.push(`"${value}" is too short for one of the ${label}.`);
      else if (value.length > profileEditLimits.tag) problems.push(`"${value.slice(0, 24)}…" is too long for one of the ${label}.`);
      if (value.includes(';')) problems.push(`"${value}" has a semicolon in it, which a sheet cannot carry.`);
    }
    if (new Set(tags.map((tag) => tag.trim().toLowerCase())).size !== tags.length) problems.push(`One of the ${label} is listed twice.`);
  }
  if (!focalPattern.test(edit.focalPoint.trim())) problems.push(`"${edit.focalPoint}" is not a place in the picture.`);
  return problems;
}

/** The generator's wording of both lines for the edited tags, as the profile would first have been given them. */
export function composedLines(id: string, edit: Pick<ProfileEdit, 'communities' | 'contributions' | 'countries'>, roster = readRoster()) {
  const row = roster.find((each) => inducteeId(each.name, each.classYear) === id);
  const classYear = row && /^\d{4}$/.test(row.classYear) ? Number(row.classYear) : null;
  return {
    honoredFor: composeHonoredFor(edit.contributions, edit.countries),
    contextLine: row
      ? composeContextLine({ classYear, inductedBy: row.inductedBy, region: row.region, countryTags: edit.countries, communityTags: normalizeCommunityTags(edit.communities) })
      : '',
  };
}

export const profileEditColumns = ['id', 'contentVersion', 'name', 'sortName', 'communities', 'contributions', 'countries', 'honoredFor', 'contextLine', 'portraitAlt', 'focalPoint', 'decisionReference', 'note'] as const;

export type ProfileEditDecision = {
  readonly id: string;
  readonly name: string;
  readonly edit: ProfileEdit;
  /** The generator's wording for the edited tags: a line that matches it is the generator's, not the curator's. */
  readonly composed: { readonly honoredFor: string; readonly contextLine: string };
  readonly decisionReference: string;
  readonly note: string;
};

/**
 * Reads profile edits from a sheet with `profileEditColumns`, lists separated
 * by semicolons. Each names the version of the profile the editing began
 * from, and is refused if the profile has changed since, so nobody's change is
 * laid over another's unseen; and each must pass the editor's checks and
 * change something.
 */
export function profileEditDecisions(csvText: string, context: {
  people: readonly PublishedPerson[];
  curated: { inductees: Record<string, RawRecord> };
  checksums: ReadonlyMap<string, string>;
  roster?: ReturnType<typeof readRoster>;
}) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const missing = profileEditColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as ProfileEditDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const people = new Map(context.people.map((person) => [person.id as string, person]));
  const roster = context.roster ?? readRoster();
  const decisions: ProfileEditDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const id = cell(cells, 'id');
    if (!id) return;
    if (!cell(cells, 'name') && !cell(cells, 'contentVersion')) { blank += 1; return; }
    const person = people.get(id);
    const record = context.curated.inductees[id];
    if (!person || !record) { errors.push(`line ${line}: there is no profile "${id}"`); return; }
    if (seen.has(id)) { errors.push(`line ${line}: the profile "${id}" appears twice`); return; }
    seen.add(id);
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: an edit needs a decisionReference`); return; }
    if (cell(cells, 'contentVersion') !== profileContentVersion(person, context.checksums.get(id) ?? '')) {
      errors.push(`line ${line}: ${person.name}'s profile has changed since this edit began, so it would undo somebody else's change. Edit it again from how it is now.`);
      return;
    }
    const tags = (column: string) => cell(cells, column).split(';').map((each) => each.trim()).filter(Boolean);
    const edit: ProfileEdit = {
      name: cell(cells, 'name'),
      sortName: cell(cells, 'sortName'),
      communities: tags('communities'),
      contributions: tags('contributions'),
      countries: tags('countries'),
      honoredFor: cell(cells, 'honoredFor'),
      contextLine: cell(cells, 'contextLine'),
      portraitAlt: cell(cells, 'portraitAlt'),
      focalPoint: cell(cells, 'focalPoint') || 'center',
    };
    const problems = profileEditProblems(edit);
    if (problems.length > 0) { errors.push(...problems.map((problem) => `line ${line}: ${person.name}: ${problem}`)); return; }
    if (JSON.stringify(edit) === JSON.stringify(profileEditOf(record, person))) {
      errors.push(`line ${line}: the edit of ${person.name}'s profile changes nothing`);
      return;
    }
    decisions.push({ id, name: person.name, edit, composed: composedLines(id, edit, roster), decisionReference: reference, note: cell(cells, 'note') });
  });
  return { decisions, errors, blank };
}

/**
 * The edits written into the curated records, in memory. Each line that
 * changed is credited to the curator unless it is the generator's wording for
 * the edited tags; a line left as it was keeps its credit. The edit is noted
 * on the record. Nothing else is touched: not the biography, the rights, or
 * the approval, which lapses by itself because the profile has changed.
 */
export function applyProfileEdits<T extends { inductees: Record<string, RawRecord> }>(curated: T, decisions: readonly ProfileEditDecision[], appliedAt: string): T {
  const next = structuredClone(curated);
  for (const decision of decisions) {
    const record = next.inductees[decision.id];
    if (!record) continue;
    const { edit } = decision;
    const tidy = (tags: readonly string[]) => tags.map((tag) => tag.trim()).filter(Boolean);
    record['displayName'] = edit.name.trim();
    record['sortName'] = edit.sortName.trim();
    record['approvedCommunityTags'] = tidy(edit.communities);
    record['approvedThemeTags'] = tidy(edit.contributions);
    record['approvedCountryTags'] = tidy(edit.countries);
    for (const [field, credit, value, generated] of [
      ['honoredForSummary', 'honoredForCurated', edit.honoredFor.trim(), decision.composed.honoredFor],
      ['documentedContextLine', 'contextLineCurated', edit.contextLine.trim(), decision.composed.contextLine],
    ] as const) {
      if (value === text(record[field]).trim()) continue;
      record[field] = value;
      if (value && value !== generated.trim()) record[credit] = { text: value, decisionReference: decision.decisionReference };
      else delete record[credit];
    }
    const image = record.image && typeof record.image === 'object' ? record.image : {};
    record.image = { ...image, primaryAltText: edit.portraitAlt.trim(), focalPoint: edit.focalPoint.trim() || 'center' };
    record['curatorNotes'] = [...list(record['curatorNotes']), `Profile edited under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.`];
  }
  return next;
}
