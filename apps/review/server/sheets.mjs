/**
 * A reviewer's draft, turned into the sheets the apply tools already read.
 *
 * The review app decides nothing of its own. Everything a reviewer chooses is
 * written into the same CSV a curator would fill in by hand, and applied by
 * the same tool, with the same checks: the app is a friendlier way to fill in
 * a sheet, not a second way to change the data.
 *
 * A draft, as the app keeps it between visits:
 *
 *   {
 *     reviewer: "Jane Smith",
 *     ties:      { [tieId]: { decision, kind, direction, label, inverseLabel, note } },
 *     places:    { [placeId]: { approve: true, seenVersion, history?, note } | { approve: false } },
 *     placeTies: { ["placeId|personId"]: { role, note } },
 *     bios:      { [personId]: { correctedText } | { useSourceText: true }, note },
 *     profiles:  { [personId]: { decision: 'approve' | 'changes', seenVersion, note } },
 *     profileEdits: { [personId]: { seenVersion, edit: { name, sortName, communities, contributions, countries,
 *                                   honoredFor, contextLine, portraitAlt, focalPoint }, note } },
 *     attract:   { attract: { decision: 'approve', seenVersion } | { decision: 'reword', headline, tagline } },
 *     filmTitles: { [filmId]: { decision: 'approve', title, note } | { decision: 'clear', note } },
 *     filmStarts: { ["personId|filmId"]: { decision: 'start', seconds } | { decision: 'beginning' } },
 *     tours:     { [tourId]: { decision: 'approve', seenVersion, audience: 'kiosk' | 'kiosk-and-web', note } | { decision: 'withdraw', note }
 *                  | { decision: 'edit', seenVersion, changes: { label, prompt, description, terms, themes, pinnedPersonIds, excludedPersonIds, maxPortraits },
 *                      audience: 'kiosk' | 'kiosk-and-web' | 'nobody' | null, note }
 *                  | { decision: 'create', changes, audience, note }, under the new tour's name
 *                  | { decision: 'delete', seenVersion, note } },
 *   }
 */

/** The decision reference for one kind of review on one day. */
export function decisionReference(task, day) {
  const subject = { ties: 'connections', places: 'places', placeTies: 'place-roles', bios: 'biographies', profiles: 'profiles', profileEdits: 'profile-edits', attract: 'attract-words', tours: 'tours', filmTitles: 'film-titles', filmStarts: 'film-starts', signoffs: 'sign-offs', filmFixes: 'film-captions' }[task];
  if (!subject) throw new Error(`Unknown review: ${task}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Not a day: ${day}`);
  return `${subject}-review-${day}`;
}

/** The note each decision carries: the reviewer's words, then who decided. */
export function signedNote(note, reviewer) {
  const who = `Reviewed by ${reviewer} in the staff review app.`;
  const text = String(note ?? '').trim();
  if (!text) return who;
  return `${/[.!?)"'”’]$/.test(text) ? text : `${text}.`} ${who}`;
}

export function tiesCsv(draft, day) {
  const reference = decisionReference('ties', day);
  const rows = Object.entries(draft.ties ?? {}).map(([tieId, value]) => [
    tieId,
    value.decision,
    value.decision === 'relationship' ? value.kind ?? '' : '',
    value.decision === 'relationship' ? value.direction ?? 'a-to-b' : '',
    value.decision === 'reject' ? '' : value.label ?? '',
    value.decision === 'relationship' ? value.inverseLabel ?? '' : '',
    reference,
    signedNote(value.note, draft.reviewer),
  ]);
  return csv(['tieId', 'decision', 'kind', 'direction', 'label', 'inverseLabel', 'decisionReference', 'note'], rows);
}

export function placesCsv(draft, day) {
  const reference = decisionReference('places', day);
  const rows = Object.entries(draft.places ?? {})
    .filter(([, value]) => value.approve === true)
    // The version of the words the reviewer saw, and their own words when
    // they wrote some. The apply tool refuses a version that no longer matches.
    .map(([placeId, value]) => [placeId, 'yes', value.seenVersion ?? '', typeof value.history === 'string' ? value.history.trim() : '', reference, signedNote(value.note, draft.reviewer)]);
  return csv(['placeId', 'approve', 'contentVersion', 'newHistory', 'decisionReference', 'note'], rows);
}

export function placeTiesCsv(draft, day) {
  const reference = decisionReference('placeTies', day);
  const rows = Object.entries(draft.placeTies ?? {}).map(([key, value]) => {
    const [placeId, person] = splitTieKey(key);
    return [placeId, person, value.role, reference, signedNote(value.note, draft.reviewer)];
  });
  return csv(['placeId', 'person', 'role', 'decisionReference', 'note'], rows);
}

/** The biography sheet's own columns; the copied ones are for reading and are left empty. */
export function biosCsv(draft, day) {
  const reference = decisionReference('bios', day);
  const rows = Object.entries(draft.bios ?? {}).map(([id, value]) => [
    id, '', '', '', '',
    value.useSourceText ? '' : value.correctedText ?? '',
    value.useSourceText ? 'yes' : '',
    reference,
    signedNote(value.note, draft.reviewer),
  ]);
  return csv(['id', 'name', 'classYear', 'provenance', 'currentText', 'correctedText', 'useSourceText', 'decisionReference', 'note'], rows);
}

/**
 * The version is the one the reviewer saw. profiles:apply refuses an approval
 * whose profile has changed since, so nobody approves words they did not read.
 */
export function profilesCsv(draft, day) {
  const reference = decisionReference('profiles', day);
  const rows = Object.entries(draft.profiles ?? {}).map(([id, value]) => [
    id, value.seenVersion ?? '', value.decision, reference, signedNote(value.note, draft.reviewer),
  ]);
  return csv(['id', 'contentVersion', 'decision', 'decisionReference', 'note'], rows);
}

/**
 * Profile edits: the whole of each edited profile's editable parts, lists
 * separated by semicolons, and the version the editing began from, which
 * profiles:edit checks.
 */
export function profileEditsCsv(draft, day) {
  const reference = decisionReference('profileEdits', day);
  const rows = Object.entries(draft.profileEdits ?? {}).map(([id, { seenVersion, edit, note }]) => [
    id, seenVersion ?? '', edit.name, edit.sortName, edit.communities.join(';'), edit.contributions.join(';'), edit.countries.join(';'),
    edit.honoredFor, edit.contextLine, edit.portraitAlt, edit.focalPoint, reference, signedNote(note, draft.reviewer),
  ]);
  return csv(['id', 'contentVersion', 'name', 'sortName', 'communities', 'contributions', 'countries', 'honoredFor', 'contextLine', 'portraitAlt', 'focalPoint', 'decisionReference', 'note'], rows);
}

/**
 * The attract screen's words: approved as the reviewer saw them (the version
 * they saw, which text:apply checks), or rewritten and approved as written.
 */
export function attractCsv(draft, day) {
  const reference = decisionReference('attract', day);
  const rows = Object.entries(draft.attract ?? {}).map(([block, value]) => [
    block,
    value.decision,
    value.decision === 'approve' ? value.seenVersion ?? '' : '',
    value.decision === 'reword' ? value.headline ?? '' : '',
    value.decision === 'reword' ? value.tagline ?? '' : '',
    reference,
    signedNote(value.note, draft.reviewer),
  ]);
  return csv(['block', 'decision', 'contentVersion', 'headline', 'tagline', 'decisionReference', 'note'], rows);
}

/**
 * The curated tours: each approved as the reviewer saw it (the version they
 * saw, which tours:apply checks) for the audience they chose, or withdrawn
 * from the displays. An approval with no audience chosen names none, and
 * tours:apply refuses it rather than assume one.
 */
/**
 * What each film is called: approved as written (the reviewer's words, or the
 * YouTube title they kept), or cleared. films:titles:apply checks each.
 */
export function filmTitlesCsv(draft, day) {
  const reference = decisionReference('filmTitles', day);
  const rows = Object.entries(draft.filmTitles ?? {}).map(([filmId, value]) => [
    filmId,
    value.decision,
    value.decision === 'approve' ? String(value.title ?? '').trim() : '',
    reference,
    signedNote(value.note, draft.reviewer),
  ]);
  return csv(['filmId', 'decision', 'title', 'decisionReference', 'note'], rows);
}

const tourTargets = { kiosk: 'kiosk', 'kiosk-and-web': 'kiosk,public-web' };

/**
 * An edit carries the whole tour as edited, its lists separated by
 * semicolons, and the version the editing began from. Its audience approves
 * it as edited; `nobody` is written as the target `none`, a draft for
 * somebody else. An edit nobody chose for is written with no targets, which
 * tours:apply refuses, so it can never take a tour off the displays unasked.
 */
export function toursCsv(draft, day) {
  const reference = decisionReference('tours', day);
  const edits = ['label', 'prompt', 'description', 'terms', 'themes', 'pinnedPersonIds', 'excludedPersonIds', 'maxPortraits'];
  const rows = Object.entries(draft.tours ?? {}).map(([tourId, value]) => {
    const changes = value.decision === 'edit' || value.decision === 'create' ? value.changes ?? {} : null;
    return [
      tourId,
      value.decision,
      value.decision === 'withdraw' || value.decision === 'create' ? '' : value.seenVersion ?? '',
      value.decision === 'withdraw' ? '' : changes && value.audience === 'nobody' ? 'none' : tourTargets[value.audience] ?? '',
      reference,
      signedNote(value.note, draft.reviewer),
      ...edits.map((field) => {
        if (!changes) return '';
        const cell = changes[field];
        return Array.isArray(cell) ? cell.join(';') : String(cell ?? '');
      }),
    ];
  });
  return csv(['tourId', 'decision', 'contentVersion', 'targets', 'decisionReference', 'note', ...edits], rows);
}

/**
 * Where ceremony films open: a second in the film, or from the beginning.
 * films:starts:apply checks each second falls inside the film.
 */
export function filmStartsCsv(draft, day) {
  const reference = decisionReference('filmStarts', day);
  const rows = Object.entries(draft.filmStarts ?? {}).map(([key, value]) => {
    const [personId, filmId] = splitTieKey(key);
    return [
      personId,
      filmId,
      value.decision,
      value.decision === 'start' ? String(value.seconds ?? '') : '',
      reference,
      signedNote(value.note, draft.reviewer),
    ];
  });
  return csv(['personId', 'filmId', 'decision', 'startSeconds', 'decisionReference', 'note'], rows);
}

/**
 * Sign-offs accepted in the app. Each is signed by the person who pressed
 * Accept, under their own name, on the day they did; the reference is the
 * app's own decision reference. A clearing says who cleared it.
 */
export function signoffsCsv(draft, day) {
  const reference = decisionReference('signoffs', day);
  const rows = Object.entries(draft.signoffs ?? {}).filter(([, value]) => ['accept', 'clear'].includes(value?.action)).map(([id, value]) => {
    const note = String(value.note ?? '').trim();
    if (value.action === 'clear') {
      const cleared = `Cleared by ${String(draft.reviewer ?? '').trim()} in the staff review app (${reference}).`;
      return [id, 'clear', '', '', '', '', `${/[.!?)"'”’]$/.test(note) ? note : `${note}.`} ${cleared}`];
    }
    return [id, 'sign', value.by ?? '', value.date ?? '', `Accepted in the staff review app (${reference})`, '', note];
  });
  return csv(['id', 'action', 'by', 'date', 'reference', 'scan', 'note'], rows);
}

/** Corrections to a film's captions and transcript. */
export function filmFixesCsv(draft, day) {
  const reference = decisionReference('filmFixes', day);
  const rows = Object.values(draft.filmFixes ?? {}).map((value) => [
    value.filmId,
    value.fix,
    value.fix === 'phrase' ? value.find ?? '' : '',
    value.fix === 'blank' ? '' : value.replaceWith ?? '',
    reference,
    signedNote(value.note, draft.reviewer),
  ]);
  return csv(['filmId', 'fix', 'find', 'replaceWith', 'decisionReference', 'note'], rows);
}

export function splitTieKey(key) {
  const at = key.lastIndexOf('|');
  return [key.slice(0, at), key.slice(at + 1)];
}

/** How many decisions a draft holds for each review. */
export function draftCounts(draft) {
  return {
    ties: Object.keys(draft.ties ?? {}).length,
    places: Object.values(draft.places ?? {}).filter((value) => value.approve === true).length,
    placeTies: Object.keys(draft.placeTies ?? {}).length,
    bios: Object.keys(draft.bios ?? {}).length,
    profiles: Object.keys(draft.profiles ?? {}).length,
    profileEdits: Object.keys(draft.profileEdits ?? {}).length,
    attract: Object.keys(draft.attract ?? {}).length,
    tours: Object.keys(draft.tours ?? {}).length,
    filmTitles: Object.keys(draft.filmTitles ?? {}).length,
    filmStarts: Object.keys(draft.filmStarts ?? {}).length,
    signoffs: Object.keys(draft.signoffs ?? {}).length,
    filmFixes: Object.keys(draft.filmFixes ?? {}).length,
  };
}

function csv(header, rows) {
  return `${[header, ...rows].map((cells) => cells.map(cell).join(',')).join('\n')}\n`;
}

function cell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
