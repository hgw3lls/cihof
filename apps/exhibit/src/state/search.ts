/**
 * Search across everything a visitor can see: people and their stories, the
 * places a curator tied them to, the collection's own groupings, and what is
 * said in the films.
 *
 * Only published content is indexed, and only the parts a visitor would read
 * on the display. Sources and review notes are not searched: a match a visitor
 * cannot then see on screen is a match they cannot understand.
 *
 * Matching is forgiving, because it is typed on a wall by somebody standing
 * up: accents fold ("zmauc" finds Žmauc), a word is found from its start as it
 * is typed, and a small slip is forgiven ("grasseli" finds Grasselli). Every
 * word typed has to be found for a result to count, and results are ranked by
 * where the words were found (a name counts for more than a story) and by
 * whether they were found together.
 *
 * Every result says why it matched, with the words marked in place.
 */
import type { PublishedRelationship, SharedContext } from '@cihof/content';
import type { RuntimePerson, RuntimePlace } from '../data/runtime.ts';
import { connectionNodes, emphasised } from './selectors.ts';

/** A piece of a result's text: `mark` where the words searched for are, `em` where the writer set italics. */
export type SnippetPart = { readonly text: string; readonly mark: boolean; readonly em?: boolean };

export type PersonHit = {
  readonly kind: 'person';
  readonly person: RuntimePerson;
  readonly score: number;
  /** Where the words were found: "Story", "Community", and so on. */
  readonly where: string;
  readonly snippet: readonly SnippetPart[];
};

export type PlaceHit = {
  readonly kind: 'place';
  readonly place: RuntimePlace;
  readonly score: number;
  readonly where: string;
  readonly snippet: readonly SnippetPart[];
};

export type FilmHit = {
  readonly kind: 'film';
  readonly person: RuntimePerson;
  readonly filmId: string;
  /** Seconds into the film where the words are said. */
  readonly at: number;
  readonly score: number;
  readonly snippet: readonly SnippetPart[];
};

/** A grouping the collection itself makes: a community, a contribution, a country, a class. */
export type GroupHit = {
  readonly kind: 'group';
  readonly label: string;
  /** What sort of grouping, for the line above it. */
  readonly sort: 'Community' | 'Honored for' | 'Country' | 'Class';
  readonly people: readonly RuntimePerson[];
  readonly score: number;
};

export type SearchResults = {
  readonly query: string;
  readonly people: readonly PersonHit[];
  readonly groups: readonly GroupHit[];
  readonly places: readonly PlaceHit[];
  readonly films: readonly FilmHit[];
};

export const emptyResults: SearchResults = { query: '', people: [], groups: [], places: [], films: [] };

/** A film's words, with when each is said. */
export type FilmWords = {
  readonly personId: string;
  readonly filmId: string;
  readonly words: readonly { readonly text: string; readonly at: number }[];
};

export const maxQueryLength = 80;

// ------------------------------------------------------------------ text

type Token = { readonly folded: string; readonly start: number; readonly end: number };

export function fold(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const folded = fold(match[0]);
    if (folded) tokens.push({ folded, start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/** Words too common to narrow anything, dropped from a query unless they are all it has. */
const common = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'is', 'was', 'as', 'or', 'his', 'her', 'their', 'who', 'that']);

export function queryTerms(query: string): string[] {
  const all = tokenise(query.slice(0, maxQueryLength)).map((token) => token.folded);
  const kept = all.filter((term) => !common.has(term));
  return [...new Set(kept.length > 0 ? kept : all)];
}

/** Edit distance with transpositions, giving up once it passes `limit`. */
export function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2]! + 1);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * How well a word typed matches a word in the collection, from 0 to 1.
 * Whole word, then the start of a word (it is still being typed), then a
 * slip of a letter or two.
 */
export function closeness(term: string, word: string): number {
  if (word === term) return 1;
  if (word.startsWith(term)) return term.length >= 3 ? 0.8 : 0.6;
  // Years and other numbers are exact: 2014 is not a slip for 2010.
  if (term.length < 4 || /^\d+$/.test(term)) return 0;
  const limit = term.length >= 7 ? 2 : 1;
  const whole = distance(term, word, limit);
  if (whole <= limit) return whole === 1 ? 0.55 : 0.4;
  // A slip early in a word that is still being typed: "grasel" for "grassel…".
  if (word.length > term.length && distance(term, word.slice(0, term.length), 1) <= 1) return 0.45;
  return 0;
}

// ------------------------------------------------------------------ index

type FieldSpec = {
  readonly label: string;
  readonly text: string;
  readonly weight: number;
  /** Running text, shown as the passage that matched. */
  readonly long?: boolean;
  /** Several things joined by " · ", shown as only the ones that matched. */
  readonly list?: boolean;
  readonly name?: boolean;
};

type Field = FieldSpec & {
  readonly tokens: readonly Token[];
  readonly folded: string;
  /** Where the writer set italics, in `text` once its asterisks are gone. */
  readonly italics: readonly (readonly [number, number])[];
};

type Doc =
  | { readonly kind: 'person'; readonly person: RuntimePerson; readonly fields: readonly Field[] }
  | { readonly kind: 'place'; readonly place: RuntimePlace; readonly fields: readonly Field[] }
  | {
    readonly kind: 'film';
    /** Everyone this film belongs to, with where their part begins: a ceremony film is several people's. */
    readonly owners: readonly { readonly person: RuntimePerson; readonly start: number }[];
    readonly filmId: string;
    readonly times: readonly number[];
    readonly fields: readonly Field[];
  }
  | { readonly kind: 'group'; readonly label: string; readonly sort: GroupHit['sort']; readonly people: readonly RuntimePerson[]; readonly fields: readonly Field[] };

type Posting = { readonly doc: number; readonly field: number; readonly count: number };

export type SearchIndex = {
  readonly docs: readonly Doc[];
  /** Every distinct word, with where it appears. */
  readonly words: ReadonlyMap<string, readonly Posting[]>;
};

function field(spec: FieldSpec): Field {
  // Asterisks are the writer's italics, not words: searched and shown without them.
  const italics: [number, number][] = [];
  let text = '';
  for (const span of emphasised(spec.text)) {
    if (span.em) italics.push([text.length, text.length + span.text.length]);
    text += span.text;
  }
  return { ...spec, text, italics, tokens: tokenise(text), folded: fold(text) };
}

export function buildIndex(input: {
  people: readonly RuntimePerson[];
  places: readonly RuntimePlace[];
  relationships: readonly PublishedRelationship[];
  contexts: readonly SharedContext[];
  films?: readonly FilmWords[];
}): SearchIndex {
  const { people, places, relationships, contexts, films = [] } = input;
  const byId = new Map(people.map((person) => [person.id, person]));
  const ties = new Map(connectionNodes(people, relationships, [], contexts).map((node) => [node.person.id, node.ties]));
  const placesOf = (id: string) => places.filter((place) => (place.personIds ?? []).includes(id));
  const docs: Doc[] = [];

  for (const person of people) {
    // A sort name usually holds the same words as the name; it is only worth
    // searching when it holds others.
    const named = new Set(tokenise(person.name).map((token) => token.folded));
    const sortOnly = tokenise(person.sortName).some((token) => !named.has(token.folded));
    const specs: FieldSpec[] = [
      { label: 'Name', text: person.name, weight: 10, name: true },
      { label: 'Name', text: sortOnly ? person.sortName : '', weight: 9, name: true },
      { label: 'Community', text: person.communities.join(' · '), weight: 5, list: true },
      { label: 'Honored for', text: person.contributions.join(' · '), weight: 5, list: true },
      { label: 'Country', text: person.countries.join(' · '), weight: 4, list: true },
      { label: 'Class', text: person.classYear ? `Class of ${person.classYear}` : '', weight: 6 },
      { label: 'Presented by', text: person.presentedBy?.recordedName ?? '', weight: 3 },
      {
        label: 'Connections',
        // The reviewed wording, read outwards from this person; the other
        // person is named after it unless the wording already names them.
        text: (ties.get(person.id) ?? []).map((tie) => (tie.label.includes(tie.other.name) ? tie.label : `${tie.label} — ${tie.other.name}`)).join(' · '),
        weight: 3,
        list: true,
      },
      { label: 'Places', text: placesOf(person.id).map((place) => place.name).join(' · '), weight: 3, list: true },
      { label: 'Story', text: person.biography, weight: 1, long: true },
    ];
    docs.push({ kind: 'person', person, fields: specs.filter((spec) => spec.text).map(field) });
  }

  for (const place of places) {
    const specs: FieldSpec[] = [
      { label: 'Place', text: place.name, weight: 9, name: true },
      { label: 'Neighborhood', text: place.neighborhood ?? '', weight: 4 },
      { label: 'History', text: place.shortHistory ?? '', weight: 1.5, long: true },
    ];
    docs.push({ kind: 'place', place, fields: specs.filter((spec) => spec.text).map(field) });
  }

  const groups = new Map<string, { label: string; sort: GroupHit['sort']; people: RuntimePerson[] }>();
  const group = (sort: GroupHit['sort'], label: string, person: RuntimePerson) => {
    const key = `${sort}:${label}`;
    const held = groups.get(key);
    if (held) held.people.push(person); else groups.set(key, { label, sort, people: [person] });
  };
  for (const person of people) {
    for (const value of person.communities) group('Community', value, person);
    for (const value of person.contributions) group('Honored for', value, person);
    for (const value of person.countries) group('Country', value, person);
    if (person.classYear) group('Class', `Class of ${person.classYear}`, person);
  }
  for (const { label, sort, people: members } of groups.values()) {
    docs.push({ kind: 'group', label, sort, people: members, fields: [field({ label: sort, text: label, weight: 7, name: true })] });
  }

  // One entry per film, however many people share it.
  const owners = new Map<string, { person: RuntimePerson; start: number }[]>();
  for (const person of people) {
    for (const film of person.films) {
      const list = owners.get(film.id) ?? [];
      list.push({ person, start: film.startSeconds ?? 0 });
      owners.set(film.id, list.sort((a, b) => a.start - b.start));
    }
  }
  const read = new Set<string>();
  for (const film of films) {
    const person = byId.get(film.personId);
    if (!person || film.words.length === 0 || read.has(film.filmId)) continue;
    read.add(film.filmId);
    // One text for the whole film, and for each word where it starts, so a
    // match can be turned back into a moment.
    let text = '';
    const starts: number[] = [];
    for (const word of film.words) {
      if (text) text += ' ';
      starts.push(text.length);
      text += word.text;
    }
    const spoken = field({ label: 'Film', text, weight: 1, long: true });
    const times = spoken.tokens.map((token) => {
      let index = starts.length - 1;
      while (index > 0 && starts[index]! > token.start) index -= 1;
      return film.words[index]!.at;
    });
    docs.push({ kind: 'film', owners: owners.get(film.filmId) ?? [{ person, start: 0 }], filmId: film.filmId, times, fields: [spoken] });
  }

  const words = new Map<string, Posting[]>();
  docs.forEach((doc, docIndex) => {
    doc.fields.forEach((each, fieldIndex) => {
      const counts = new Map<string, number>();
      for (const token of each.tokens) counts.set(token.folded, (counts.get(token.folded) ?? 0) + 1);
      for (const [word, count] of counts) {
        const list = words.get(word);
        const posting = { doc: docIndex, field: fieldIndex, count };
        if (list) list.push(posting); else words.set(word, [posting]);
      }
    });
  });

  return { docs, words };
}

// ------------------------------------------------------------------ search

type FieldScore = { score: number; matched: Map<string, number> };

export function search(index: SearchIndex, query: string): SearchResults {
  const terms = queryTerms(query);
  if (terms.length === 0) return emptyResults;
  const phrase = terms.join(' ');

  // For each term, the words in the collection it matches and how well. A
  // word the collection itself uses is taken as meant: "grandmother" is not a
  // slip for "grandfather". Only a word it does not use is forgiven a slip.
  const expansions = terms.map((term) => {
    const found = new Map<string, number>();
    const known = index.words.has(term);
    for (const word of index.words.keys()) {
      const value = closeness(term, word);
      if (value > 0 && (!known || word.startsWith(term))) found.set(word, value);
    }
    return found;
  });

  // doc -> field -> per-term best
  const perDoc = new Map<number, Map<number, FieldScore[]>>();
  expansions.forEach((found, termIndex) => {
    for (const [word, value] of found) {
      for (const posting of index.words.get(word) ?? []) {
        const doc = index.docs[posting.doc]!;
        const where = doc.fields[posting.field]!;
        // A single letter only finds the start of a name: a whole story full
        // of words beginning with "m" says nothing.
        if (terms[termIndex]!.length === 1 && !where.name) continue;
        let fields = perDoc.get(posting.doc);
        if (!fields) { fields = new Map(); perDoc.set(posting.doc, fields); }
        let scores = fields.get(posting.field);
        if (!scores) { scores = terms.map(() => ({ score: 0, matched: new Map() })); fields.set(posting.field, scores); }
        const repeat = where.long ? 1 + 0.15 * Math.min(3, posting.count - 1) : 1;
        const score = value * where.weight * repeat;
        const slot = scores[termIndex]!;
        slot.matched.set(word, Math.max(slot.matched.get(word) ?? 0, value));
        if (score > slot.score) slot.score = score;
      }
    }
  });

  const people: PersonHit[] = [];
  const places: PlaceHit[] = [];
  const films: FilmHit[] = [];
  const groups: GroupHit[] = [];

  for (const [docIndex, fields] of perDoc) {
    const doc = index.docs[docIndex]!;
    // Every term has to be found somewhere in the one result.
    const best = terms.map((_, termIndex) => Math.max(0, ...[...fields.values()].map((scores) => scores[termIndex]!.score)));
    if (best.some((value) => value === 0)) continue;
    let score = best.reduce((sum, value) => sum + value, 0);

    // The field that explains the result best: the most of the words, weighted.
    let top: { field: Field; scores: FieldScore[]; value: number } | null = null;
    for (const [fieldIndex, scores] of fields) {
      const covered = scores.filter((each) => each.score > 0).length;
      const value = covered * 100 + scores.reduce((sum, each) => sum + each.score, 0);
      if (!top || value > top.value) top = { field: doc.fields[fieldIndex]!, scores, value };
    }
    if (!top) continue;
    if (terms.length > 1 && top.field.folded.includes(phrase)) score *= 1.5;
    if (top.field.name && top.field.folded.startsWith(phrase)) score += 8;

    const marked = new Set(top.scores.flatMap((each) => [...each.matched.keys()]));
    if (doc.kind === 'group') {
      groups.push({ kind: 'group', label: doc.label, sort: doc.sort, people: doc.people, score: score + Math.min(doc.people.length, 20) / 20 });
      continue;
    }
    const cut = snippet(top.field, marked);
    if (doc.kind === 'person') people.push({ kind: 'person', person: doc.person, score, where: top.field.label, snippet: cut.parts });
    else if (doc.kind === 'place') places.push({ kind: 'place', place: doc.place, score, where: top.field.label, snippet: cut.parts });
    else {
      // In a ceremony film, the words belong to whoever's part they fall in.
      const at = doc.times[cut.tokenIndex] ?? 0;
      const owner = doc.owners.filter((each) => each.start <= at).at(-1) ?? doc.owners[0]!;
      films.push({ kind: 'film', person: owner.person, filmId: doc.filmId, at, score, snippet: cut.parts });
    }
  }

  const byScore = <T extends { score: number }>(a: T, b: T) => b.score - a.score;
  people.sort((a, b) => byScore(a, b) || a.person.sortName.localeCompare(b.person.sortName));
  places.sort((a, b) => byScore(a, b) || a.place.name.localeCompare(b.place.name));
  films.sort((a, b) => byScore(a, b) || a.person.sortName.localeCompare(b.person.sortName));
  groups.sort((a, b) => byScore(a, b) || a.label.localeCompare(b.label));
  return { query, people, groups, places, films };
}

/**
 * The part of a field that shows why it matched: a short field whole, a list
 * as only the items that matched, a long one as the passage holding the most
 * of the words. The words are marked, and the writer's italics kept.
 */
function snippet(where: Field, marked: ReadonlySet<string>): { parts: SnippetPart[]; tokenIndex: number } {
  const hits = where.tokens.map((token, index) => ({ token, index })).filter(({ token }) => marked.has(token.folded));
  let tokenIndex = hits[0]?.index ?? 0;
  if (where.list) {
    let offset = 0;
    const items = where.text.split(' · ').map((text) => {
      const item = { start: offset, end: offset + text.length };
      offset = item.end + 3;
      return item;
    });
    const kept = items.filter((item) => hits.some(({ token }) => token.start >= item.start && token.end <= item.end));
    return {
      parts: kept.flatMap((item, index) => [
        ...(index > 0 ? [{ text: ' · ', mark: false }] : []),
        ...pieces(where, item.start, item.end, hits.map(({ token }) => token)),
      ]),
      tokenIndex,
    };
  }
  let from = 0;
  let to = where.text.length;
  if (where.long && where.text.length > 180) {
    // The window of about 160 characters holding the most different words.
    let best = { start: 0, variety: 0 };
    for (const { token } of hits) {
      const inside = new Set(hits.filter((each) => each.token.start >= token.start && each.token.end <= token.start + 160).map((each) => each.token.folded));
      if (inside.size > best.variety) best = { start: token.start, variety: inside.size };
    }
    tokenIndex = hits.find(({ token }) => token.start === best.start)?.index ?? tokenIndex;
    from = Math.max(0, best.start - 50);
    to = Math.min(where.text.length, best.start + 130);
    // Whole words at either end.
    while (from > 0 && /[\p{L}\p{N}]/u.test(where.text[from - 1]!)) from -= 1;
    while (to < where.text.length && /[\p{L}\p{N}]/u.test(where.text[to]!)) to += 1;
  }
  const parts: SnippetPart[] = [
    ...(from > 0 ? [{ text: '…', mark: false }] : []),
    ...pieces(where, from, to, hits.map(({ token }) => token)),
    ...(to < where.text.length ? [{ text: '…', mark: false }] : []),
  ];
  return { parts, tokenIndex };
}

/** A stretch of a field cut wherever a marked word or the writer's italics begin or end. */
function pieces(where: Field, from: number, to: number, marks: readonly Token[]): SnippetPart[] {
  const inside = (ranges: readonly (readonly [number, number])[], at: number) => ranges.some(([start, end]) => at >= start && at < end);
  const markRanges = marks.map((token) => [token.start, token.end] as const);
  const cuts = [...new Set([from, to, ...[...markRanges, ...where.italics].flat().filter((at) => at > from && at < to)])].sort((a, b) => a - b);
  const parts: SnippetPart[] = [];
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const start = cuts[index]!;
    const text = where.text.slice(start, cuts[index + 1]).replace(/\s+/g, ' ');
    const mark = inside(markRanges, start);
    const em = inside(where.italics, start);
    const last = parts.at(-1);
    if (last && last.mark === mark && Boolean(last.em) === em) parts[parts.length - 1] = { ...last, text: last.text + text };
    else parts.push(em ? { text, mark, em } : { text, mark });
  }
  return parts;
}

// ------------------------------------------------------------------ captions

/**
 * The words of a caption file with when each is said.
 *
 * The films' captions roll up line by line, each line shown twice: once as it
 * is spoken, with a time for every word, and again whole. Where a file has
 * those word times they are used and the repeats ignored; a plain file gives
 * each line the time it appears, and a line repeated from the one before is
 * skipped.
 */
export function captionWords(vtt: string): { text: string; at: number }[] {
  const words: { text: string; at: number }[] = [];
  const cues = vtt.replace(/\r/g, '').split(/\n\n+/);
  const timed = /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(vtt);
  let lastLine = '';
  for (const cue of cues) {
    const lines = cue.split('\n');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing < 0) continue;
    const start = seconds(lines[timing]!.split('-->')[0]!.trim());
    for (const line of lines.slice(timing + 1)) {
      if (timed) {
        if (!/<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(line)) continue;
        let at = start;
        for (const piece of line.split(/(<\d{2}:\d{2}:\d{2}\.\d{3}>)/)) {
          const stamp = /^<(\d{2}:\d{2}:\d{2}\.\d{3})>$/.exec(piece);
          if (stamp) { at = seconds(stamp[1]!); continue; }
          for (const text of piece.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean)) words.push({ text, at });
        }
      } else {
        const plain = line.replace(/<[^>]+>/g, '').trim();
        if (!plain || plain === lastLine) continue;
        lastLine = plain;
        for (const text of plain.split(/\s+/)) words.push({ text, at: start });
      }
    }
  }
  return words;
}

function seconds(stamp: string): number {
  const [h, m, s] = stamp.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}
