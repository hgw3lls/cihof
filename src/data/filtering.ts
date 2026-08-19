import type { ExploreState, Inductee, SortMode } from './types';

export const allValue = 'all';

export function filterInductees(inductees: Inductee[], state: ExploreState) {
  const search = state.query.trim().toLowerCase();

  return inductees
    .filter((item) => {
      const matchesSearch = !search || item.searchText.includes(search);
      const matchesRegion = state.region === allValue || item.region === state.region;
      const matchesCountry = state.country === allValue || item.countryTags.includes(state.country);
      const matchesYear = state.year === allValue || item.classYear === Number(state.year);
      const matchesTheme = state.theme === allValue || item.themeTags.includes(state.theme);
      const matchesMedia =
        state.media === allValue ||
        (state.media === 'with-video' && item.hasVideo) ||
        (state.media === 'with-gallery' && item.hasGallery);

      return matchesSearch && matchesRegion && matchesCountry && matchesYear && matchesTheme && matchesMedia;
    })
    .sort((a, b) => sortInductees(a, b, state.sortMode));
}

export function sortInductees(a: Inductee, b: Inductee, sortMode: SortMode) {
  if (sortMode === 'physical-wall') return comparePhysicalWallPosition(a, b);
  if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
  if (sortMode === 'country-asc') return countrySortLabel(a).localeCompare(countrySortLabel(b)) || a.name.localeCompare(b.name);
  if (sortMode === 'region-asc') return a.region.localeCompare(b.region) || a.name.localeCompare(b.name);

  const yearA = a.classYear ?? 9999;
  const yearB = b.classYear ?? 9999;

  if (sortMode === 'year-desc') return yearB - yearA || a.name.localeCompare(b.name);
  return yearA - yearB || a.name.localeCompare(b.name);
}

function countrySortLabel(inductee: Inductee) {
  return inductee.countryTags[0] || inductee.region || 'zzzz';
}

function comparePhysicalWallPosition(a: Inductee, b: Inductee) {
  return (
    physicalWallRank(a) - physicalWallRank(b) ||
    a.physicalPanel.localeCompare(b.physicalPanel) ||
    (a.physicalRow ?? 9999) - (b.physicalRow ?? 9999) ||
    (a.physicalColumn ?? 9999) - (b.physicalColumn ?? 9999) ||
    a.wallLabel.localeCompare(b.wallLabel) ||
    (a.classYear ?? 9999) - (b.classYear ?? 9999) ||
    a.name.localeCompare(b.name)
  );
}

function physicalWallRank(inductee: Inductee) {
  if (inductee.physicalPortraitPresent && inductee.physicalRow && inductee.physicalColumn) return 0;
  if (inductee.physicalRow && inductee.physicalColumn) return 1;
  if (inductee.physicalPortraitPresent || inductee.physicalPanel || inductee.wallLabel || inductee.wallCoordinates) return 2;
  return 3;
}
