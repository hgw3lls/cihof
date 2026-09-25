import { writeFileSync } from 'node:fs';
import { buildPeople } from '../src/build/people.ts';
import { clock, readCaptionCues, sharedFilms, suggestStarts } from '../src/build/film-starts.ts';
import { readVideoHoldings } from '../src/sources/media.ts';
import { dataFile } from '../src/paths.ts';

/**
 * Drafts a start time for each person whose film is shared with others (a
 * whole induction ceremony), from the film's approved captions:
 *
 *   data/review-sheets/film-start-drafts.json
 *
 * The staff review app shows each draft with what the captions say there and
 * a link to watch from that second. Nothing here reaches the display: a start
 * is used only once a reviewer approves it (npm run films:starts:apply).
 */
const names = new Map(buildPeople().map((person) => [person.id, person.name]));
const drafts = {};
for (const film of sharedFilms(readVideoHoldings())) {
  const cues = readCaptionCues(film.captionFile);
  const suggestions = suggestStarts(cues, film.people.map((id) => ({ id, name: names.get(id) ?? id })), film.durationSeconds);
  for (const personId of film.people) {
    const suggestion = suggestions.get(personId);
    drafts[`${personId}|${film.filmId}`] = suggestion
      ? { suggestedSeconds: suggestion.seconds, reason: suggestion.reason, context: suggestion.context }
      : { suggestedSeconds: null, reason: 'The captions give no clear place for this person; watch the film to find it.', context: [] };
  }
  console.log(`${film.filmId}: ${film.people.length} people, ${suggestions.size} suggested`);
  for (const personId of film.people) {
    const suggestion = suggestions.get(personId);
    console.log(`  ${names.get(personId) ?? personId}: ${suggestion ? clock(suggestion.seconds) : 'none'}`);
  }
}

writeFileSync(dataFile('review-sheets/film-start-drafts.json'), `${JSON.stringify({
  schemaVersion: 1,
  note: 'Suggested start times for people whose film is a shared ceremony, drafted from the approved captions by npm run review:film-starts. A suggestion is shown to a reviewer and reaches the display only once approved. Nothing reads this file into the exhibit.',
  drafts,
}, null, 2)}\n`);
