import { useMemo } from 'react';
import type { FormEvent } from 'react';
import { commandSearchResultGroups, type CommandSearchResult } from './commandSearch';

type ShellCommandSearchProps = {
  open: boolean;
  query: string;
  results: CommandSearchResult[];
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelect: (result: CommandSearchResult) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ShellCommandSearch({
  open,
  query,
  results,
  onOpenChange,
  onQueryChange,
  onSelect,
  onSubmit,
}: ShellCommandSearchProps) {
  const hasQuery = query.trim().length > 0;
  const showResults = open && hasQuery;
  const resultGroups = useMemo(() => commandSearchResultGroups(results), [results]);

  return (
    <form className={showResults ? 'museum-command museum-command--open' : 'museum-command'} role="search" onSubmit={onSubmit}>
      <label className="museum-command__label" htmlFor="museum-command-search">
        Find
      </label>
      <div className="museum-command__box">
        <input
          id="museum-command-search"
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search name, nationality, community, year"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="museum-command-results"
          aria-expanded={showResults}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onFocus={() => onOpenChange(true)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation?.();
            event.currentTarget.blur();
            onOpenChange(false);
          }}
        />
        <button type="submit" disabled={!hasQuery || results.length === 0}>
          Open
        </button>
      </div>
      {showResults && (
        <div className="museum-command__results" id="museum-command-results" role="listbox" aria-label="Search results">
          {resultGroups.length > 0 ? resultGroups.map((group) => (
            <section className="museum-command__group" key={group.kind} role="group" aria-label={group.label}>
              <h3 className="museum-command__groupTitle">{group.label}</h3>
              <ol className="museum-command__groupList">
                {group.results.map((result) => (
                  <li key={result.id}>
                    <button className="museum-command__result" type="button" role="option" aria-selected="false" onClick={() => onSelect(result)}>
                      <span className="museum-command__resultHeader">
                        <strong>{result.title}</strong>
                        <span className="museum-command__resultPill">{result.eyebrow}</span>
                      </span>
                      <span className="museum-command__resultMeta">{result.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )) : (
            <div className="museum-command__empty">No matching profiles</div>
          )}
        </div>
      )}
    </form>
  );
}
