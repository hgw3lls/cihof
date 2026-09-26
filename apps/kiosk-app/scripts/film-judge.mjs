/**
 * Whether a film played as a visitor needs it to, from what the film check
 * saw in the kiosk app. Each problem is a sentence a person can act on.
 *
 * @param {{ durationSeconds?: number | null, startSeconds?: number | null }} expected  the film as the exhibit publishes it
 * @param {{
 *   shown: string | null,          what the display says instead of playing, if it does
 *   missing: string[],             files the page asked for and could not have
 *   width: number,                 the picture's size, 0 if there is none
 *   duration: number | null,       seconds, as the video reports it
 *   openedAt: number | null,       where it opened, before it was played
 *   played: number,                seconds it moved on while played
 *   audioBytes: number | null,     sound decoded while played; null if the browser does not say
 *   captionsShowing: boolean,
 *   cues: number,
 *   lastCueEnd: number | null,
 *   transcriptChars: number,
 *   transcriptProblem: string | null,
 * }} seen
 * @returns {string[]}
 */
export function judgeFilm(expected, seen) {
  const problems = [];
  if (seen.shown) problems.push(`The display shows "${seen.shown}" instead of the film.`);
  for (const path of seen.missing) problems.push(`Missing file: ${path}.`);
  if (seen.shown) return [...problems, ...transcript(seen)];

  if (!seen.width) problems.push('There is no picture.');
  if (seen.played < 1) problems.push(`It did not play (it moved ${seen.played.toFixed(1)} s).`);
  if (seen.audioBytes === 0) problems.push('No sound was heard while it played.');

  const length = expected.durationSeconds ?? null;
  if (seen.duration === null || !Number.isFinite(seen.duration)) {
    problems.push('The video does not say how long it is.');
  } else if (length && Math.abs(seen.duration - length) > Math.max(2, length * 0.02)) {
    problems.push(`It is ${clock(seen.duration)} long; the exhibit expects ${clock(length)}.`);
  }

  const start = expected.startSeconds ?? 0;
  if (start > 0 && (seen.openedAt === null || Math.abs(seen.openedAt - start) > 2)) {
    problems.push(`It opened at ${seen.openedAt === null ? 'no time' : clock(seen.openedAt)}, not at ${clock(start)}, where this person's part begins.`);
  }

  if (!seen.captionsShowing) problems.push('Its captions are not shown.');
  if (seen.cues === 0) {
    problems.push('Its captions have no lines.');
  } else if (seen.lastCueEnd !== null && seen.duration !== null && Number.isFinite(seen.duration) && seen.lastCueEnd > seen.duration + 5) {
    problems.push(`Its captions run to ${clock(seen.lastCueEnd)}, past the end of the film at ${clock(seen.duration)}: they may belong to another film.`);
  }
  return [...problems, ...transcript(seen)];
}

function transcript(seen) {
  if (seen.transcriptProblem) return [`Its transcript: "${seen.transcriptProblem}"`];
  if (seen.transcriptChars < 20) return ['Its transcript is empty.'];
  return [];
}

/** 1:02:36, or 4:05 under an hour. */
export function clock(seconds) {
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}
