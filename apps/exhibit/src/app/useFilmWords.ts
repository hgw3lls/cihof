import { useEffect, useRef, useState } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import { captionWords, type FilmWords } from '../state/search.ts';
import { asset } from './Portrait.tsx';

/**
 * What is said in every film, read from their captions, for search.
 *
 * Nothing is fetched until search is first opened, and then once for the life
 * of the page: the captions are already on the display for the films
 * themselves. A caption that will not load leaves that film out of the search
 * and nothing else. A build with no films (the public site) fetches nothing.
 */
export function useFilmWords(people: readonly RuntimePerson[], wanted: boolean): { films: readonly FilmWords[]; gathering: boolean } {
  const [films, setFilms] = useState<readonly FilmWords[]>([]);
  const [state, setState] = useState<'idle' | 'gathering' | 'done'>('idle');
  // Marking the start in state would run this effect again and cancel the
  // reading it had just begun; a ref does not.
  const started = useRef(false);

  useEffect(() => {
    if (!wanted || started.current) return;
    started.current = true;
    const all = people.flatMap((person) => person.films.map((film) => ({ personId: person.id, filmId: film.id, captions: film.captions })));
    if (all.length === 0) { setState('done'); return; }
    setState('gathering');
    const controller = new AbortController();
    (async () => {
      const read: FilmWords[] = [];
      // A few at a time, so the display stays responsive while they load.
      for (let index = 0; index < all.length; index += 6) {
        const batch = await Promise.all(all.slice(index, index + 6).map(async (film): Promise<FilmWords | null> => {
          try {
            const response = await fetch(asset(film.captions), { signal: controller.signal });
            return response.ok ? { personId: film.personId, filmId: film.filmId, words: captionWords(await response.text()) } : null;
          } catch {
            return null;
          }
        }));
        if (controller.signal.aborted) return;
        read.push(...batch.filter((film): film is FilmWords => film !== null));
      }
      setFilms(read);
      setState('done');
    })();
    return () => {
      // Cancelled before it finished: let the next run start it again.
      controller.abort();
      started.current = false;
    };
  }, [wanted, people]);

  return { films, gathering: state === 'gathering' };
}
