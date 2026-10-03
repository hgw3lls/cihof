import { createHash } from 'node:crypto';
import { slugify } from '../identity.ts';
import { placeHistoryProblem, placeTextVersion } from './place-text.ts';
import { parseRows, placeRoles } from './review.ts';

/**
 * A place's details changed, or a new place added, in the staff portal.
 *
 * What a visitor learns about a place is its name, its neighbourhood, its
 * short history and the people tied to it, each with what they did there
 * (packages/content: lenses.ts). The places review approves the words and the
 * roles of ties the research found; this is the rest: renaming a place, its
 * neighbourhood, a place the research never found, and somebody tied to a
 * place who was not.
 *
 * An edit names the words it began from, so it never undoes somebody else's
 * change. It is approved as edited for the audience the reviewer chose, as an
 * approval in the places review would be, or left for somebody else to
 * approve: changed words hide an approved place until then, as they always
 * have. A tie added says what the person did there, from the vocabulary the
 * places review uses, and rests on the decision that added it; left for
 * somebody else, it is shown nowhere until the places review approves it.
 * A new place may not share a name with another, or bring back a place a
 * curator took out of scope.
 */

export const placeEditColumns = [
  'placeId', 'decision', 'contentVersion', 'name', 'neighborhood', 'type', 'shortHistory', 'people', 'audience', 'decisionReference', 'note',
] as const;

export const placeEditLimits = { name: 80, neighborhood: 60, people: 40 } as const;
export const placeAudiences = { kiosk: { kiosk: true, publicWeb: false }, 'kiosk-and-web': { kiosk: true, publicWeb: true } } as const;

type Place = Record<string, unknown> & { id: string; name?: unknown; neighborhood?: unknown; shortHistory?: unknown };
type Association = Record<string, unknown>;
type Places = { placeTypes?: readonly string[]; places: Place[]; [key: string]: unknown };
type Associations = { associations: Association[]; [key: string]: unknown };

export type PlaceEdit = {
  readonly placeId: string;
  readonly decision: 'edit' | 'create';
  readonly name: string;
  readonly neighborhood: string;
  readonly type: string;
  readonly shortHistory: string;
  readonly people: readonly { readonly personId: string; readonly role: string }[];
  readonly audience: keyof typeof placeAudiences | 'nobody';
  readonly decisionReference: string;
  readonly note: string;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A new place's id: from its name, like every other. */
export function newPlaceId(name: string): string {
  return `place:${slugify(name)}`;
}

/** "person-id:role; person-id:role", as the sheet carries the people added. */
export function readPeople(cell: string) {
  return cell.split(';').map((each) => each.trim()).filter(Boolean).map((each) => {
    const at = each.lastIndexOf(':');
    return { personId: at > 0 ? each.slice(0, at).trim() : each, role: at > 0 ? each.slice(at + 1).trim() : '' };
  });
}

/**
 * `removed` is the ledger of places a curator took out of scope
 * (data/cihof_places_removed.json): a new place may not bring one back under
 * the same id. Undoing such a decision is a decision of its own.
 */
export function placeEditDecisions(csvText: string, context: {
  places: Places;
  associations: Associations;
  personIds: ReadonlySet<string>;
  removed?: readonly { readonly id?: unknown; readonly decisionReference?: unknown }[];
}) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const missing = placeEditColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as PlaceEdit[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const byId = new Map(context.places.places.map((place) => [place.id, place]));
  const types = context.places.placeTypes ?? [];
  const tied = new Set(context.associations.associations.map((tie) => `${text(tie['person'])}|${text(tie['place'])}`));
  const removed = new Map((context.removed ?? []).map((entry) => [text(entry.id), text(entry.decisionReference)]));
  // Every place's name as it will be, so two places never end up showing the same one.
  const key = (name: string) => name.trim().toLocaleLowerCase();
  const namesAfter = new Map(context.places.places.map((place) => [place.id, text(place.name)]));
  parsed.slice(1).forEach((cells) => {
    const decision = cell(cells, 'decision');
    const name = cell(cells, 'name');
    if (decision === 'edit' && byId.has(cell(cells, 'placeId'))) namesAfter.set(cell(cells, 'placeId'), name);
    if (decision === 'create' && slugify(name)) namesAfter.set(`${newPlaceId(name)}#new`, name);
  });
  const nameTaken = (placeId: string, name: string) => [...namesAfter].some(([id, other]) => id !== placeId && id !== `${placeId}#new` && key(other) === key(name));
  const decisions: PlaceEdit[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const decision = cell(cells, 'decision');
    if (!decision) { if (cells.some((each) => each.trim())) blank += 1; return; }
    const name = cell(cells, 'name');
    const problems: string[] = [];
    if (decision !== 'edit' && decision !== 'create') { errors.push(`line ${line}: "${decision}" is not a decision about a place (edit or create)`); return; }
    const placeId = decision === 'create' ? newPlaceId(name) : cell(cells, 'placeId');
    const place = byId.get(placeId);
    const who = name || placeId || `line ${line}`;

    if (decision === 'edit') {
      if (!place) { errors.push(`line ${line}: there is no place "${placeId}"`); return; }
      if (cell(cells, 'contentVersion') !== placeTextVersion(place)) {
        errors.push(`line ${line} (${who}): the place changed since this edit began, so it would undo somebody else's change. Edit it again from how it is now.`);
        return;
      }
    } else if (!slugify(name)) {
      problems.push('a new place needs a name');
    } else if (place) {
      problems.push(`there is already a place called that (${placeId})`);
    } else if (removed.has(placeId)) {
      problems.push(`"${name}" was taken out of the places under ${removed.get(placeId) || 'an earlier decision'}; bringing it back is a decision of its own`);
    }
    if (name && nameTaken(placeId, name)) problems.push(`another place is called "${name}" too`);
    if (seen.has(placeId)) problems.push('the place appears twice in this sheet');
    seen.add(placeId);

    if (!name) problems.push('the name is empty');
    if (name.length > placeEditLimits.name) problems.push(`the name is longer than ${placeEditLimits.name} characters`);
    const neighborhood = cell(cells, 'neighborhood');
    if (neighborhood.length > placeEditLimits.neighborhood) problems.push(`the neighbourhood is longer than ${placeEditLimits.neighborhood} characters`);
    const type = cell(cells, 'type') || text(place?.['type']);
    if (!types.includes(type)) problems.push(`"${type}" is not a kind of place (${types.join(', ')})`);
    const shortHistory = cell(cells, 'shortHistory');
    const historyProblem = placeHistoryProblem(shortHistory);
    if (historyProblem) problems.push(historyProblem);

    const people = readPeople(cell(cells, 'people'));
    if (people.length > placeEditLimits.people) problems.push(`more than ${placeEditLimits.people} people are added at once`);
    const added = new Set<string>();
    for (const { personId, role } of people) {
      if (!context.personIds.has(personId)) problems.push(`there is nobody "${personId}" to tie to it`);
      else if (!(placeRoles as readonly string[]).includes(role)) problems.push(`"${role}" is not what somebody did at a place (${placeRoles.join(', ')})`);
      else if (tied.has(`${personId}|${placeId}`) || added.has(personId)) problems.push(`${personId} is tied to it already; give their role in the places review`);
      added.add(personId);
    }
    if (decision === 'create' && people.length === 0) problems.push('a new place needs somebody tied to it, or visitors find nobody there');

    const audience = cell(cells, 'audience');
    if (audience !== 'nobody' && !Object.hasOwn(placeAudiences, audience)) problems.push(`"${audience}" is not who may see it (kiosk, kiosk-and-web or nobody)`);
    const reference = cell(cells, 'decisionReference');
    if (!reference) problems.push('the change needs a decisionReference');

    if (decision === 'edit' && place && problems.length === 0) {
      const unchanged = name === text(place['name']) && neighborhood === text(place['neighborhood']) && shortHistory === text(place['shortHistory'])
        && type === text(place['type']) && people.length === 0 && audience === 'nobody';
      if (unchanged) problems.push('the edit changes nothing');
    }
    if (problems.length > 0) { errors.push(`line ${line} (${who}): ${problems.join('; ')}`); return; }
    decisions.push({
      placeId, decision, name, neighborhood, type, shortHistory, people,
      audience: audience as PlaceEdit['audience'], decisionReference: reference, note: cell(cells, 'note'),
    });
  });
  return { decisions, errors, blank };
}

/** The edits written into the places and their ties, in memory. */
export function applyPlaceEdits(places: Places, associations: Associations, decisions: readonly PlaceEdit[], appliedAt: string) {
  const nextPlaces = structuredClone(places);
  const nextTies = structuredClone(associations);
  for (const decision of decisions) {
    let place = nextPlaces.places.find((each) => each.id === decision.placeId);
    if (!place) {
      place = {
        id: decision.placeId,
        name: decision.name,
        type: decision.type,
        shortHistory: decision.shortHistory,
        neighborhood: decision.neighborhood,
        provenance: { source: 'Staff portal', confidence: 'curated', note: `Added under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.` },
        researched: true,
      };
      nextPlaces.places.push(place);
    } else {
      Object.assign(place, { name: decision.name, neighborhood: decision.neighborhood, type: decision.type, shortHistory: decision.shortHistory });
      const notes = Array.isArray(place['editNotes']) ? place['editNotes'] : [];
      place['editNotes'] = [...notes, `Edited under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.`];
    }
    // Approved as edited, for the audience chosen; otherwise the approval on
    // file stands, and covers these words only if they did not change.
    if (decision.audience !== 'nobody') {
      place['review'] = {
        status: 'approved',
        decisionReference: decision.decisionReference,
        contentVersion: placeTextVersion(place),
        reviewedAt: appliedAt,
        ...(decision.note ? { note: decision.note } : {}),
      };
      place['publication'] = { ...placeAudiences[decision.audience] };
    }
    // A tie left for somebody else is recorded with its role, but approved for
    // nobody, so it shows nowhere until somebody approves it in the places review.
    const approved = decision.audience !== 'nobody';
    for (const { personId, role } of decision.people) {
      const id = `edge:${createHash('sha256').update(`${personId}|${decision.placeId}|staff`).digest('hex').slice(0, 14)}`;
      nextTies.associations.push({
        id,
        person: personId,
        place: decision.placeId,
        kind: 'associated_with_place',
        role,
        evidence: [{ id: `${id}:src0`, title: `Recorded in the staff portal under ${decision.decisionReference}.`, kind: 'staff-decision' }],
        verificationLayer: 'curated',
        review: approved
          ? {
            status: 'approved',
            decisionReference: decision.decisionReference,
            contentVersion: 'places-v1',
            reviewedAt: appliedAt,
            ...(decision.note ? { note: decision.note } : {}),
          }
          : { status: 'needs-review', decisionReference: decision.decisionReference, ...(decision.note ? { note: decision.note } : {}) },
        publication: decision.audience === 'nobody' ? { kiosk: false, publicWeb: false } : { ...placeAudiences[decision.audience] },
      });
    }
  }
  return { places: nextPlaces, associations: nextTies };
}
