import { useEffect, useMemo, useState } from 'react';
import { loadManifestCSV } from '../data/manifest';
import type { Inductee } from '../data/types';
import { getRegionOptions, getYearOptions, getYearOptionsDesc } from '../data/selectors';
import TimelineView from '../views/option1-timeline/TimelineView';
import ExploreView from '../views/option2-explore/ExploreView';
import { resolveMode, shouldShowModeBadge } from './mode';

const App = () => {
  const [inductees, setInductees] = useState<Inductee[]>([]);
  const [mode, setMode] = useState<'option1' | 'option2' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [inducteeData, resolvedMode] = await Promise.all([
          loadManifestCSV(),
          resolveMode(),
        ]);
        if (!mounted) {
          return;
        }
        setInductees(inducteeData);
        setMode(resolvedMode);
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

  const yearsAscending = useMemo(() => getYearOptions(inductees), [inductees]);
  const yearsDescending = useMemo(() => getYearOptionsDesc(inductees), [inductees]);
  const regions = useMemo(() => getRegionOptions(inductees), [inductees]);
  const showMode = shouldShowModeBadge();

  if (error) {
    return <div className="app-state app-state--error">{error}</div>;
  }

  if (loading || mode === null) {
    return <div className="app-state">Loading CIHOF kiosk…</div>;
  }

  return (
    <div className="app-shell">
      {showMode && <div className="mode-badge">Mode: {mode}</div>}
      {mode === 'option1' ? (
        <TimelineView inductees={inductees} years={yearsAscending} regions={regions} />
      ) : (
        <ExploreView inductees={inductees} years={yearsDescending} regions={regions} />
      )}
    </div>
  );
};

export default App;
