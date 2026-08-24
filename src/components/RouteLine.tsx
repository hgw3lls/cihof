import type { CSSProperties, ReactNode } from 'react';

type RouteLinePath = 'horizontal' | 'vertical' | 'diagonal' | 'kink';
type RouteLineTone = 'route' | 'quiet' | 'migration';
type RouteLineTerminal = 'none' | 'dot';

type RouteLineProps = {
  ariaLabel?: string;
  className?: string;
  draw?: boolean;
  end?: RouteLineTerminal;
  label?: ReactNode;
  labelX?: string;
  labelY?: string;
  path?: RouteLinePath;
  start?: RouteLineTerminal;
  style?: CSSProperties;
  tone?: RouteLineTone;
};

const routePathPoints: Record<RouteLinePath, string> = {
  horizontal: '0,50 100,50',
  vertical: '50,0 50,100',
  diagonal: '4,84 48,45 96,14',
  kink: '0,70 38,70 38,30 100,30',
};

export function RouteLine({
  ariaLabel,
  className = '',
  draw = false,
  end = 'dot',
  label,
  labelX = '50%',
  labelY = '50%',
  path = 'horizontal',
  start = 'none',
  style,
  tone = 'route',
}: RouteLineProps) {
  const classNames = [
    'route-line',
    `route-line--${path}`,
    `route-line--${tone}`,
    draw ? 'route-line--draw' : '',
    className,
  ].filter(Boolean).join(' ');
  const routeStyle = {
    '--route-label-x': labelX,
    '--route-label-y': labelY,
    ...style,
  } as CSSProperties;

  return (
    <figure className={classNames} aria-hidden={ariaLabel ? undefined : true} aria-label={ariaLabel} style={routeStyle}>
      <svg className="route-line__svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <polyline className="route-line__path" pathLength={1} points={routePathPoints[path]} />
      </svg>
      {start === 'dot' && <span className="route-line__terminal route-line__terminal--start" aria-hidden="true" />}
      {end === 'dot' && <span className="route-line__terminal route-line__terminal--end" aria-hidden="true" />}
      {label && <figcaption className="route-line__label">{label}</figcaption>}
    </figure>
  );
}
