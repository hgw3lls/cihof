import { useEffect, useMemo, useState } from 'react';
import TimelineView from './components/TimelineView';
import { getRegionOptions, getYearOptions, loadInductees, loadManifest } from './data/inductees';
import type { Inductee, ManifestMap } from './types';

const App = () => {
  const [inductees, setInductees] = useState<Inductee[]>([]);
  const [manifest, setManifest] = useState<ManifestMap>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [inducteeData, manifestData] = await Promise.all([
          loadInductees(),
          loadManifest(),
        ]);
        if (!mounted) {
          return;
        }
        setInductees(inducteeData);
        setManifest(manifestData);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const years = useMemo(() => getYearOptions(inductees), [inductees]);
  const regions = useMemo(() => getRegionOptions(inductees), [inductees]);

  if (loading) {
    return <div className="app-state">Loading CIHOF timeline…</div>;
  }

  if (error) {
    return <div className="app-state app-state--error">{error}</div>;
  }

  return (
    <TimelineView
      inductees={inductees}
      manifest={manifest}
      years={years}
      regions={regions}
    />
  );
};

export default App;
