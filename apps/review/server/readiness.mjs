import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What still stands between the exhibit and opening day, read from the
 * project's own records: the review states the staff review app works from,
 * and the sign-offs people give outside it (data/cihof_opening_signoffs.json).
 *
 * It only reads. Nothing here approves, signs or counts anything as done that
 * the records do not already say is done.
 */

/** A sign-off counts only with who signed it, when, and what it rests on. */
export function isSigned(signed) {
  return Boolean(signed && ['by', 'date', 'reference'].every((field) => typeof signed[field] === 'string' && signed[field].trim()));
}

export function readSignoffs(root) {
  const path = join(root, 'data', 'cihof_opening_signoffs.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')).items ?? [];
}

/**
 * One line per thing to do: how much is done, and where it is done. `review`
 * is what loadReview() returns.
 */
export function readiness(review, signoffs) {
  const lines = [];
  const add = (group, title, done, total, where) => lines.push({ group, title, done, total, open: total - done, where });

  add('Staff review app', 'Profiles approved in the words and portrait visitors see',
    review.profiles.filter((profile) => profile.state === 'approved').length, review.profiles.length, 'Profiles');
  add('Staff review app', 'Connections decided',
    review.ties.filter((tie) => tie.status !== 'unreviewed' && !tie.wordingProblem).length, review.ties.length, 'Connections');

  const wordsToCheck = review.places.filter((place) => place.words === 'legacy' || place.words === 'changed');
  const shown = review.places.filter((place) => place.reviewed);
  add('Staff review app', 'Places on the display with their words approved',
    shown.length - wordsToCheck.length, shown.length, 'Places');
  const researched = review.places.filter((place) => place.canApprove);
  add('Staff review app', 'Researched places decided',
    researched.filter((place) => place.reviewed).length, researched.length, 'Places');
  const ties = review.places.flatMap((place) => place.ties);
  add('Staff review app', 'People at places with what they did there',
    ties.filter((tie) => tie.role).length, ties.length, 'Places');

  add('Staff review app', 'Attract screen words approved', review.attract.approved ? 1 : 0, 1, 'Attract screen words');
  if (review.filmStarts.length > 0) {
    add('Staff review app', 'Ceremony films opening at each person\'s part',
      review.filmStarts.filter((entry) => entry.approvedSeconds !== null).length, review.filmStarts.length, 'Where ceremony films start');
  }

  for (const item of signoffs) {
    add('Signed by people', `${item.title} (${item.who})`, isSigned(item.signed) ? 1 : 0, 1, item.where);
  }
  return lines;
}
