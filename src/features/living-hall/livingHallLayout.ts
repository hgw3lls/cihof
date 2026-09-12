import type { CSSProperties } from 'react';
import { defaultKioskSettings, type KioskSettings } from '../../app/kioskSettings';
import type { PortraitFrameAspect, PortraitFrameState } from '../../components/PortraitFrame';
import type { HallLens, Inductee, RuntimeMediaRecord } from '../../data/types';

export type HallPersonAction = 'overview' | 'story' | 'text' | 'watch' | 'continue';

export type PortraitPosition = {
  x: number;
  y: number;
  size: number;
  z: number;
  delay: number;
  emphasis?: boolean;
  focused?: boolean;
  muted?: boolean;
};

export type HallLabel = {
  id: string;
  text: string;
  detail?: string;
  priority?: number;
  x: number;
  y: number;
};

export type FocusCardPlacement = {
  side: 'left' | 'right';
  style: CSSProperties & Record<string, string>;
  rect: LayoutRect;
};

export type FocusActionPlacement = {
  side: 'left' | 'right';
  style: CSSProperties & Record<string, string>;
  rect: LayoutRect;
};

export type LegacyForegroundContext = {
  fieldScale: number;
  panPx: number;
  visibleWidthPx: number;
};

export type HallLayoutViewport = {
  width: number;
  height: number;
};

type HallLayoutTier = 'compact' | 'dense' | 'balanced' | 'open';

export type HallLayoutMetrics = {
  tier: HallLayoutTier;
  densityScore: number;
  labelScale: number;
  app: {
    inspectorReservePx: number;
  };
  safe: {
    topPct: number;
    bottomPct: number;
    leftPct: number;
    rightPct: number;
  };
  portrait: {
    columns: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    minSize: number;
    maxSize: number;
    quietMinSize: number;
    quietMaxSize: number;
    emphasisMinSize: number;
    emphasisMaxSize: number;
    focusSize: number;
    relatedMinSize: number;
    relatedMaxSize: number;
    mutedMaxSize: number;
  };
  trace: {
    anchorSize: number;
    relatedPrimarySize: number;
    relatedSecondarySize: number;
    trailSize: number;
    perimeterNearSize: number;
    perimeterFarSize: number;
    yMax: number;
  };
  legacy: {
    fieldScale: number;
    localStepMin: number;
    localStepMax: number;
    focusedSize: number;
    focusedGroupSize: number;
    activeSize: number;
    standardSize: number;
    rowTopY: number;
    rowBottomY: number;
    labelEvery: number;
    labelWindow: number;
    labelPriorityMax: number;
  };
  foreground: {
    focusWidthRatio: number;
    focusMinWidth: number;
    focusMaxWidth: number;
    focusHeightRatio: number;
    focusMaxHeightRatio: number;
    actionWidthRatio: Record<Exclude<HallPersonAction, 'overview'>, number>;
    actionMinWidth: Record<Exclude<HallPersonAction, 'overview'>, number>;
    actionMaxWidth: Record<Exclude<HallPersonAction, 'overview'>, number>;
    actionHeightRatio: Record<Exclude<HallPersonAction, 'overview'>, number>;
    actionMaxHeightRatio: number;
  };
  recordThresholds: {
    portraits: number;
    traces: number;
    journeys: number;
    legacies: number;
  };
  viewport: HallLayoutViewport;
};

export type LayoutRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function solveHallLayout({
  focused,
  inductees,
  lens,
  settings,
  viewport,
}: {
  focused: boolean;
  inductees: Inductee[];
  lens: HallLens;
  settings: KioskSettings;
  viewport: HallLayoutViewport;
}): HallLayoutMetrics {
  const viewportWidth = Math.max(320, viewport.width);
  const height = Math.max(420, viewport.height);
  const appChrome = estimateAppChromeMetrics(viewportWidth);
  const inspectorReservePx = focused && viewportWidth > 920 ? appChrome.inspectorReservePx : 0;
  const width = Math.max(320, appChrome.stageWidthPx - inspectorReservePx);
  const peopleCount = Math.max(1, inductees.length);
  const dockReservePx = estimateExperienceDockReservePx(width, height);
  const usableHeight = Math.max(360, height - dockReservePx - (focused ? 126 : 84));
  const areaPerPortrait = (width * usableHeight) / peopleCount;
  const densityScore = clamp((areaPerPortrait - 7200) / 9000, 0, 1);
  const tier: HallLayoutTier = width < 980 || height < 640
    ? 'compact'
    : densityScore < 0.32
      ? 'dense'
      : densityScore < 0.66
        ? 'balanced'
        : 'open';
  const sizeScale = tier === 'compact' ? 0.78 : 0.86 + densityScore * 0.2;
  const insetPct = clamp((settings.fieldInsetVmin * Math.min(width, height)) / Math.max(width, 1), 0, 6);
  const safeTopPct = clamp((72 / height) * 100, 6, 15);
  const safeBottomPct = clamp(((dockReservePx + 72) / height) * 100, 16, 34);
  const maxRows = tier === 'open' ? 8 : tier === 'balanced' ? 8 : 9;
  const desiredCellWidth = tier === 'open' ? 138 : tier === 'balanced' ? 126 : 112;
  const minColumns = Math.min(peopleCount, Math.max(4, Math.ceil(peopleCount / maxRows)));
  const maxColumns = peopleCount >= 104
    ? 15
    : peopleCount >= 84
      ? 13
      : peopleCount >= 60
        ? 11
        : peopleCount >= 36
          ? 9
          : Math.max(4, Math.ceil(Math.sqrt(peopleCount)) + 1);
  const columns = Math.max(1, Math.min(peopleCount, Math.round(clamp(width / desiredCellWidth, minColumns, maxColumns))));
  const yMax = clamp(100 - safeBottomPct - 4, 68, 79);
  const labelEvery = tier === 'open' ? 1 : tier === 'balanced' ? 2 : tier === 'dense' ? 3 : 4;
  const labelPriorityMax = tier === 'open' ? 3 : tier === 'balanced' ? 2 : focused ? 1 : 2;
  const legacyGroupCount = legacyVisualGroupCount(inductees);
  const legacyGapPx = tier === 'open' ? 520 : tier === 'balanced' ? 460 : tier === 'dense' ? 410 : 360;
  const legacyFieldScale = clamp(
    (Math.max(legacyGroupCount - 1, 1) * legacyGapPx) / Math.max(width * 0.92, 1),
    tier === 'compact' ? 3.9 : 3.4,
    tier === 'compact' ? 8.4 : 7.4,
  );
  const foregroundWidthNudge = tier === 'open' ? 0 : tier === 'balanced' ? -0.015 : -0.035;
  const focusWidthRatio = (
    lens === 'traces' || lens === 'journeys'
      ? 0.25
      : lens === 'legacies'
        ? 0.3
        : 0.31
  ) + foregroundWidthNudge;

  return {
    tier,
    densityScore,
    labelScale: tier === 'open' ? 1 : tier === 'balanced' ? 0.96 : tier === 'dense' ? 0.9 : 0.86,
    app: {
      inspectorReservePx,
    },
    safe: {
      topPct: safeTopPct,
      bottomPct: safeBottomPct,
      leftPct: 4.5 + insetPct,
      rightPct: 4.5 + insetPct,
    },
    portrait: {
      columns,
      xMin: tier === 'compact' ? 8 : 6.5 + insetPct,
      xMax: tier === 'compact' ? 92 : 94.5 - insetPct,
      yMin: Math.max(10, safeTopPct + 3),
      yMax,
      minSize: scaledPortraitSize(40, sizeScale, 32, 44),
      maxSize: scaledPortraitSize(62, sizeScale, 50, 66),
      quietMinSize: scaledPortraitSize(34, sizeScale, 28, 38),
      quietMaxSize: scaledPortraitSize(54, sizeScale, 42, 58),
      emphasisMinSize: scaledPortraitSize(46, sizeScale, 38, 50),
      emphasisMaxSize: scaledPortraitSize(76, sizeScale, 58, 82),
      focusSize: Math.round(clamp(height * (tier === 'compact' ? 0.16 : 0.17), tier === 'compact' ? 128 : 145, 190)),
      relatedMinSize: scaledPortraitSize(68, sizeScale, 54, 72),
      relatedMaxSize: scaledPortraitSize(92, sizeScale, 72, 96),
      mutedMaxSize: scaledPortraitSize(58, sizeScale, 42, 60),
    },
    trace: {
      anchorSize: Math.round(clamp(height * (tier === 'compact' ? 0.18 : 0.165), tier === 'compact' ? 122 : 132, 178)),
      relatedPrimarySize: scaledPortraitSize(92, sizeScale, 72, 94),
      relatedSecondarySize: scaledPortraitSize(82, sizeScale, 64, 86),
      trailSize: scaledPortraitSize(86, sizeScale, 68, 90),
      perimeterNearSize: scaledPortraitSize(42, sizeScale, 30, 44),
      perimeterFarSize: scaledPortraitSize(34, sizeScale, 26, 36),
      yMax: Math.min(yMax + 2, 84),
    },
    legacy: {
      fieldScale: legacyFieldScale,
      localStepMin: tier === 'open' ? 0.95 : tier === 'balanced' ? 1.05 : 1.15,
      localStepMax: tier === 'open' ? 1.85 : tier === 'balanced' ? 1.72 : 1.58,
      focusedSize: Math.round(clamp(height * (tier === 'compact' ? 0.17 : 0.145), tier === 'compact' ? 118 : 126, 154)),
      focusedGroupSize: scaledPortraitSize(88, sizeScale, 66, 92),
      activeSize: scaledPortraitSize(96, sizeScale, 72, 100),
      standardSize: scaledPortraitSize(86, sizeScale, 62, 90),
      rowTopY: tier === 'compact' ? 32 : 34,
      rowBottomY: tier === 'compact' ? 55 : 57,
      labelEvery,
      labelWindow: tier === 'open' ? 2 : 1,
      labelPriorityMax,
    },
    foreground: {
      focusWidthRatio,
      focusMinWidth: tier === 'compact' ? 300 : lens === 'traces' || lens === 'journeys' ? 340 : 410,
      focusMaxWidth: tier === 'open' ? 580 : tier === 'balanced' ? 540 : 500,
      focusHeightRatio: lens === 'legacies' ? 0.48 : lens === 'traces' || lens === 'journeys' ? 0.32 : 0.42,
      focusMaxHeightRatio: tier === 'open' ? 0.68 : tier === 'balanced' ? 0.64 : 0.58,
      actionWidthRatio: {
        story: 0.42 + foregroundWidthNudge,
        text: 0.42 + foregroundWidthNudge,
        watch: 0.46 + foregroundWidthNudge,
        continue: 0.36 + foregroundWidthNudge,
      },
      actionMinWidth: {
        story: tier === 'open' ? 660 : 560,
        text: tier === 'open' ? 660 : 560,
        watch: tier === 'open' ? 720 : 620,
        continue: tier === 'open' ? 560 : 460,
      },
      actionMaxWidth: {
        story: tier === 'open' ? 820 : 740,
        text: tier === 'open' ? 820 : 740,
        watch: tier === 'open' ? 900 : 800,
        continue: tier === 'open' ? 680 : 620,
      },
      actionHeightRatio: {
        story: tier === 'open' ? 0.66 : 0.6,
        text: tier === 'open' ? 0.66 : 0.6,
        watch: tier === 'open' ? 0.58 : 0.52,
        continue: tier === 'open' ? 0.38 : 0.34,
      },
      actionMaxHeightRatio: tier === 'open' ? 0.7 : tier === 'balanced' ? 0.66 : 0.62,
    },
    recordThresholds: {
      portraits: tier === 'open' ? 60 : tier === 'balanced' ? 63 : 66,
      traces: tier === 'open' ? 74 : 82,
      journeys: tier === 'open' ? 70 : tier === 'balanced' ? 76 : 82,
      legacies: tier === 'open' ? 72 : tier === 'balanced' ? 78 : 84,
    },
    viewport: { width, height },
  };
}

export function legacyLabelPriority(
  groupIndex: number,
  distanceFromActiveGroup: number,
  active: boolean,
  layout: HallLayoutMetrics,
) {
  if (active) return 0;
  if (distanceFromActiveGroup <= layout.legacy.labelWindow) return 1;
  if (groupIndex % layout.legacy.labelEvery === 0) return 2;
  return 3;
}

export function shouldRenderHallLabel(
  label: HallLabel,
  lens: HallLens,
  layout: HallLayoutMetrics,
  activeLegacyYear: number | null,
) {
  if (lens !== 'legacies') return true;
  if (activeLegacyYear !== null && label.text === String(activeLegacyYear)) return true;
  return (label.priority ?? 0) <= layout.legacy.labelPriorityMax;
}

export function hallLayoutStyle(layout: HallLayoutMetrics, settings: KioskSettings) {
  return {
    '--app-inspector-reserve': `${Math.round(layout.app.inspectorReservePx)}px`,
    '--kiosk-label-scale': Number((settings.labelScale * layout.labelScale).toFixed(3)),
    '--hall-label-scale': Number(layout.labelScale.toFixed(3)),
    '--hall-density-score': Number(layout.densityScore.toFixed(3)),
  } as CSSProperties & Record<string, string | number>;
}

export function groupAnchors(count: number) {
  const preset = [
    { x: 17, y: 26, labelY: 12, rx: 11, ry: 11 },
    { x: 83, y: 24, labelY: 12, rx: 10, ry: 10 },
    { x: 84, y: 55, labelY: 39, rx: 11, ry: 12 },
    { x: 25, y: 67, labelY: 84, rx: 12, ry: 10 },
    { x: 52, y: 70, labelY: 86, rx: 13, ry: 9 },
    { x: 74, y: 73, labelY: 86, rx: 11, ry: 9 },
  ];
  return preset.slice(0, count);
}

export function fallbackPosition(index: number, total: number): PortraitPosition {
  const count = Math.max(total, 1);
  const ring = Math.sqrt((index + 1) / count);
  const angle = index * 137.508 * Math.PI / 180;
  const size = 82 + (index % 5) * 6;

  return {
    x: clamp(50 + Math.cos(angle) * 38 * ring, 8, 92),
    y: clamp(50 + Math.sin(angle) * 29 * ring, 14, 80),
    size,
    z: Math.round(size),
    delay: staggerDelay(index),
    emphasis: index % 13 === 0,
  };
}

export function portraitSize(inductee: Inductee, index: number, min: number, max: number) {
  const priority = inductee.featured ? 22 : inductee.featuredCandidate ? 14 : Math.min(inductee.attractPriority * 1.8, 18);
  const variation = (hashNumber(`${inductee.id}-${index}`) % 21) - 7;
  return clamp(min + priority + variation, min, max);
}

export function staggerDelay(index: number) {
  return (index % 12) * 24;
}

export function hashNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function wobble(value: string, salt: number, min: number, max: number) {
  const ratio = ((hashNumber(`${value}-${salt}`) % 1000) / 1000);
  return min + (max - min) * ratio;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function portraitFrameState(lens: HallLens, position: PortraitPosition): PortraitFrameState {
  if (position.focused) return 'focus';
  if (lens === 'traces' || lens === 'journeys') return 'trace';
  if (lens === 'legacies') return 'legacy';
  return 'standard';
}

export function portraitLensBadge(
  lens: HallLens,
  position: PortraitPosition,
  inductee: Inductee,
  activeLegacyYear: number | null,
) {
  if (position.focused) return 'FOCUS';
  if (lens === 'traces' && position.emphasis) return 'TRACE';
  if (lens === 'journeys' && position.emphasis) return 'STOP';
  if (lens === 'legacies' && activeLegacyYear !== null && inductee.classYear === activeLegacyYear) return String(activeLegacyYear);
  if (lens === 'portraits' && (inductee.featured || inductee.featuredCandidate) && position.size >= 58) return 'FEATURED';
  return '';
}

export function portraitCategoryForLens(
  lens: HallLens,
  position: PortraitPosition,
  inductee: Inductee,
  activeLegacyYear: number | null,
) {
  if (position.focused) return 'focused';
  if (position.muted) return 'background';
  if (lens === 'traces' && position.emphasis) return 'trace-related';
  if (lens === 'journeys' && position.emphasis) return 'journey-stop';
  if (lens === 'legacies' && activeLegacyYear !== null && inductee.classYear === activeLegacyYear) return 'active-class';
  if (lens === 'portraits' && (inductee.featured || inductee.featuredCandidate)) return 'featured';
  if (position.emphasis) return 'emphasis';
  return 'standard';
}

export function portraitFrameAspect(record: RuntimeMediaRecord | undefined): PortraitFrameAspect {
  const primaryImage = record?.images?.primary;
  if (
    primaryImage
    && typeof primaryImage.width === 'number'
    && typeof primaryImage.height === 'number'
    && primaryImage.width > primaryImage.height * 1.12
  ) {
    return 'wide';
  }
  return 'tall';
}

export function shouldShowFrameRecord(lens: HallLens, position: PortraitPosition, layout?: HallLayoutMetrics) {
  if (position.focused || position.emphasis) return true;
  if (lens === 'legacies') return position.size >= (layout?.recordThresholds.legacies ?? 72);
  if (lens === 'portraits') return position.size >= (layout?.recordThresholds.portraits ?? 60);
  if (lens === 'traces') return position.size >= (layout?.recordThresholds.traces ?? 82);
  if (lens === 'journeys') return position.size >= (layout?.recordThresholds.journeys ?? 76);
  return false;
}

export function portraitStyle(
  position: PortraitPosition,
  lens: HallLens = 'portraits',
  inducteeId = '',
  frameState: PortraitFrameState = portraitFrameState(lens, position),
  frameAspect: PortraitFrameAspect = 'tall',
  settings: KioskSettings = defaultKioskSettings,
  layout?: HallLayoutMetrics,
) {
  const scaledSize = position.size * settings.portraitScale;
  const frame = portraitFrameMetrics({ ...position, size: scaledSize }, lens, inducteeId, frameState, frameAspect, layout);
  return {
    '--portrait-x': `${position.x}%`,
    '--portrait-y': `${position.y}%`,
    '--portrait-size': `${scaledSize}px`,
    '--portrait-delay': `${position.delay}ms`,
    '--frame-width': `${frame.width}px`,
    '--frame-height': `${frame.height}px`,
    '--frame-edge': `${frame.edge}px`,
    '--mat-size': `${frame.mat}px`,
    '--frame-scale': frame.scale,
    '--frame-rotation': `${frame.rotation}deg`,
    '--frame-accent-opacity': frame.accentOpacity,
    '--record-area-height': `${frame.recordAreaHeight}px`,
    zIndex: position.z,
  } as CSSProperties & Record<string, string | number>;
}

export function focusCardPlacement(
  position: PortraitPosition,
  lens: HallLens,
  layout: HallLayoutMetrics,
  settings: KioskSettings,
  frameAspect: PortraitFrameAspect,
  legacyContext?: LegacyForegroundContext,
): FocusCardPlacement {
  const placementLayout = legacyContext
    ? { ...layout, viewport: { ...layout.viewport, width: legacyContext.visibleWidthPx } }
    : layout;
  const metrics = focusCardMetrics(lens, placementLayout);
  if (layout.app.inspectorReservePx > 0) {
    return {
      side: 'right',
      style: {
        '--focus-card-x': '100%',
        '--focus-card-y': '50%',
        '--focus-card-width': `${Math.round(metrics.widthPx)}px`,
        '--focus-card-max-height': `${Math.round(metrics.maxHeightPx)}px`,
      } as CSSProperties & Record<string, string>,
      rect: dockedInspectorRect(placementLayout, layout.app.inspectorReservePx),
    };
  }

  const placementPosition = legacyContext
    ? visibleLegacyForegroundPosition(position, placementLayout, legacyContext)
    : position;
  const portraitRect = portraitFootprintRect(placementPosition, lens, placementLayout, settings, frameAspect);
  const placement = foregroundPlacement(placementPosition, placementLayout, portraitRect, metrics);
  const xValue = legacyContext
    ? `${Math.round((placement.x / 100) * placementLayout.viewport.width)}px`
    : `${placement.x}%`;

  return {
    side: placement.side,
    style: {
      '--focus-card-x': xValue,
      '--focus-card-y': `${placement.y}%`,
      '--focus-card-width': `${Math.round(metrics.widthPx)}px`,
      '--focus-card-max-height': `${Math.round(metrics.maxHeightPx)}px`,
    } as CSSProperties & Record<string, string>,
    rect: placement.rect,
  };
}

export function visibleLegacyXPercent(x: number, legacyContext: LegacyForegroundContext, viewportWidth = legacyContext.visibleWidthPx) {
  const panPct = (legacyContext.panPx / Math.max(viewportWidth, 1)) * 100;
  return x * legacyContext.fieldScale - panPct;
}

export function actionPanelPlacement(
  position: PortraitPosition,
  action: HallPersonAction,
  layout: HallLayoutMetrics,
  settings: KioskSettings,
  frameAspect: PortraitFrameAspect,
): FocusActionPlacement {
  const metrics = actionPanelMetrics(action, layout);
  const portraitRect = portraitFootprintRect(position, 'portraits', layout, settings, frameAspect, 1.22);
  const placement = foregroundPlacement(position, layout, portraitRect, metrics);

  return {
    side: placement.side,
    style: {
      '--person-action-x': `${placement.x}%`,
      '--person-action-y': `${placement.y}%`,
      '--person-action-width': `${Math.round(metrics.widthPx)}px`,
      '--person-action-max-height': `${Math.round(metrics.maxHeightPx)}px`,
    } as CSSProperties & Record<string, string>,
    rect: placement.rect,
  };
}

export function labelStyle(label: HallLabel) {
  return {
    '--label-x': `${label.x}%`,
    '--label-y': `${label.y}%`,
  } as CSSProperties & Record<string, string>;
}

export function foregroundLabelRects({
  actionPlacement,
  cardPlacement,
  frameAspect,
  layout,
  lens,
  legacyContext,
  position,
  settings,
}: {
  actionPlacement: FocusActionPlacement | null;
  cardPlacement: FocusCardPlacement | null;
  frameAspect: PortraitFrameAspect;
  layout: HallLayoutMetrics;
  lens: HallLens;
  legacyContext?: LegacyForegroundContext;
  position: PortraitPosition | null;
  settings: KioskSettings;
}) {
  const rects: LayoutRect[] = [];
  const placementLayout = legacyContext
    ? { ...layout, viewport: { ...layout.viewport, width: legacyContext.visibleWidthPx } }
    : layout;
  if (position) {
    const labelPosition = legacyContext
      ? visibleLegacyForegroundPosition(position, placementLayout, legacyContext)
      : position;
    rects.push(portraitFootprintRect(labelPosition, lens, placementLayout, settings, frameAspect, 1.08));
  }
  if (cardPlacement) rects.push(cardPlacement.rect);
  if (actionPlacement) rects.push(actionPlacement.rect);
  return rects;
}

export function hallLabelCollisionRects({
  activeMode,
  foregroundRects,
  layout,
  lens,
  legacyContext,
  mediaRecordMap,
  people,
  settings,
}: {
  activeMode: { positions: Map<string, PortraitPosition> };
  foregroundRects: LayoutRect[];
  layout: HallLayoutMetrics;
  lens: HallLens;
  legacyContext?: LegacyForegroundContext;
  mediaRecordMap: Map<string, RuntimeMediaRecord>;
  people: Inductee[];
  settings: KioskSettings;
}) {
  if (lens !== 'traces' && lens !== 'legacies' && lens !== 'journeys') return foregroundRects;

  const placementLayout = legacyContext
    ? { ...layout, viewport: { ...layout.viewport, width: legacyContext.visibleWidthPx } }
    : layout;
  const rects = [...foregroundRects];

  people.forEach((person) => {
    const position = activeMode.positions.get(person.id);
    if (!position) return;

    const visiblePosition = legacyContext
      ? visibleLegacyForegroundPosition(position, placementLayout, legacyContext)
      : position;
    if (visiblePosition.x < -10 || visiblePosition.x > 110 || visiblePosition.y < -8 || visiblePosition.y > 108) return;

    const frameAspect = portraitFrameAspect(mediaRecordMap.get(person.id));
    const paddingScale = position.focused
      ? 1.12
      : lens === 'legacies'
        ? 0.9
        : lens === 'journeys'
          ? 0.94
          : 0.98;
    rects.push(portraitFootprintRect(visiblePosition, lens, placementLayout, settings, frameAspect, paddingScale));
  });

  return rects;
}

export function labelOverlapsForeground(
  label: HallLabel,
  lens: HallLens,
  activeLegacyYear: number | null,
  foregroundRects: LayoutRect[],
  legacyContext?: LegacyForegroundContext,
) {
  if (foregroundRects.length === 0) return false;
  const labelRect = labelLayoutRect(label, lens, activeLegacyYear, legacyContext);
  return foregroundRects.some((rect) => rectsOverlap(labelRect, rect, 1.6));
}

export function readHallLayoutViewport(): HallLayoutViewport {
  if (typeof window === 'undefined') return { width: 1920, height: 900 };
  const visualViewport = window.visualViewport;
  return {
    width: Math.max(320, visualViewport?.width ?? window.innerWidth),
    height: Math.max(420, visualViewport?.height ?? window.innerHeight),
  };
}

function estimateExperienceDockReservePx(width: number, height: number) {
  const dockHeight = clamp(height * 0.072, 82, 112);
  const dockBottom = clamp(width * 0.018, 16, 32);
  return dockHeight + dockBottom;
}

function estimateAppChromeMetrics(viewportWidth: number) {
  if (viewportWidth <= 920) {
    return {
      stageWidthPx: viewportWidth,
      inspectorReservePx: 0,
    };
  }

  const shellGapPx = clamp(viewportWidth * 0.012, 10, 18);
  const railWidthPx = clamp(viewportWidth * 0.074, 92, 120);
  const inspectorWidthPx = viewportWidth <= 1180
    ? clamp(viewportWidth * 0.31, 300, 360)
    : clamp(viewportWidth * 0.28, 330, 430);

  return {
    stageWidthPx: Math.max(320, viewportWidth - railWidthPx - shellGapPx * 2),
    inspectorReservePx: inspectorWidthPx + shellGapPx,
  };
}

function legacyVisualGroupCount(inductees: Inductee[]) {
  const years = new Set<number>();
  let pending = false;
  for (const inductee of inductees) {
    if (typeof inductee.classYear === 'number') {
      years.add(inductee.classYear);
    } else {
      pending = true;
    }
  }
  return Math.max(1, years.size + (pending ? 1 : 0));
}

function scaledPortraitSize(base: number, scale: number, min: number, max: number) {
  return Math.round(clamp(base * scale, min, max));
}

function portraitFrameMetrics(
  position: PortraitPosition,
  lens: HallLens,
  inducteeId: string,
  frameState: PortraitFrameState,
  frameAspect: PortraitFrameAspect,
  layout?: HallLayoutMetrics,
) {
  const base = position.size;
  const tallRatio = frameState === 'legacy' ? 1.34 : 1.42;
  const aspectRatio = frameAspect === 'wide' ? 0.82 : tallRatio;
  const portraitVariationActive = lens === 'portraits' && Boolean(inducteeId);
  const matVariation = portraitVariationActive ? Math.round(wobble(inducteeId, 311, -1, 1)) : 0;
  const rotation = portraitVariationActive ? Number(wobble(inducteeId, 313, -0.35, 0.35).toFixed(3)) : 0;

  if (frameState === 'focus') {
    const width = Math.round(base * (frameAspect === 'wide' ? 1.12 : 1.04));
    return {
      width,
      height: Math.round(width * (frameAspect === 'wide' ? 0.92 : 1.42)),
      edge: Math.round(clamp(base * 0.04, 5, 8)),
      mat: Math.round(clamp(base * 0.078, 10, 16) + (portraitVariationActive ? matVariation * 0.5 : 0)),
      scale: 1,
      rotation: portraitVariationActive ? Number((rotation * 0.45).toFixed(3)) : 0,
      accentOpacity: 1,
      recordAreaHeight: Math.round(clamp(base * 0.2, 28, 42)),
    };
  }

  if (frameState === 'trace') {
    const width = Math.round(base * (frameAspect === 'wide' ? 1.18 : 1));
    return {
      width,
      height: Math.round(width * (frameAspect === 'wide' ? 0.84 : 1.34)),
      edge: Math.round(clamp(base * 0.02, 1, 2)),
      mat: Math.round(clamp(base * 0.026, 2, 3)),
      scale: 1,
      rotation: 0,
      accentOpacity: position.focused ? 1 : position.emphasis ? 0.56 : 0.14,
      recordAreaHeight: shouldShowFrameRecord(lens, position, layout) ? Math.round(clamp(base * 0.11, 6, 12)) : 0,
    };
  }

  if (frameState === 'legacy') {
    const width = Math.round(base * (frameAspect === 'wide' ? 1.22 : 1));
    return {
      width,
      height: Math.round(width * (frameAspect === 'wide' ? 0.78 : 1.34)),
      edge: Math.round(clamp(base * 0.026, 2, 4)),
      mat: Math.round(clamp(base * 0.038, 3, 5)),
      scale: 1,
      rotation: 0,
      accentOpacity: 0.38,
      recordAreaHeight: shouldShowFrameRecord(lens, position, layout) ? Math.round(clamp(base * 0.13, 10, 16)) : 0,
    };
  }

  const width = Math.round(base * (frameAspect === 'wide' ? 1.18 : 1));
  return {
    width,
    height: Math.round(width * aspectRatio),
    edge: Math.round(clamp(base * 0.027, 1, 2)),
    mat: Math.round(clamp(base * 0.055, 3, 5) + matVariation),
    scale: 1,
    rotation,
    accentOpacity: position.emphasis ? 0.11 : 0,
    recordAreaHeight: shouldShowFrameRecord(lens, position, layout) ? Math.round(clamp(base * 0.15, 8, 13)) : 0,
  };
}

function dockedInspectorRect(layout: HallLayoutMetrics, reservePx: number): LayoutRect {
  const reservePct = (reservePx / Math.max(layout.viewport.width, 1)) * 100;
  return rectFromEdges(100, 0, 100 + reservePct, 100);
}

function visibleLegacyForegroundPosition(
  position: PortraitPosition,
  layout: HallLayoutMetrics,
  legacyContext: LegacyForegroundContext,
): PortraitPosition {
  return {
    ...position,
    x: visibleLegacyXPercent(position.x, legacyContext, layout.viewport.width),
  };
}

function labelLayoutRect(
  label: HallLabel,
  lens: HallLens,
  activeLegacyYear: number | null,
  legacyContext?: LegacyForegroundContext,
): LayoutRect {
  const activeLegacyLabel = lens === 'legacies' && activeLegacyYear !== null && label.text === String(activeLegacyYear);
  const x = lens === 'legacies' && legacyContext
    ? visibleLegacyXPercent(label.x, legacyContext)
    : label.x;
  const width = activeLegacyLabel
    ? 12
    : lens === 'traces' || lens === 'journeys'
      ? clamp(Math.max(label.text.length * 0.98, (label.detail?.length ?? 0) * 0.56), 9, 22)
      : clamp(Math.max(label.text.length * 0.68, (label.detail?.length ?? 0) * 0.38), 7, lens === 'legacies' ? 12 : 15);
  const height = activeLegacyLabel ? 6.4 : lens === 'traces' || lens === 'journeys' ? 8 : label.detail ? 6.2 : 4.2;
  return rectFromCenter(x, label.y, width, height);
}

function foregroundPlacement(
  position: PortraitPosition,
  layout: HallLayoutMetrics,
  portraitRect: LayoutRect,
  metrics: { widthPx: number; heightPx: number; maxHeightPx: number; gapPx: number },
) {
  const viewport = layout.viewport;
  const fieldWidth = Math.max(viewport.width, 1);
  const fieldHeight = Math.max(viewport.height, 1);
  const widthPct = clamp((metrics.widthPx / fieldWidth) * 100, 18, 46);
  const heightPct = clamp((Math.max(metrics.heightPx, metrics.maxHeightPx) / fieldHeight) * 100, 18, 76);
  const gapPct = clamp((metrics.gapPx / fieldWidth) * 100, 2.4, 6.8);
  const topReservePct = layout.safe.topPct;
  const bottomReservePct = Math.max(layout.safe.bottomPct, clamp((260 / fieldHeight) * 100, 18, 34));
  const rightRoom = (100 - layout.safe.rightPct) - portraitRect.right;
  const leftRoom = portraitRect.left - layout.safe.leftPct;
  const side: 'left' | 'right' = rightRoom >= widthPct + gapPct || rightRoom >= leftRoom ? 'right' : 'left';
  const rightPanelMinPct = layout.tier === 'compact' ? layout.safe.leftPct + 2 : layout.tier === 'dense' ? 52 : 46;
  const leftPanelMaxPct = layout.tier === 'compact' ? 100 - layout.safe.rightPct - 2 : layout.tier === 'dense' ? 48 : 54;
  const x = side === 'right'
    ? clamp(portraitRect.right + gapPct, rightPanelMinPct, 100 - layout.safe.rightPct - widthPct)
    : clamp(portraitRect.left - gapPct, layout.safe.leftPct + widthPct, leftPanelMaxPct);
  const yMin = topReservePct + heightPct * 0.5;
  const yMax = 100 - bottomReservePct - heightPct * 0.5;
  const y = clampToRange(position.y, yMin, yMax);
  const rect = side === 'right'
    ? rectFromEdges(x, y - heightPct * 0.5, x + widthPct, y + heightPct * 0.5)
    : rectFromEdges(x - widthPct, y - heightPct * 0.5, x, y + heightPct * 0.5);

  return { side, x, y, rect };
}

function focusCardMetrics(lens: HallLens, layout: HallLayoutMetrics) {
  const viewport = layout.viewport;
  const compact = layout.tier === 'compact';
  const widthPx = compact
    ? Math.max(300, viewport.width - 48)
    : clamp(viewport.width * layout.foreground.focusWidthRatio, layout.foreground.focusMinWidth, layout.foreground.focusMaxWidth);
  const heightPx = compact
    ? clamp(viewport.height * 0.32, 220, 320)
    : clamp(viewport.height * layout.foreground.focusHeightRatio, lens === 'traces' || lens === 'journeys' ? 260 : 360, lens === 'legacies' ? 680 : 600);
  const maxHeightPx = compact
    ? clamp(viewport.height * 0.34, 220, 320)
    : clamp(viewport.height * layout.foreground.focusMaxHeightRatio, 440, 800);

  return { widthPx, heightPx, maxHeightPx, gapPx: compact ? 22 : 46 };
}

function actionPanelMetrics(action: HallPersonAction, layout: HallLayoutMetrics) {
  const viewport = layout.viewport;
  const compact = layout.tier === 'compact';
  const panelAction = action === 'overview' ? 'story' : action;
  const widthPx = compact
    ? Math.max(300, viewport.width - 48)
    : clamp(
      viewport.width * layout.foreground.actionWidthRatio[panelAction],
      layout.foreground.actionMinWidth[panelAction],
      layout.foreground.actionMaxWidth[panelAction],
    );
  const heightPx = compact
    ? clamp(viewport.height * 0.58, 360, 620)
    : clamp(
      viewport.height * layout.foreground.actionHeightRatio[panelAction],
      panelAction === 'continue' ? 310 : 470,
      panelAction === 'watch' ? 650 : 760,
    );
  const maxHeightPx = compact
    ? clamp(viewport.height * 0.58, 360, 620)
    : clamp(viewport.height * layout.foreground.actionMaxHeightRatio, panelAction === 'continue' ? 420 : 560, 820);

  return { widthPx, heightPx, maxHeightPx, gapPx: compact ? 22 : layout.tier === 'dense' ? 78 : 54 };
}

function portraitFootprintRect(
  position: PortraitPosition,
  lens: HallLens,
  layout: HallLayoutMetrics,
  settings: KioskSettings,
  frameAspect: PortraitFrameAspect,
  paddingScale = 1,
): LayoutRect {
  const viewport = layout.viewport;
  const scaledSize = position.size * settings.portraitScale;
  const frame = portraitFrameMetrics(
    { ...position, size: scaledSize },
    lens,
    '',
    portraitFrameState(lens, position),
    frameAspect,
    layout,
  );
  const fieldWidth = Math.max(viewport.width, 1);
  const fieldHeight = Math.max(viewport.height, 1);
  const widthPct = ((frame.width + 42 * paddingScale) / fieldWidth) * 100;
  const heightPct = ((frame.height + 86 * paddingScale) / fieldHeight) * 100;
  return rectFromCenter(position.x, position.y, widthPct, heightPct);
}

function rectFromCenter(x: number, y: number, width: number, height: number): LayoutRect {
  return {
    left: x - width * 0.5,
    top: y - height * 0.5,
    right: x + width * 0.5,
    bottom: y + height * 0.5,
  };
}

function rectFromEdges(left: number, top: number, right: number, bottom: number): LayoutRect {
  return { left, top, right, bottom };
}

function rectsOverlap(a: LayoutRect, b: LayoutRect, padding = 0) {
  return a.left < b.right + padding
    && a.right > b.left - padding
    && a.top < b.bottom + padding
    && a.bottom > b.top - padding;
}

function clampToRange(value: number, min: number, max: number) {
  if (min > max) return clamp(value, max, min);
  return clamp(value, min, max);
}
