import type { ExploreState, Inductee, SortMode } from './types';

export const allValue = 'all';

export function filterInductees(inductees: Inductee[], state: ExploreState) {
  const search = state.query.trim().toLowerCase();

  return inductees
    .filter((item) => {
      const matchesSearch = !search || item.searchText.includes(search);
      const matchesRegion = state.region === allValue || item.region === state.region;
      const matchesYear = state.year === allValue || item.classYear === Number(state.year);
      return matchesSearch && matchesRegion && matchesYear;
    })
    .sort((a, b) => sortInductees(a, b, state.sortMode));
}

export function sortInductees(a: Inductee, b: Inductee, sortMode: SortMode) {
  if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
  if (sortMode === 'region-asc') return a.region.localeCompare(b.region) || a.name.localeCompare(b.name);

  const yearA = a.classYear ?? 9999;
  const yearB = b.classYear ?? 9999;

  if (sortMode === 'year-desc') return yearB - yearA || a.name.localeCompare(b.name);
  return yearA - yearB || a.name.localeCompare(b.name);
}
