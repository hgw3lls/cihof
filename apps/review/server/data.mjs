import { existsSync, readFileSync } from 'node:fs';
import { buildBiographySheet } from '../../../packages/pipeline/src/build/biographies.ts';
import { buildPeople } from '../../../packages/pipeline/src/build/people.ts';
import { profileContentVersion, profileState, readPortraitChecksums, readProfileReviews } from '../../../packages/pipeline/src/build/profiles.ts';
import { normalizeCommunityTags } from '../../../packages/pipeline/src/text/biography.ts';
import { applyProfileEdits, composedLines, profileEditLimits, profileEditOf, profileEditProblems } from '../../../packages/pipeline/src/build/profile-edits.ts';
import { buildPlaceReviewSheet, buildProposedTiesSheet, placeRoles, relationshipKinds } from '../../../packages/pipeline/src/build/review.ts';
import { readCorpusConnections } from '../../../packages/pipeline/src/sources/corpus.ts';
import { readTieDecisions } from '../../../packages/pipeline/src/sources/ties.ts';
import { connectionLabelProblem, maxConnectionLabelLength } from '@cihof/content';
import { dataFile } from '../../../packages/pipeline/src/paths.ts';
import { attractLimits, publishedAttractText, readExhibitText } from '../../../packages/pipeline/src/build/exhibit-text.ts';
import { placeHistoryLimit } from '../../../packages/pipeline/src/build/place-text.ts';
import { buildRuntimeBundle } from '../../../packages/pipeline/src/build/emit.ts';
import { approvedFilmTitle, filmTitleLimit, readFilmTitles } from '../../../packages/pipeline/src/build/film-titles.ts';
import { blankTourChanges, choosesNobody, editedLens, readTours, tourApproved, tourChangesOf, tourChangesProblems, tourLimits, tourPeople, tourTargets, tourVersion } from '../../../packages/pipeline/src/build/tours.ts';
import { approvedFilmStart, readFilmStarts, sharedFilms } from '../../../packages/pipeline/src/build/film-starts.ts';
import { filmFiles, findNoise } from '../../../packages/pipeline/src/build/caption-fixes.ts';
import { readVideoHoldings } from '../../../packages/pipeline/src/sources/media.ts';
import { filmIdOf } from '../../../packages/pipeline/src/build/media-changes.ts';
import { filmShortfalls } from '@cihof/content';

/**
 * Everything the review screens show, read fresh from `data/` each time, so a
 * save, or a sheet applied by hand, is reflected on the next page load.
 */

/**
 * Plain-language names for each relationship kind, whether it has a direction,
 * and a hint for the wording. The hints are shown greyed out as examples of
 * the shape; the reviewer types what the record actually says.
 */
export const kindGuide = {
  // No direction: the same words show on both people's side, so they name
  // neither of them.
  'collaborated-with': { label: 'Worked together', directional: false, example: 'worked together to promote Juneteenth' },
  'founded-with': { label: 'Founded something together', directional: false, example: 'founded Community Helping Hands together' },
  'family-of': { label: 'Family', directional: false, example: 'married  /  siblings' },
  'friend-of': { label: 'Friends', directional: false, example: 'longtime friends' },
  mentored: { sentence: '{A} mentored {B}', label: 'Mentored', directional: true, example: 'mentored {B}', inverse: 'was mentored by {A}' },
  taught: { sentence: '{A} taught {B}', label: 'Taught', directional: true, example: 'taught {B} at …', inverse: 'was taught by {A} at …' },
  succeeded: { sentence: '{A} took over a role from {B}', label: 'Followed in a role', directional: true, example: 'succeeded {B} as …', inverse: 'was succeeded by {A} as …' },
  employed: { sentence: '{A} employed {B}', label: 'Employed', directional: true, example: 'employed {B} at …', inverse: 'worked for {A} at …' },
  nominated: { sentence: '{A} nominated {B}', label: 'Nominated', directional: true, example: 'nominated {B} for …', inverse: 'was nominated by {A} for …' },
};

export const roleGuide = {
  lived: 'Lived there',
  worked: 'Worked there',
  studied: 'Studied there',
  taught: 'Taught there',
  organized: 'Organized something there',
  served: 'Served there (volunteer, board, congregation)',
  founded: 'Founded it',
};

export const harvestedKindGuide = {
  born_in: 'born here',
  lived_in: 'lived here',
  moved_to: 'moved here',
  associated_with_place: 'connected here, without saying how',
};

export function loadReview() {
  const people = buildPeople();
  const byId = new Map(people.map((person) => [person.id, person]));
  const summary = (id) => {
    const person = byId.get(id);
    if (!person) return { id, name: id, classYear: null, portrait: null, biography: '' };
    return {
      id,
      name: person.name,
      classYear: person.classYear,
      portrait: person.portrait?.src ?? null,
      biography: (person.biography?.text ?? '').slice(0, 600),
    };
  };

  const decisions = readTieDecisions();
  const decisionByTie = new Map(decisions.map((decision) => [decision.tieId, decision]));
  const draftsPath = dataFile('review-sheets/connection-drafts.json');
  const drafts = existsSync(draftsPath) ? JSON.parse(readFileSync(draftsPath, 'utf8')).drafts ?? {} : {};
  const ties = buildProposedTiesSheet(readCorpusConnections(), people, decisions).map((row) => {
    const current = decisionByTie.get(row.tieId);
    const wordingProblem = current
      ? [current.label, current.inverseLabel].map(connectionLabelProblem).find(Boolean) ?? null
      : null;
    return {
    tieId: row.tieId,
    a: summary(row.personA),
    b: summary(row.personB),
    sourceType: row.sourceType,
    suggestedKind: relationshipKinds.includes(row.suggestedKind) ? row.suggestedKind : '',
    verificationLayer: row.verificationLayer,
    evidence: row.evidence,
    sourceUrls: row.sourceUrls,
    status: row.currentStatus,
    // What is on file now, so a reviewer revisiting a tie sees what they are replacing.
    current: current
      ? { decision: current.decision, kind: current.kind ?? '', label: current.label ?? '', inverseLabel: current.inverseLabel ?? '', reversed: Boolean(current.reversed) }
      : null,
    // A decision whose wording cannot go on the map comes back to be looked at.
    wordingProblem,
    suggestion: drafts[row.tieId] ?? null,
    };
  });

  const placesDocument = JSON.parse(readFileSync(dataFile('cihof_places.json'), 'utf8'));
  const associationsPath = dataFile('cihof_place_associations.json');
  const associations = existsSync(associationsPath)
    ? JSON.parse(readFileSync(associationsPath, 'utf8')).associations ?? []
    : [];
  const seeds = new Map((placesDocument.places ?? []).map((place) => [place.id, place]));
  // Suggested rewordings, each drafted from particular words. One whose words
  // have since changed is not offered: it was a rewording of something else.
  const placeDraftsPath = dataFile('review-sheets/place-drafts.json');
  const placeDrafts = existsSync(placeDraftsPath) ? JSON.parse(readFileSync(placeDraftsPath, 'utf8')).drafts ?? {} : {};
  const places = buildPlaceReviewSheet(placesDocument.places ?? [], associations, people).rows.map((row) => {
    const seed = seeds.get(row.placeId) ?? {};
    return {
      placeId: row.placeId,
      name: row.name,
      neighborhood: row.neighborhood,
      address: typeof seed.address === 'string' ? seed.address : '',
      dates: typeof seed.dateRange?.label === 'string' ? seed.dateRange.label : '',
      shortHistory: row.shortHistory,
      canApprove: row.band === 'researched',
      reviewed: row.reviewed,
      // What an approval of the words shown records, and whether the approval
      // on file covers them (see packages/pipeline/src/build/place-text.ts).
      contentVersion: row.contentVersion,
      words: row.words,
      suggestion: placeDrafts[row.placeId]?.from === row.contentVersion ? placeDrafts[row.placeId].text : null,
      // A role is decided once per person and place. The research sometimes
      // records the same person there twice (born here, and moved here), so
      // those are one row carrying both notes.
      ties: [...Map.groupBy(row.ties, (tie) => tie.person).values()].map((ties) => ({
        person: summary(ties[0].person),
        harvested: [...new Set(ties.map((tie) => harvestedKindGuide[tie.kind] ?? tie.kind))].join('; '),
        role: ties.find((tie) => tie.role)?.role ?? null,
      })),
    };
  });

  const bios = buildBiographySheet(people).map((row) => ({
    id: row.id,
    name: row.name,
    classYear: row.classYear,
    portrait: byId.get(row.id)?.portrait?.src ?? null,
    provenance: row.provenance,
    text: row.currentText,
  }));

  // Each profile as a visitor sees it, with what a curator has said about it.
  const reviews = readProfileReviews();
  const checksums = readPortraitChecksums();
  const curatedDocument = readCuratedDocument();
  const profiles = [...people]
    .sort((a, b) => (a.classYear ?? 0) - (b.classYear ?? 0) || a.sortName.localeCompare(b.sortName))
    .map((person) => ({
      ...profileSummary(person, checksums, reviews),
      // Everything the profile editor starts from.
      edit: profileEditOf(curatedDocument.inductees[person.id] ?? {}, person),
    }));

  return {
    ties,
    places,
    bios,
    profiles,
    kinds: relationshipKinds.map((kind) => ({ kind, ...kindGuide[kind] })),
    attract: attractWords(),
    // The communities, honours and countries already in use, offered as the profile editor's suggestions.
    profileTags: profileTagsInUse(curatedDocument),
    tours: tours(people),
    // Everyone a tour may visit, for the tour editor to add.
    tourPeople: tourPool().published.map(tourPerson),
    // Where a new tour starts, and every name a tour already has, enabled or not.
    blankTour: blankTourChanges,
    tourIds: (readTours().lenses ?? []).map((lens) => lens.id).filter((id) => typeof id === 'string'),
    filmTitles: filmTitles(byId),
    filmStarts: filmStarts(byId),
    films: filmsForCaptions(byId),
    // Each person's portrait and films, for Portraits and films.
    media: mediaReview(people, checksums, reviews),
    limits: { label: maxConnectionLabelLength, headline: attractLimits.headline, tagline: attractLimits.tagline, placeHistory: placeHistoryLimit, filmTitle: filmTitleLimit, tour: tourLimits, profile: profileEditLimits },
    roles: placeRoles.map((role) => ({ role, label: roleGuide[role] ?? role })),
  };
}

/**
 * Each person's portrait and every film recorded for them, shown or not, as
 * Portraits and films lists them: what a new picture would replace, and which
 * films can be taken off the display.
 */
function mediaReview(people, checksums, reviews) {
  const manifest = JSON.parse(readFileSync(dataFile('media_manifest.json'), 'utf8'));
  const titles = readFilmTitles();
  return [...people]
    .sort((a, b) => (a.classYear ?? 0) - (b.classYear ?? 0) || a.sortName.localeCompare(b.sortName))
    .map((person) => {
      const summary = profileSummary(person, checksums, reviews);
      const videos = Array.isArray(manifest.assets?.[person.id]?.videos) ? manifest.assets[person.id].videos : [];
      return {
        id: person.id,
        name: person.name,
        sortName: person.sortName,
        classYear: person.classYear,
        contentVersion: summary.contentVersion,
        portrait: summary.portrait,
        films: videos.map((video) => {
          const filmId = filmIdOf(video);
          return {
            filmId,
            title: filmId ? approvedFilmTitle(titles, filmId, 'kiosk') : null,
            poster: typeof video.posterRuntimePath === 'string' ? video.posterRuntimePath : null,
            durationSeconds: typeof video.durationSeconds === 'number' ? video.durationSeconds : null,
            shown: filmShortfalls(video, 'kiosk').length === 0,
            addedHere: !video.youtubeVideoId,
          };
        }).filter((film) => film.filmId),
      };
    });
}

/** A profile as the Profiles card shows it: what a visitor sees, its version, and where its review stands. */
function profileSummary(person, checksums, reviews) {
  const contentVersion = profileContentVersion(person, checksums.get(person.id) ?? '');
  const review = reviews.get(person.id);
  return {
    id: person.id,
    name: person.name,
    sortName: person.sortName,
    classYear: person.classYear,
    portrait: person.portrait
      ? { src: person.portrait.src, alt: person.portrait.alt, shown: person.portrait.rights === 'approved', rights: person.portrait.rights, focalPoint: person.portrait.focalPoint ?? 'center' }
      : null,
    biography: person.biography ? { text: person.biography.text, provenance: person.biography.provenance } : null,
    contribution: person.contribution ? { text: person.contribution.text, provenance: person.contribution.provenance } : null,
    context: person.context ? { text: person.context.text, provenance: person.context.provenance } : null,
    tags: {
      contributions: person.contributions.values,
      communities: person.communities.values,
      countries: person.countries.values,
    },
    presentedBy: person.presentedBy?.recordedName ?? null,
    sourceUrl: person.sourceUrl,
    contentVersion,
    state: profileState(review, contentVersion),
    reviewNote: review?.note ?? '',
  };
}

function readCuratedDocument() {
  return JSON.parse(readFileSync(dataFile('cihof_curated_metadata.json'), 'utf8'));
}

/**
 * The tags already in use, as suggestions. Communities as visitors see them:
 * the community list renames some and leaves others out, and a suggestion
 * that never appears would only mislead.
 */
function profileTagsInUse(document) {
  const records = Object.values(document.inductees ?? {});
  const tags = (record, field) => (Array.isArray(record[field]) ? record[field].filter((tag) => typeof tag === 'string') : []);
  const inUse = (field, shown = (values) => values) => [...new Set(records.flatMap((record) => shown(tags(record, field))))].sort((a, b) => a.localeCompare(b));
  return {
    communities: inUse('approvedCommunityTags', normalizeCommunityTags),
    contributions: inUse('approvedThemeTags'),
    countries: inUse('approvedCountryTags'),
  };
}

/**
 * A profile as an edit would leave it, built as a release would build it:
 * what a visitor would see, the generator's wording of both lines for the
 * edited tags, anything wrong with the edit, and the version it would have.
 * Nothing is written. Null for somebody who is not in the collection.
 */
export function previewProfile(id, edit) {
  const document = readCuratedDocument();
  const person = buildPeople().find((each) => each.id === id);
  if (!person || !document.inductees[id]) return null;
  const composed = composedLines(id, edit);
  const decision = { id, name: person.name, edit, composed, decisionReference: 'profile-edits-preview', note: '' };
  const edited = buildPeople({ curated: applyProfileEdits(document, [decision], new Date().toISOString()) }).find((each) => each.id === id) ?? person;
  return {
    profile: profileSummary(edited, readPortraitChecksums(), readProfileReviews()),
    composed,
    problems: profileEditProblems(edit, profileEditOf(document.inductees[id], person)),
    changed: JSON.stringify(edit) !== JSON.stringify(profileEditOf(document.inductees[id], person)),
  };
}

/** The attract screen's words as they stand, and whether the display may show them. */
function attractWords() {
  const stored = readExhibitText().attract ?? {};
  const status = publishedAttractText('kiosk');
  return {
    headline: typeof stored.headline === 'string' ? stored.headline : '',
    tagline: typeof stored.tagline === 'string' ? stored.tagline : '',
    contentVersion: status.contentVersion ?? '',
    approved: status.problem === null && status.text !== null,
    problem: status.problem,
    reviewedAt: stored.review?.reviewedAt ?? null,
  };
}

/**
 * The curated tours: their words, whether each is approved and still the tour
 * that was, and who it visits now, chosen as a release would choose them, from
 * the profiles the display publishes.
 */
function tours(people) {
  const { published, byId } = tourPool(people);
  const text = (value) => (typeof value === 'string' ? value : '');
  const list = (value) => (Array.isArray(value) ? value.filter((each) => typeof each === 'string') : []);
  return (readTours().lenses ?? []).filter((lens) => typeof lens.id === 'string' && lens.enabled !== false).map((lens) => {
    const approved = tourApproved(lens);
    return {
      tourId: lens.id,
      label: text(lens.label),
      prompt: text(lens.prompt),
      description: text(lens.description),
      terms: list(lens.terms),
      themes: list(lens.themes),
      pinned: list(lens.pinnedPersonIds).map((id) => byId.get(id)?.name ?? id),
      excluded: list(lens.excludedPersonIds).map((id) => byId.get(id)?.name ?? id),
      // Everything the tour editor starts from.
      changes: tourChangesOf(lens),
      contentVersion: tourVersion(lens),
      state: approved ? 'approved' : lens.reviewStatus === 'approved' ? 'changed-since-approval' : 'draft',
      // Where the approval lets it be shown, the display and the website apart.
      shownOn: approved ? tourTargets(lens) : { kiosk: false, publicWeb: false },
      reviewedAt: typeof lens.review?.reviewedAt === 'string' ? lens.review.reviewedAt : null,
      people: tourPeople(published, lens).map((id) => tourPerson(byId.get(id) ?? { id })),
    };
  });
}

/**
 * The people a tour chooses from: the profiles the display publishes. Kept
 * from the last full read, so the editor's preview answers quickly; every
 * page load reads them afresh.
 */
let pool = null;
function tourPool(people) {
  if (people || !pool) {
    const published = buildRuntimeBundle(people ?? buildPeople(), 'kiosk').people;
    pool = { published, byId: new Map(published.map((person) => [person.id, person])) };
  }
  return pool;
}

function tourPerson(person) {
  return { id: person.id, name: person.name ?? person.id, classYear: person.classYear ?? null, portrait: person.portrait?.src ?? null };
}

/**
 * A tour as an edit would leave it: who it would visit, in order, the version
 * an approval of it would name, and anything wrong with the edit. Nothing is
 * written. Null for a tour that does not exist, unless it is a new one, which
 * starts from nothing.
 */
export function previewTour(tourId, changes, { creating = false } = {}) {
  const found = (readTours().lenses ?? []).find((each) => each.id === tourId);
  if (creating ? found : !found) return null;
  const lens = found ?? { id: tourId };
  const { published, byId } = tourPool();
  const edited = editedLens(lens, changes);
  return {
    contentVersion: tourVersion(edited),
    changed: tourVersion(edited) !== tourVersion(lens),
    problems: [
      ...tourChangesProblems(changes, new Set(published.map((person) => person.id))),
      // As tours:apply refuses it, so the editor says so before it is kept.
      ...(creating && choosesNobody(changes) ? ['Put somebody in it, or give it words or honours to choose people by.'] : []),
    ],
    people: tourPeople(published, edited).map((id) => tourPerson(byId.get(id) ?? { id })),
  };
}

/**
 * Every film once, with whose it is, what it is called on the display now, and
 * the title it has on YouTube: collected, unreviewed, and offered only as a
 * suggestion (npm run source:film-titles).
 */
function filmTitles(byId) {
  const researchPath = dataFile('external-research/youtube-film-titles.json');
  const research = existsSync(researchPath) ? JSON.parse(readFileSync(researchPath, 'utf8')).films ?? {} : {};
  const stored = readFilmTitles();
  const films = new Map();
  for (const [personId, videos] of readVideoHoldings()) {
    for (const video of videos) {
      const filmId = typeof video?.youtubeVideoId === 'string' ? video.youtubeVideoId : '';
      if (!filmId) continue;
      const entry = films.get(filmId) ?? {
        filmId,
        people: [],
        poster: typeof video.posterRuntimePath === 'string' ? video.posterRuntimePath : null,
        durationSeconds: typeof video.durationSeconds === 'number' ? video.durationSeconds : null,
        approvedTitle: approvedFilmTitle(stored, filmId, 'kiosk'),
        suggestion: research[filmId]?.title ? { title: research[filmId].title, uploader: research[filmId].uploader ?? '', url: research[filmId].url ?? '' } : null,
      };
      entry.people.push(byId.get(personId)?.name ?? personId);
      films.set(filmId, entry);
    }
  }
  return [...films.values()].sort((a, b) => a.people[0].localeCompare(b.people[0]) || (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0));
}

/**
 * Everybody whose film is a ceremony shared with others: where it opens now,
 * and where the captions suggest their part begins.
 */
function filmStarts(byId) {
  const draftsPath = dataFile('review-sheets/film-start-drafts.json');
  const drafts = existsSync(draftsPath) ? JSON.parse(readFileSync(draftsPath, 'utf8')).drafts ?? {} : {};
  const stored = readFilmStarts();
  return sharedFilms(readVideoHoldings()).flatMap((film) => film.people.map((personId) => {
    const key = `${personId}|${film.filmId}`;
    const draft = drafts[key];
    const person = byId.get(personId);
    return {
      key,
      personId,
      name: person?.name ?? personId,
      portrait: person?.portrait?.src ?? null,
      filmId: film.filmId,
      durationSeconds: film.durationSeconds,
      sharedWith: film.people.length,
      approvedSeconds: approvedFilmStart(stored, personId, film.filmId, film.durationSeconds),
      suggestion: draft && typeof draft.suggestedSeconds === 'number'
        ? { seconds: draft.suggestedSeconds, reason: draft.reason ?? '', context: draft.context ?? [] }
        : null,
    };
  }));
}

/**
 * Every film, with whose it is and the noise found in its transcript and
 * captions: music heard as "heat", and the transcriber's blank-audio mark.
 */
function filmsForCaptions(byId) {
  return [...filmFiles(readVideoHoldings()).values()].map((film) => {
    const noise = findNoise(film);
    return {
      filmId: film.filmId,
      people: film.people.map((id) => byId.get(id)?.name ?? id),
      copies: film.transcripts.length,
      music: noise.music,
      blank: noise.blank,
    };
  }).sort((a, b) => a.people[0].localeCompare(b.people[0]));
}
