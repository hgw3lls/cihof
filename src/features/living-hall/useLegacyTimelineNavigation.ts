import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { HallLens } from '../../data/types';
import { clamp, type LegacyForegroundContext } from './livingHallLayout';
import { legacyGroupForYear, type LegacyChronology } from './livingHallModes';
import { eventTargetInsideFocusCard } from './livingHallDom';

export type LegacyJumpTarget = -1 | 1 | 'first' | 'last' | number;

type LegacyDragState = {
  pointerId: number;
  startX: number;
  startPan: number;
  moved: boolean;
};

type UseLegacyTimelineNavigationOptions = {
  activeYear: number | null;
  chronology: LegacyChronology;
  focusModalOpen: boolean;
  lens: HallLens;
  timelineYear: string;
  viewportWidth: number;
  onTimelineYearChange?: (year: string) => void;
};

export function useLegacyTimelineNavigation({
  activeYear,
  chronology,
  focusModalOpen,
  lens,
  timelineYear,
  viewportWidth,
  onTimelineYearChange,
}: UseLegacyTimelineNavigationOptions) {
  const [pan, setPan] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<LegacyDragState | null>(null);
  const suppressTapUntilRef = useRef(0);

  const maxPan = useCallback(() => {
    const field = fieldRef.current;
    const viewport = field?.parentElement;
    if (!field || !viewport) return 0;
    return Math.max(0, field.offsetWidth - viewport.clientWidth);
  }, []);

  const visibleWidth = useCallback(() => {
    return fieldRef.current?.parentElement?.clientWidth ?? fieldRef.current?.clientWidth ?? 0;
  }, []);

  const fieldWidth = useCallback(() => {
    return fieldRef.current?.offsetWidth ?? 0;
  }, []);

  const panToYear = useCallback((year: number | null) => {
    const measuredFieldWidth = fieldWidth();
    const measuredVisibleWidth = visibleWidth();
    if (!measuredFieldWidth || !measuredVisibleWidth) {
      setPan(0);
      return;
    }

    const group = legacyGroupForYear(chronology, year) ?? chronology.groups[0];
    if (!group) {
      setPan(0);
      return;
    }

    const targetCenter = (group.x / 100) * measuredFieldWidth;
    setPan(clamp(targetCenter - measuredVisibleWidth * 0.5, 0, maxPan()));
  }, [chronology, fieldWidth, maxPan, visibleWidth]);

  const nearestYearForPan = useCallback((nextPan: number) => {
    const measuredFieldWidth = fieldWidth();
    const measuredVisibleWidth = visibleWidth();
    if (!measuredFieldWidth || chronology.groups.length === 0) return null;

    const centerPercent = ((nextPan + measuredVisibleWidth * 0.5) / measuredFieldWidth) * 100;
    const nearest = chronology.groups
      .filter((group) => group.year !== null)
      .sort((a, b) => Math.abs(a.x - centerPercent) - Math.abs(b.x - centerPercent))[0];

    return nearest?.year ?? null;
  }, [chronology.groups, fieldWidth, visibleWidth]);

  const commitPan = useCallback((nextPan: number) => {
    const year = nearestYearForPan(nextPan);
    if (year !== null && timelineYear !== String(year)) onTimelineYearChange?.(String(year));
  }, [nearestYearForPan, onTimelineYearChange, timelineYear]);

  const changeClass = useCallback((direction: LegacyJumpTarget) => {
    if (chronology.years.length === 0) return;

    const currentIndex = Math.max(chronology.years.indexOf(activeYear ?? chronology.years[0]), 0);
    const nextIndex = typeof direction === 'number' && ![-1, 1].includes(direction)
      ? chronology.years.indexOf(direction)
      : direction === 'first'
        ? 0
        : direction === 'last'
          ? chronology.years.length - 1
          : clamp(currentIndex + direction, 0, chronology.years.length - 1);
    const nextYear = chronology.years[nextIndex];
    if (!nextYear) return;

    onTimelineYearChange?.(String(nextYear));
    panToYear(nextYear);
  }, [activeYear, chronology.years, onTimelineYearChange, panToYear]);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (lens !== 'legacies') return;
    if (focusModalOpen) {
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (eventTargetInsideFocusCard(event.target)) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPan: pan,
      moved: false,
    };
    setDragging(true);
  }, [focusModalOpen, lens, pan]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (focusModalOpen) {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        setDragging(false);
      }
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const drag = dragRef.current;
    if (lens !== 'legacies' || !drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 3 && !drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (!drag.moved) return;

    const nextPan = clamp(drag.startPan - deltaX, 0, maxPan());
    setPan(nextPan);
    event.preventDefault();
  }, [focusModalOpen, lens, maxPan]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (focusModalOpen) {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        setDragging(false);
      }
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;

    suppressTapUntilRef.current = window.performance.now() + 520;
    commitPan(clamp(drag.startPan - (event.clientX - drag.startX), 0, maxPan()));
    event.preventDefault();
    event.stopPropagation();
  }, [commitPan, focusModalOpen, maxPan]);

  const cancelDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
    }
  }, []);

  const wheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (lens !== 'legacies') return;
    if (focusModalOpen) {
      if (!eventTargetInsideFocusCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    setPan((value) => clamp(value + delta, 0, maxPan()));
  }, [focusModalOpen, lens, maxPan]);

  useEffect(() => {
    if (lens !== 'legacies') {
      setDragging(false);
      dragRef.current = null;
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      panToYear(activeYear);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeYear, chronology.fieldScale, lens, panToYear]);

  useEffect(() => {
    if (lens !== 'legacies') return undefined;

    function onResize() {
      setPan((value) => clamp(value, 0, maxPan()));
    }

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [lens, maxPan]);

  const visibleWidthPx = lens === 'legacies'
    ? visibleWidth() || viewportWidth
    : viewportWidth;
  const foregroundContext = useMemo<LegacyForegroundContext | undefined>(() => lens === 'legacies'
    ? {
      fieldScale: chronology.fieldScale,
      panPx: pan,
      visibleWidthPx,
    }
    : undefined,
  [chronology.fieldScale, lens, pan, visibleWidthPx]);
  const fieldStyle = useMemo<(CSSProperties & Record<string, string>) | undefined>(() => lens === 'legacies'
    ? {
      '--legacy-field-width': `${chronology.fieldScale * 100}%`,
      '--legacy-pan': `${pan}px`,
      '--legacy-visible-width': `${visibleWidthPx}px`,
    }
    : undefined,
  [chronology.fieldScale, lens, pan, visibleWidthPx]);
  const fieldHandlers = useMemo(() => ({
    onPointerCancelCapture: cancelDrag,
    onPointerDownCapture: beginDrag,
    onPointerMoveCapture: moveDrag,
    onPointerUpCapture: endDrag,
    onWheelCapture: wheel,
  }), [beginDrag, cancelDrag, endDrag, moveDrag, wheel]);
  const shouldSuppressTap = useCallback(() => {
    return typeof window !== 'undefined' && window.performance.now() < suppressTapUntilRef.current;
  }, []);

  return {
    changeClass,
    dragging,
    fieldHandlers,
    fieldRef,
    fieldStyle,
    foregroundContext,
    pan,
    shouldSuppressTap,
    visibleWidthPx,
  };
}
