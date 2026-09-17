import { useMemo, useState } from 'react';
import { installationConfig } from '../config/installationConfig';
import { useInductees } from '../data/useInductees';
import { useRelationships } from '../data/useRelationships';
import type { Inductee } from '../data/types';
import { InducteeDetail, type DetailAction } from '../features/inductee-detail/InducteeDetail';
import { ReviewDashboardView } from '../features/review-dashboard/ReviewDashboardView';
import { useViewportLock } from './useViewportLock';
import { useColorMode } from './useColorMode';

export function PortalApp() {
  useViewportLock();
  const { mode: colorMode, toggleMode } = useColorMode();

  const { inductees, loading, error } = useInductees();
  const { relationships } = useRelationships();
  const [previewId, setPreviewId] = useState('');
  const [initialAction, setInitialAction] = useState<DetailAction>('overview');
  const preview = useMemo(() => inductees.find((inductee) => inductee.id === previewId) ?? null, [inductees, previewId]);
  const previewIndex = preview ? inductees.findIndex((inductee) => inductee.id === preview.id) : -1;
  const previousInductee = previewIndex > 0
    ? inductees[previewIndex - 1]
    : inductees.length > 0
      ? inductees[inductees.length - 1]
      : null;
  const nextInductee = previewIndex >= 0 && inductees.length > 0 ? inductees[(previewIndex + 1) % inductees.length] : null;

  function selectPreview(inductee: Inductee, action: DetailAction = 'overview') {
    setPreviewId(inductee.id);
    setInitialAction(action);
  }

  return (
    <main className="portal-app" aria-label="CIHOF staff portal" data-color-mode={colorMode}>
      {loading && <div className="review-dashboard__alert">Loading staff portal data...</div>}
      {error && <div className="review-dashboard__alert">Portal data warning: {error}</div>}
      <ReviewDashboardView inductees={inductees} onSelect={selectPreview} colorMode={colorMode} onToggleColorMode={toggleMode} />
      <InducteeDetail
        inductee={preview}
        allInductees={inductees}
        relationships={relationships}
        kioskMode={false}
        qrEnabled={installationConfig.features.qrContinuation}
        soundEnabled={installationConfig.features.sound}
        initialAction={initialAction}
        nextInductee={nextInductee}
        previousInductee={previousInductee}
        staffMode
        wallDebug={installationConfig.debug.enabled}
        onClose={() => setPreviewId('')}
        onHome={() => setPreviewId('')}
        onReset={() => setPreviewId('')}
        onSelect={(inductee) => selectPreview(inductee)}
        onFindConnection={(inductee) => {
          const nextPreview = inductee ?? preview ?? inductees[0] ?? null;
          if (nextPreview) selectPreview(nextPreview, 'connections');
        }}
      />
    </main>
  );
}
