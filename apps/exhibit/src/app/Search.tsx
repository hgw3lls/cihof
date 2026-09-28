import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { RuntimePerson, RuntimePlace } from '../data/runtime.ts';
import type { FilmHit, GroupHit, PersonHit, PlaceHit, SearchResults, SnippetPart } from '../state/search.ts';
import { maxQueryLength } from '../state/exhibit.ts';
import { asset, focalPoint, portraitUrl } from './Portrait.tsx';

/** How many people are listed; the rest are lit on the wall, and the list says so. */
const listedPeople = 20;

type Props = {
  query: string;
  results: SearchResults;
  /** Still gathering what is said in the films, the first time search opens. */
  gatheringFilms: boolean;
  /** Starting points drawn from the collection, shown before anything is typed. */
  suggestions: readonly string[];
  onQuery: (query: string) => void;
  onPerson: (personId: string) => void;
  onGroup: (hit: GroupHit) => void;
  onPlace: (place: RuntimePlace) => void;
  onFilm: (hit: FilmHit) => void;
  onClose: () => void;
};

/**
 * Search, in from the right, over the wall, typed on a keyboard. The people it finds light up on
 * the wall as the words are typed; the list says why each one matched, and
 * finds the places, the collection's groupings and the moments in the films
 * as well.
 */
export function Search({ query, results, gatheringFilms, suggestions, onQuery, onPerson, onGroup, onPlace, onFilm, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The panel is still sliding in from beyond the stage's edge; focusing with a
  // scroll would pull the whole stage sideways to reach it.
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

  const typed = query.trim().length > 0;
  const found = results.people.length + results.groups.length + results.places.length + results.films.length;
  const status = !typed
    ? 'Names, stories, communities, years, places, and what is said in the films.'
    : found === 0
      ? `Nothing in the collection matches “${query.trim()}”.`
      : [
        results.people.length > 0 && `${results.people.length} ${results.people.length === 1 ? 'person' : 'people'} lit on the wall`,
        results.places.length > 0 && `${results.places.length} ${results.places.length === 1 ? 'place' : 'places'}`,
        results.films.length > 0 && `${results.films.length} ${results.films.length === 1 ? 'film' : 'films'}`,
      ].filter(Boolean).join(' · ');

  return (
    <section
      className="search"
      role="search"
      aria-label="Search the collection"
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <div className="search__top">
        <label className="search__field">
          <span className="visually-hidden">Search for</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            maxLength={maxQueryLength}
            placeholder="Type a name, a place, a word…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        {typed && <button type="button" className="search__clear" onClick={() => { onQuery(''); inputRef.current?.focus({ preventScroll: true }); }}>Clear</button>}
        <button type="button" className="search__close" aria-label="Close search" onClick={onClose}>×</button>
      </div>
      <p className="search__status" role="status">
        {status}
        {gatheringFilms && typed && <span className="search__gathering"> · still reading the films</span>}
      </p>

      <div className="search__results">
        {!typed && (
          <div className="search__try">
            <p className="search__heading">Try</p>
            <div className="search__suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" className="chip" onClick={() => onQuery(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
        )}

        {results.groups.length > 0 && (
          <Section title="In the collection" count={results.groups.length}>
            {results.groups.slice(0, 4).map((hit) => (
              <Row
                key={`${hit.sort}:${hit.label}`}
                onClick={() => onGroup(hit)}
                kicker={`${hit.sort} · ${hit.people.length} ${hit.people.length === 1 ? 'person' : 'people'}`}
                title={hit.label}
                picture={(
                  <span className="search__faces" aria-hidden="true">
                    {hit.people.slice(0, 4).map((person) => <Face key={person.id} person={person} />)}
                  </span>
                )}
              />
            ))}
          </Section>
        )}

        {results.people.length > 0 && (
          <Section title="People" count={results.people.length}>
            {results.people.slice(0, listedPeople).map((hit) => <PersonRow key={hit.person.id} hit={hit} onPerson={onPerson} />)}
            {results.people.length > listedPeople && (
              <li className="search__more">{results.people.length - listedPeople} more, lit on the wall</li>
            )}
          </Section>
        )}

        {results.places.length > 0 && (
          <Section title="Places" count={results.places.length}>
            {results.places.slice(0, 6).map((hit) => <PlaceRow key={hit.place.id} hit={hit} onPlace={onPlace} />)}
          </Section>
        )}

        {results.films.length > 0 && (
          <Section title="Said in the films" count={results.films.length}>
            {results.films.slice(0, 8).map((hit) => (
              <Row
                key={`${hit.person.id}:${hit.filmId}`}
                onClick={() => onFilm(hit)}
                kicker={`Film · ${hit.person.name} · at ${clock(hit.at)}`}
                title={<Snippet parts={hit.snippet} />}
                quiet
                picture={<span className="search__poster" aria-hidden="true" style={posterStyle(hit)}><span className="search__play" /></span>}
              />
            ))}
          </Section>
        )}
      </div>

    </section>
  );
}

function PersonRow({ hit, onPerson }: { hit: PersonHit; onPerson: (personId: string) => void }) {
  const year = hit.person.classYear ? `Class of ${hit.person.classYear}` : 'Year not recorded';
  return (
    <Row
      onClick={() => onPerson(hit.person.id)}
      kicker={hit.where === 'Name' || hit.where === 'Class' ? year : `${year} · ${hit.where}`}
      title={hit.where === 'Name' ? <Snippet parts={hit.snippet} /> : hit.person.name}
      picture={<Face person={hit.person} large />}
    >
      {hit.where !== 'Name' && hit.where !== 'Class' && <Snippet parts={hit.snippet} className="search__snippet" />}
    </Row>
  );
}

function PlaceRow({ hit, onPlace }: { hit: PlaceHit; onPlace: (place: RuntimePlace) => void }) {
  const tied = hit.place.personIds?.length ?? 0;
  return (
    <Row
      onClick={() => onPlace(hit.place)}
      kicker={`Place${hit.place.neighborhood ? ` · ${hit.place.neighborhood}` : ''}`}
      title={hit.where === 'Place' ? <Snippet parts={hit.snippet} /> : hit.place.name}
      picture={<span className="search__place" aria-hidden="true">{tied}</span>}
    >
      {hit.where !== 'Place' && <Snippet parts={hit.snippet} className="search__snippet" />}
    </Row>
  );
}

/** One result: its picture, what it is, its name, and the words that matched. */
function Row({ picture, kicker, title, onClick, quiet = false, children }: {
  picture: ReactNode;
  kicker: string;
  title: ReactNode;
  onClick: () => void;
  quiet?: boolean;
  children?: ReactNode;
}) {
  return (
    <li>
      <button type="button" className="search__row" onClick={onClick}>
        {picture}
        <span className="search__text">
          <span className="search__kicker">{kicker}</span>
          <span className={quiet ? 'search__quote' : 'search__title'}>{title}</span>
          {children}
        </span>
      </button>
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="search__section" aria-label={title}>
      <p className="search__heading">{title} <span>{count}</span></p>
      <ul>{children}</ul>
    </section>
  );
}

function Snippet({ parts, className }: { parts: readonly SnippetPart[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const text = part.em ? <em>{part.text}</em> : part.text;
        return part.mark ? <mark key={index}>{text}</mark> : <span key={index}>{text}</span>;
      })}
    </span>
  );
}

function Face({ person, large = false }: { person: RuntimePerson; large?: boolean }) {
  return (
    <span
      className={large ? 'search__face search__face--large' : 'search__face'}
      aria-hidden="true"
      style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }}
    />
  );
}

function posterStyle(hit: FilmHit): CSSProperties {
  const film = hit.person.films.find((each) => each.id === hit.filmId);
  return film ? { backgroundImage: `url("${asset(film.poster)}")` } : {};
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const mm = Math.floor(whole / 60) % 60;
  const ss = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}
