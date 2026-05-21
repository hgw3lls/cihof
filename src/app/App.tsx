import { useMemo, useState } from 'react';
import { ExploreView } from '../features/explore/ExploreView';
import { InducteeDetail } from '../features/inductee-detail/InducteeDetail';
import { useDataFacets, useInductees } from '../data/useInductees';
import type { Inductee } from '../data/types';

export function App() {
  const { inductees, loading, error } = useInductees();
  const facets = useDataFacets(inductees);
  const [selected, setSelected] = useState<Inductee | null>(null);

  const stats = useMemo(() => {
    const withImages = inductees.filter((item) => item.primaryImageUrl).length;
    const withVideo = inductees.filter((item) => item.youtubeVideoIds.length > 0 || item.localVideoPaths.length > 0).length;
    return { total: inductees.length, withImages, withVideo };
  }, [inductees]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cleveland International Hall of Fame</p>
          <h1>Inductee Explorer</h1>
        </div>
        <div className="topbar__stats" aria-label="Collection summary">
          <span>{stats.total} inductees</span>
          <span>{facets.regions.length} regions</span>
          <span>{stats.withVideo} videos</span>
        </div>
      </header>

      <ExploreView
        inductees={inductees}
        facets={facets}
        loading={loading}
        error={error}
        onSelect={setSelected}
      />

      <InducteeDetail inductee={selected} allInductees={inductees} onClose={() => setSelected(null)} />
    </main>
  );
}
