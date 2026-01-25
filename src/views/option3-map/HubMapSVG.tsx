export type HubNode = {
  x: number;
  y: number;
  radius: number;
};

export type RegionNode = {
  key: string;
  label: string;
  count: number;
  x: number;
  y: number;
  radius: number;
};

const wrapLabel = (label: string, maxChars = 14, maxLines = 2) => {
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || current.length === 0) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) {
    lines.push(current);
  }
  if (lines.length <= maxLines) {
    return lines;
  }
  const trimmed = lines.slice(0, maxLines);
  trimmed[maxLines - 1] = `${trimmed[maxLines - 1].replace(/\.*$/, '')}…`;
  return trimmed;
};

const renderMultiline = (lines: string[], x: number) => {
  const lineHeight = 16;
  const offset = (lines.length - 1) * lineHeight * 0.5;
  return lines.map((line, index) => (
    <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? -offset : lineHeight}>
      {line}
    </tspan>
  ));
};

const buildCurvePath = (from: HubNode, to: RegionNode) => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = 24;
  const ctrlX = midX - (dy / length) * offset;
  const ctrlY = midY + (dx / length) * offset;
  return `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`;
};

const HubMapSVG = ({
  width,
  height,
  hub,
  regions,
  selectedRegionKey,
  onSelectRegion,
  onSelectAll,
}: {
  width: number;
  height: number;
  hub: HubNode;
  regions: RegionNode[];
  selectedRegionKey: string | null;
  onSelectRegion: (key: string) => void;
  onSelectAll: () => void;
}) => {
  const viewBox = `0 0 ${width} ${height}`;

  return (
    <svg className="hub-map-svg" viewBox={viewBox} role="img" aria-label="CIHOF hub map">
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.8" />
        </radialGradient>
      </defs>

      <g className="hub-map-rays">
        {regions.map((region) => (
          <path key={region.key} d={buildCurvePath(hub, region)} />
        ))}
      </g>

      <g className="hub-map-regions">
        {regions.map((region) => {
          const isSelected = selectedRegionKey === region.key;
          const labelLines = wrapLabel(region.label);
          return (
            <g
              key={region.key}
              className={`hub-map-region${isSelected ? ' hub-map-region--active' : ''}`}
              onClick={() => onSelectRegion(region.key)}
              role="button"
              aria-label={`View ${region.label}`}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelectRegion(region.key);
                }
              }}
            >
              <circle cx={region.x} cy={region.y} r={region.radius} />
              <text className="hub-map-label" x={region.x} y={region.y - 6}>
                {renderMultiline(labelLines, region.x)}
              </text>
              <text className="hub-map-count" x={region.x} y={region.y + 24}>
                {region.count} inductees
              </text>
            </g>
          );
        })}
      </g>

      <g
        className="hub-map-hub"
        onClick={onSelectAll}
        role="button"
        aria-label="Show all CIHOF regions"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onSelectAll();
          }
        }}
      >
        <circle cx={hub.x} cy={hub.y} r={hub.radius} />
        <text className="hub-map-hub-label" x={hub.x} y={hub.y - 8}>
          Cleveland
        </text>
        <text className="hub-map-hub-subtitle" x={hub.x} y={hub.y + 18}>
          All Regions
        </text>
      </g>
    </svg>
  );
};

export default HubMapSVG;
