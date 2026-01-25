import { forwardRef, type ReactNode, type WheelEvent } from 'react';

const TimelineScroller = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    onScroll: () => void;
    onWheel: (event: WheelEvent<HTMLDivElement>) => void;
  }
>(({ children, onScroll, onWheel }, ref) => {
  return (
    <div className="timeline-scroller" ref={ref} onScroll={onScroll} onWheel={onWheel}>
      <div className="timeline-track">{children}</div>
    </div>
  );
});

TimelineScroller.displayName = 'TimelineScroller';

export default TimelineScroller;
