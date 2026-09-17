import { LivingHallView } from '../living-hall/LivingHallView';
import type { HallFocus, HallLens, HallLinkedPath, Inductee, RelationshipRecord } from '../../data/types';
import type { KioskSettings } from '../../app/kioskSettings';
import type { ColorMode } from '../../app/useColorMode';

type HallSurfaceProps = {
  inductees: Inductee[];
  relationships: RelationshipRecord[];
  loading: boolean;
  error: string;
  lens: HallLens;
  focus: HallFocus;
  attractActive: boolean;
  kioskMode: boolean;
  qrEnabled: boolean;
  soundEnabled: boolean;
  settings: KioskSettings;
  timelineYear: string;
  traceFocusKey: string;
  linkedPath: HallLinkedPath | null;
  visitCollectionIds: string[];
  colorMode: ColorMode;
  onToggleColorMode: () => void;
  onLensChange: (lens: HallLens) => void;
  onReset: () => void;
  onEngage: () => void;
  onSelect: (inductee: Inductee) => void;
  onCloseFocus: () => void;
  onTimelineYearChange: (year: string) => void;
  onTraceFocusChange: (focusKey: string) => void;
  onExplorePath: (path: HallLinkedPath) => void;
  onAddVisitCollectionPerson: (personId: string) => void;
  onRemoveVisitCollectionPerson: (personId: string) => void;
  onClearVisitCollection: () => void;
};

export function HallSurface({
  inductees,
  relationships,
  loading,
  error,
  lens,
  focus,
  attractActive,
  kioskMode,
  qrEnabled,
  soundEnabled,
  settings,
  timelineYear,
  traceFocusKey,
  linkedPath,
  visitCollectionIds,
  colorMode,
  onToggleColorMode,
  onLensChange,
  onReset,
  onEngage,
  onSelect,
  onCloseFocus,
  onTimelineYearChange,
  onTraceFocusChange,
  onExplorePath,
  onAddVisitCollectionPerson,
  onRemoveVisitCollectionPerson,
  onClearVisitCollection,
}: HallSurfaceProps) {
  const focusedPersonId = focus?.personId ?? '';
  const className = [
    'hall-surface',
    `hall-surface--${lens}`,
    focusedPersonId ? 'hall-surface--focused' : '',
    attractActive ? 'hall-surface--attract' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      data-hall-lens={lens}
      data-focused-person-id={focusedPersonId}
      aria-label="Cleveland International Hall of Fame persistent Hall"
    >
      <LivingHallView
        inductees={inductees}
        loading={loading}
        error={error}
        attractActive={attractActive}
        kioskMode={kioskMode}
        qrEnabled={qrEnabled}
        soundEnabled={soundEnabled}
        settings={settings}
        lens={lens}
        focusedPersonId={focusedPersonId}
        relationships={relationships}
        timelineYear={timelineYear}
        traceFocusKey={traceFocusKey}
        linkedPath={linkedPath}
        visitCollectionIds={visitCollectionIds}
        colorMode={colorMode}
        onToggleColorMode={onToggleColorMode}
        onLensChange={onLensChange}
        onReset={onReset}
        onEngage={onEngage}
        onCloseFocus={onCloseFocus}
        onTimelineYearChange={onTimelineYearChange}
        onTraceFocusChange={onTraceFocusChange}
        onExplorePath={onExplorePath}
        onSelect={onSelect}
        onAddVisitCollectionPerson={onAddVisitCollectionPerson}
        onRemoveVisitCollectionPerson={onRemoveVisitCollectionPerson}
        onClearVisitCollection={onClearVisitCollection}
      />
    </div>
  );
}
