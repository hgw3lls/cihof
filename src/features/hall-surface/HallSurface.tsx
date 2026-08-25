import { LivingHallView } from '../living-hall/LivingHallView';
import type { HallFocus, HallLens, Inductee, RelationshipRecord } from '../../data/types';
import type { KioskSettings } from '../../app/kioskSettings';

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
  onEngage: () => void;
  onSelect: (inductee: Inductee) => void;
  onCloseFocus: () => void;
  onTimelineYearChange: (year: string) => void;
  onTraceFocusChange: (focusKey: string) => void;
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
  onEngage,
  onSelect,
  onCloseFocus,
  onTimelineYearChange,
  onTraceFocusChange,
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
        onEngage={onEngage}
        onCloseFocus={onCloseFocus}
        onTimelineYearChange={onTimelineYearChange}
        onTraceFocusChange={onTraceFocusChange}
        onSelect={onSelect}
      />
    </div>
  );
}
