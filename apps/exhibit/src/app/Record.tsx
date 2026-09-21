import { useEffect, useRef } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';

/**
 * The full record, layered over whatever is on the stage.
 *
 * It restores focus to the control that opened it on close. Losing that return
 * strands a keyboard or switch user at the top of the page with no idea where
 * they were.
 */
export function Record({ person, onClose }: { person: RuntimePerson; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Remember the control that opened this, and put focus back there on close.
    // Without the return, a keyboard or switch user lands at the top of the page
    // with no indication of where they were.
    openedFrom.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();

    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      const origin = openedFrom.current;
      if (origin?.isConnected) origin.focus();
    };
  }, [onClose]);

  const paragraphs = person.biography.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <section className="record" role="dialog" aria-modal="true" aria-label={`${person.name}, full record`}>
      <header>
        <button type="button" onClick={onClose}>Close</button>
        <span>Inductee record</span>
      </header>
      <div className="reading">
        <div className="inner">
          <h2 ref={headingRef} tabIndex={-1}>{person.name}</h2>
          <p className="meta">{person.classYear ? `Inducted ${person.classYear}` : 'Induction year not recorded'}</p>

          {person.contributions.length > 0 && (
            <ul className="tags" aria-label="Honored for">
              {person.contributions.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          )}

          <div className="bio">
            {paragraphs.map((part, index) => <p key={index}>{part}</p>)}
          </div>

          <p className="credit">
            {person.biographyCurated
              ? 'Biography reviewed and edited by Hall of Fame curators.'
              : 'Biography as recorded by the Cleveland International Hall of Fame.'}
          </p>
        </div>
      </div>
    </section>
  );
}
