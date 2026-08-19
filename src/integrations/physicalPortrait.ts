import type { Inductee, PhysicalWallCoordinates } from '../data/types';

export type PhysicalPortraitSelection = {
  personId: string;
  physicalRow: number | null;
  physicalColumn: number | null;
  physicalPanel: string;
  wallLabel: string;
  wallCoordinates: PhysicalWallCoordinates | null;
  physicalPortraitPresent: boolean;
  selectedAt: string;
};

export function physicalPortraitSelectionFromInductee(inductee: Inductee): Omit<PhysicalPortraitSelection, 'personId' | 'selectedAt'> {
  return {
    physicalRow: inductee.physicalRow,
    physicalColumn: inductee.physicalColumn,
    physicalPanel: inductee.physicalPanel,
    wallLabel: inductee.wallLabel,
    wallCoordinates: inductee.wallCoordinates,
    physicalPortraitPresent: inductee.physicalPortraitPresent,
  };
}

export function onPhysicalPortraitSelected(
  personId: string,
  metadata: Partial<Omit<PhysicalPortraitSelection, 'personId' | 'selectedAt'>> = {},
) {
  const detail: PhysicalPortraitSelection = {
    personId,
    physicalRow: metadata.physicalRow ?? null,
    physicalColumn: metadata.physicalColumn ?? null,
    physicalPanel: metadata.physicalPanel ?? '',
    wallLabel: metadata.wallLabel ?? '',
    wallCoordinates: metadata.wallCoordinates ?? null,
    physicalPortraitPresent: Boolean(metadata.physicalPortraitPresent),
    selectedAt: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('cihof:physical-portrait-selected', { detail }));

  if (import.meta.env.DEV) {
    console.info('[CIHOF physical portrait selected]', detail);
  }
}
