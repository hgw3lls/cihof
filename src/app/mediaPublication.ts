export type VisitorMediaTarget = 'kiosk' | 'public';

export type VisitorVideoAsset = {
  approvedForKiosk?: boolean;
  approvedForPublicWeb?: boolean;
  rightsStatus?: string;
  captionStatus?: string;
  transcriptStatus?: string;
  runtimePath?: string;
  posterRuntimePath?: string;
  captionRuntimePath?: string;
  transcriptRuntimePath?: string;
};

export function isVisitorReadyVideo(asset: VisitorVideoAsset, target: VisitorMediaTarget) {
  const scopeApproved = target === 'public'
    ? asset.approvedForPublicWeb === true
    : asset.approvedForKiosk === true;

  return Boolean(scopeApproved
    && asset.rightsStatus === 'approved'
    && asset.captionStatus === 'approved'
    && asset.transcriptStatus === 'approved'
    && asset.runtimePath
    && asset.posterRuntimePath
    && asset.captionRuntimePath
    && asset.transcriptRuntimePath);
}
