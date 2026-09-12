type ShellStatusStripProps = {
  focusName: string;
  kioskMode: boolean;
  mediaCount: number;
  networkOnline: boolean;
  profileCount: number;
  visitCollectionCount: number;
  visitCollectionLimit: number;
  wallDebugEnabled: boolean;
};

export function ShellStatusStrip({
  focusName,
  kioskMode,
  mediaCount,
  networkOnline,
  profileCount,
  visitCollectionCount,
  visitCollectionLimit,
  wallDebugEnabled,
}: ShellStatusStripProps) {
  return (
    <div className="museum-status" aria-label="Collection summary">
      <StatusItem label="Profiles" value={String(profileCount)} />
      <StatusItem label="Media" value={String(mediaCount)} />
      {focusName && <StatusItem className="museum-status__item--focus" label="Focus" value={focusName} />}
      {visitCollectionCount > 0 && <StatusItem label="Saved" value={`${visitCollectionCount}/${visitCollectionLimit}`} />}
      {!networkOnline && <StatusItem label="Network" value="Offline" />}
      {kioskMode && <StatusItem label="Mode" value="Kiosk" />}
      {wallDebugEnabled && <StatusItem label="Debug" value="Wall" />}
    </div>
  );
}

function StatusItem({ className = '', label, value }: { className?: string; label: string; value: string }) {
  return (
    <span className={['museum-status__item', className].filter(Boolean).join(' ')}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}
