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
 *   }
 */

/** The decision reference for one kind of review on one day. */
export function decisionReference(task, day) {
  const subject = { ties: 'connections', places: 'places', placeTies: 'place-roles', bios: 'biographies', profiles: 'profiles', attract: 'attract-words' }[task];
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
    attract: Object.keys(draft.attract ?? {}).length,
  };
}

function csv(header, rows) {
  return `${[header, ...rows].map((cells) => cells.map(cell).join(',')).join('\n')}\n`;
}

function cell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
