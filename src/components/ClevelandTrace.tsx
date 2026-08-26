import type { CSSProperties } from 'react';
import manifest from '../assets/cleveland-traces/manifest.json';
import type { HallLens, RelationshipProvenance, RelationshipType } from '../data/types';

type ManifestPath = {
  role: 'main' | 'branch';
  sourceFeatureIds: number[];
  points: [number, number][];
};

type ManifestMotif = {
  id: string;
  category: string;
  title: string;
  sourceFeatureIds: number[];
  paths: ManifestPath[];
};

export type ClevelandTraceRole = 'relationship' | 'trail' | 'latent' | 'legacy-register';

export type ClevelandTraceLine = {
  id: string;
  label?: string;
  detail?: string;
  provenance?: RelationshipProvenance;
  relationshipType?: RelationshipType;
  role?: ClevelandTraceRole;
  motifId?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ClevelandTraceFieldProps = {
  className?: string;
  lines: ClevelandTraceLine[];
  showLabels?: boolean;
  variant: HallLens;
};

type LineLabel = {
  id: string;
  text: string;
  detail?: string;
  x: number;
  y: number;
};

const motifList = manifest.motifs as unknown as ManifestMotif[];
const motifsById = new Map(motifList.map((motif) => [motif.id, motif]));

const relationshipMotifCycle = [
  'junction-offset-01',
  'corridor-01',
  'transition-01',
  'junction-t-01',
  'parallel-01',
  'bend-hard-01',
  'grid-02',
  'diagonal-01',
];

const trailMotifCycle = [
  'dense-01',
  'junction-branch-01',
  'transition-01',
  'bend-curve-01',
];

const legacyMotifCycle = [
  'register-01',
  'register-02',
  'register-03',
];

export const clevelandTraceManifest = manifest;

export function ClevelandTraceField({
  className = '',
  lines,
  showLabels = true,
  variant,
}: ClevelandTraceFieldProps) {
  if (lines.length === 0) return null;

  const rendered = lines.map((line, index) => {
    const motif = selectMotif(line, index, variant);
    const transformedPaths = motif.paths.map((pathItem) => ({
      ...pathItem,
      d: pathData(transformPoints(pathItem.points, line, pathItem.role)),
    }));
    const label = showLabels && line.label ? lineLabel(line, motif, index) : null;

    return { line, motif, paths: transformedPaths, label };
  });
  const labels = rendered.map((item) => item.label).filter((item): item is LineLabel => Boolean(item));
  const classNames = [
    'cleveland-trace-field',
    `cleveland-trace-field--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <figure
      aria-label="Diagrammatic relationship linework derived from Cleveland street geometry; not a map route."
      className={classNames}
      data-cleveland-trace-source={manifest.source.service}
      data-diagrammatic="true"
      data-runtime-gis="false"
    >
      <svg className="cleveland-trace-field__svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        {rendered.map(({ line, motif, paths }, lineIndex) => (
          <g
            className={[
              'cleveland-trace',
              `cleveland-trace--${line.provenance ?? 'curated'}`,
              `cleveland-trace--${line.role ?? 'relationship'}`,
            ].join(' ')}
            data-motif-category={motif.category}
            data-motif-id={motif.id}
            data-source-feature-ids={motif.sourceFeatureIds.join(',')}
            key={line.id}
            style={{ '--trace-draw-delay': `${Math.min(lineIndex * 80, 420)}ms` } as CSSProperties & Record<string, string>}
          >
            {paths.map((pathItem, pathIndex) => (
              <path
                className={[
                  'cleveland-trace__path',
                  `cleveland-trace__path--${pathItem.role}`,
                  'living-hall__traceLine',
                  `living-hall__traceLine--${line.provenance ?? 'curated'}`,
                ].join(' ')}
                d={pathItem.d}
                key={`${line.id}-${pathItem.role}-${pathIndex}`}
                pathLength={1}
              />
            ))}
            {(line.provenance === 'documented' || line.role === 'trail') && (
              <>
                <circle className="cleveland-trace__terminal cleveland-trace__terminal--start" cx={line.x1} cy={line.y1} r="0.58" />
                <circle className="cleveland-trace__terminal cleveland-trace__terminal--end" cx={line.x2} cy={line.y2} r="0.58" />
              </>
            )}
          </g>
        ))}
      </svg>
      {labels.map((label) => (
        <figcaption
          className="cleveland-trace-field__label"
          key={label.id}
          style={{
            '--trace-label-x': `${label.x}%`,
            '--trace-label-y': `${label.y}%`,
          } as CSSProperties & Record<string, string>}
        >
          <strong>{label.text}</strong>
          {label.detail && <small>{label.detail}</small>}
        </figcaption>
      ))}
    </figure>
  );
}

export function ClevelandTraceBackdrop({ variant }: { variant: HallLens }) {
  const lines = backdropLinesForLens(variant);
  if (lines.length === 0) return null;

  return (
    <ClevelandTraceField
      className="cleveland-trace-field--backdrop"
      lines={lines}
      showLabels={false}
      variant={variant}
    />
  );
}

function selectMotif(line: ClevelandTraceLine, index: number, variant: HallLens) {
  const selectedId = line.motifId
    ?? (line.role === 'trail'
      ? trailMotifCycle[index % trailMotifCycle.length]
      : variant === 'legacies' || line.role === 'legacy-register'
        ? legacyMotifCycle[index % legacyMotifCycle.length]
        : motifIdForRelationship(line.relationshipType, index));

  return motifsById.get(selectedId)
    ?? motifsById.get(relationshipMotifCycle[index % relationshipMotifCycle.length])
    ?? motifList[0];
}

function motifIdForRelationship(type: RelationshipType | undefined, index: number) {
  if (type === 'same_class') return index % 2 === 0 ? 'parallel-01' : 'register-03';
  if (type === 'inducted_by' || type === 'mentor' || type === 'colleague') return 'corridor-01';
  if (type === 'related_place') return 'diagonal-01';
  if (type === 'shared_organization') return 'junction-offset-01';
  if (type === 'shared_community' || type === 'civic_collaboration') return 'junction-branch-01';
  if (type === 'shared_theme') return index % 2 === 0 ? 'transition-01' : 'bend-curve-01';
  return relationshipMotifCycle[index % relationshipMotifCycle.length];
}

function transformPoints(points: [number, number][], line: ClevelandTraceLine, role: ManifestPath['role']) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / distance;
  const uy = dy / distance;
  const nx = -uy;
  const ny = ux;
  const lineAmplitude = line.role === 'trail'
    ? Math.min(14, Math.max(4, distance * 0.22))
    : line.role === 'legacy-register'
      ? Math.min(3.8, Math.max(1, distance * 0.035))
      : line.role === 'latent'
        ? Math.min(7, Math.max(1.8, distance * 0.08))
        : Math.min(18, Math.max(5, distance * 0.32));
  const branchScale = role === 'branch' ? 0.72 : 1;

  return points.map(([x, y]) => {
    const t = x / 100;
    const offset = ((y - 50) / 50) * lineAmplitude * branchScale;
    return [
      round(line.x1 + dx * t + nx * offset),
      round(line.y1 + dy * t + ny * offset),
    ] as [number, number];
  });
}

function pathData(points: [number, number][]) {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
}

function lineLabel(line: ClevelandTraceLine, motif: ManifestMotif, index: number): LineLabel {
  const mainPath = motif.paths.find((pathItem) => pathItem.role === 'main') ?? motif.paths[0];
  const transformed = transformPoints(mainPath.points, line, 'main');
  const labelIndex = Math.min(transformed.length - 1, Math.max(1, Math.floor(transformed.length * 0.58)));
  const point = transformed[labelIndex] ?? [
    line.x1 + (line.x2 - line.x1) * 0.56,
    line.y1 + (line.y2 - line.y1) * 0.56,
  ];
  const detail = line.detail;

  return {
    id: `label-${line.id}`,
    text: line.label ?? '',
    detail,
    x: clamp(point[0] + labelNudge(index, 'x'), 7, 93),
    y: clamp(point[1] + labelNudge(index, 'y'), 10, 86),
  };
}

function labelNudge(index: number, axis: 'x' | 'y') {
  const cycle = axis === 'x' ? [-1.8, 1.4, 2.2, -2.4, 0.8, -1.2] : [-1.4, 2.1, -2.2, 1.3, 2.6, -2];
  return cycle[index % cycle.length] ?? 0;
}

function backdropLinesForLens(variant: HallLens): ClevelandTraceLine[] {
  if (variant === 'traces') return [];
  if (variant === 'legacies') {
    return [
      { id: 'legacy-register-01', motifId: 'register-01', role: 'legacy-register', x1: 2, y1: 45, x2: 98, y2: 45 },
      { id: 'legacy-register-02', motifId: 'register-02', role: 'legacy-register', x1: 6, y1: 31, x2: 94, y2: 31 },
      { id: 'legacy-register-03', motifId: 'register-03', role: 'legacy-register', x1: 8, y1: 59, x2: 92, y2: 59 },
    ];
  }
  return [
    { id: 'portrait-latent-01', motifId: 'diagonal-01', role: 'latent', x1: 8, y1: 24, x2: 72, y2: 18 },
    { id: 'portrait-latent-02', motifId: 'dense-01', role: 'latent', x1: 20, y1: 68, x2: 88, y2: 72 },
    { id: 'portrait-latent-03', motifId: 'grid-02', role: 'latent', x1: 14, y1: 43, x2: 43, y2: 39 },
  ];
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
