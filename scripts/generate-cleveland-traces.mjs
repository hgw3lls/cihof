import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'src/assets/cleveland-traces');
const outputPath = path.join(outputDir, 'manifest.json');

const roadLayerUrl = 'https://gis.cuyahogacounty.gov/server/rest/services/NCGIDE/Addressing_Sites_Streets/FeatureServer/1';
const clevelandFips = '16000';
const sourceWhere = `FIPSleft='${clevelandFips}' OR FIPSright='${clevelandFips}'`;
const sourceFields = [
  'OBJECTID',
  'fullname',
  'roadclass',
  'munileft',
  'muniright',
  'FIPSleft',
  'FIPSright',
  'Shape__Length',
];
const simplificationTolerance = 10;

async function main() {
  const sourceFeatures = await fetchClevelandRoadFeatures();
  const roadFeatures = sourceFeatures
    .map(toRoadFeature)
    .filter((feature) => feature.points.length >= 2 && feature.length > 30);

  const junctions = buildEndpointJunctions(roadFeatures);
  const motifs = buildMotifs(roadFeatures, junctions);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    coordinateSpace: { width: 100, height: 100 },
    source: {
      name: 'Cuyahoga County RoadCenterline',
      service: roadLayerUrl,
      queryEndpoint: `${roadLayerUrl}/query`,
      exactWhere: sourceWhere,
      selectionMethod: 'Features where FIPSleft or FIPSright is Cleveland municipal FIPS 16000.',
      fields: sourceFields,
      geometryFormat: 'GeoJSON',
      outputSpatialReference: 4326,
      countFetched: sourceFeatures.length,
    },
    usageSemantics: {
      diagrammatic: true,
      runtimeNetworkCalls: false,
      visitorDisclosure: 'Relational linework is derived from Cleveland street geometry and is diagrammatic, not to scale.',
      notEvidenceOf: [
        'street-level travel routes',
        'migration direction',
        'literal map location',
      ],
      mayRepresent: [
        'relationship',
        'shared class',
        'organization',
        'theme',
        'community',
        'conceptual thread',
      ],
    },
    processing: {
      script: 'scripts/generate-cleveland-traces.mjs',
      simplification: 'Ramer-Douglas-Peucker on projected local coordinates before endpoint-normalization.',
      simplificationTolerance,
      endpointClusterSize: 34,
      motifCount: motifs.length,
    },
    motifs,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${motifs.length} Cleveland trace motifs to ${path.relative(repoRoot, outputPath)}.`);
  console.log(motifs.map((motif) => `${motif.id}: ${motif.category} [${motif.sourceFeatureIds.join(', ')}]`).join('\n'));
}

async function fetchClevelandRoadFeatures() {
  const countUrl = queryUrl({
    where: sourceWhere,
    returnCountOnly: 'true',
    f: 'json',
  });
  const countPayload = await fetchJson(countUrl);
  const count = Number(countPayload.count ?? 0);
  const pageSize = 2000;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const features = [];

  for (let page = 0; page < pages; page += 1) {
    const payload = await fetchJson(queryUrl({
      where: sourceWhere,
      outFields: sourceFields.join(','),
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
      resultRecordCount: String(pageSize),
      resultOffset: String(page * pageSize),
      orderByFields: 'OBJECTID',
    }));
    features.push(...(payload.features ?? []));
  }

  return features;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  return response.json();
}

function queryUrl(params) {
  const url = new URL(`${roadLayerUrl}/query`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function toRoadFeature(feature) {
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.type === 'MultiLineString'
    ? longestLine(feature.geometry.coordinates ?? [])
    : feature.geometry?.coordinates ?? [];
  const lonLatPoints = coordinates
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map(([lon, lat]) => [Number(lon), Number(lat)]);
  const points = lonLatPoints.map(projectLonLat);

  return {
    id: Number(properties.OBJECTID ?? feature.id),
    name: String(properties.fullname ?? 'Unnamed road'),
    roadclass: String(properties.roadclass ?? 'Unknown'),
    municipalities: uniqueText([properties.munileft, properties.muniright]),
    fips: uniqueText([properties.FIPSleft, properties.FIPSright]),
    sourceLength: Number(properties.Shape__Length ?? 0),
    lonLatPoints,
    points,
    length: pathLength(points),
    straightness: straightness(points),
    turnScore: totalTurn(points),
    hardTurn: maxTurn(points),
    angle: principalAngle(points),
    midpoint: midpoint(points),
  };
}

function longestLine(lines) {
  return [...lines].sort((a, b) => b.length - a.length)[0] ?? [];
}

function projectLonLat([lon, lat]) {
  const originLon = -81.6944;
  const originLat = 41.4993;
  const latRad = originLat * Math.PI / 180;
  const metersPerDegreeLon = 111320 * Math.cos(latRad);
  const metersPerDegreeLat = 110540;
  return {
    x: (lon - originLon) * metersPerDegreeLon,
    y: (lat - originLat) * metersPerDegreeLat,
  };
}

function buildMotifs(features, junctions) {
  const used = new Set();
  const motifs = [];
  const pick = (id, category, title, candidates, preferredUse = ['trace']) => {
    const candidate = firstAvailable(candidates, used);
    if (!candidate) return;
    candidate.sourceFeatureIds.forEach((sourceId) => used.add(sourceId));
    motifs.push(asMotif({ id, category, title, preferredUse, ...candidate }));
  };

  pick('grid-01', 'orthogonal-street-fragment', 'Orthogonal street fragment', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.length > 300 && angleDistanceToGrid(feature.angle) < 6 && feature.straightness > 0.96, (feature) => feature.length)),
  ], ['portrait', 'trace']);

  pick('grid-02', 'offset-intersection', 'Offset intersection', [
    junctionCandidate(bestJunction(junctions, (junction) => junction.degree >= 3 && junction.offsetScore > 14 && junction.gridScore < 16, (junction) => junction.offsetScore + junction.degree * 6), 3),
  ]);

  pick('corridor-01', 'long-corridor-abrupt-turn', 'Long corridor with abrupt turn', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.length > 420 && feature.hardTurn > 24, (feature) => feature.length + feature.hardTurn * 18)),
  ]);

  pick('parallel-01', 'parallel-segments', 'Parallel Cleveland street segments', [
    parallelCandidate(features),
  ]);

  pick('junction-t-01', 't-intersection', 'T intersection', [
    junctionCandidate(bestJunction(junctions, (junction) => junction.degree === 3 && junction.tScore < 24, (junction) => 100 - junction.tScore), 3),
  ]);

  pick('junction-y-01', 'y-fork', 'Y or forked intersection', [
    junctionCandidate(bestJunction(junctions, (junction) => junction.degree >= 3 && junction.yScore < 28, (junction) => 100 - junction.yScore), 3),
  ]);

  pick('junction-offset-01', 'offset-four-way-intersection', 'Offset four-way intersection', [
    junctionCandidate(bestJunction(junctions, (junction) => junction.degree >= 4 && junction.offsetScore > 12, (junction) => junction.offsetScore + junction.degree * 4), 4),
  ]);

  pick('junction-branch-01', 'branching-multi-segment-junction', 'Branching multi-segment junction', [
    junctionCandidate(bestJunction(junctions, (junction) => junction.degree >= 4, (junction) => junction.degree * 24 + junction.spread), 5),
  ]);

  pick('bend-curve-01', 'gradual-curved-street-segment', 'Gradual curved segment', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.points.length > 8 && feature.turnScore > 32 && feature.hardTurn < 22, (feature) => feature.turnScore + feature.length * 0.04)),
  ]);

  pick('bend-hard-01', 'hard-angled-bend', 'Hard angled bend', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.hardTurn > 48, (feature) => feature.hardTurn * 12 + feature.length * 0.02)),
  ]);

  pick('transition-01', 'straight-grid-to-curve-transition', 'Transition from grid to curve', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.points.length > 10 && feature.straightness > 0.58 && feature.straightness < 0.92 && feature.turnScore > 38, (feature) => feature.turnScore + (1 - Math.abs(feature.straightness - 0.75)) * 80)),
  ]);

  pick('diagonal-01', 'diagonal-road-gesture', 'Diagonal road gesture', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.length > 360 && angleDistanceToGrid(feature.angle) > 18 && feature.straightness > 0.82, (feature) => feature.length + angleDistanceToGrid(feature.angle) * 18)),
  ]);

  pick('dense-01', 'compact-downtown-fragment', 'Compact downtown-like fragment', [
    denseCandidate(features),
  ], ['portrait', 'trace']);

  pick('open-01', 'open-sparse-fragment', 'Open sparse fragment', [
    singleFeatureCandidate(bestFeature(features, (feature) => feature.length > 650 && feature.straightness > 0.9 && feature.points.length <= 8, (feature) => feature.length)),
  ], ['portrait', 'trace']);

  pick('register-01', 'legacy-register-path', 'Cleveland path regularized toward chronology', [
    registerCandidate(bestFeature(features, (feature) => feature.length > 600 && feature.turnScore > 18, (feature) => feature.length + feature.turnScore * 4), 0.18),
  ], ['legacy']);

  pick('register-02', 'legacy-register-path', 'Second regularized chronology path', [
    registerCandidate(bestFeature(features, (feature) => feature.length > 360 && angleDistanceToGrid(feature.angle) > 12, (feature) => feature.length + angleDistanceToGrid(feature.angle) * 8), 0.12),
  ], ['legacy']);

  pick('register-03', 'legacy-register-path', 'Compact class-register mark', [
    registerCandidate(bestFeature(features, (feature) => feature.length > 240 && feature.hardTurn > 24, (feature) => feature.hardTurn * 8 + feature.length * 0.05), 0.08),
  ], ['legacy']);

  return motifs;
}

function firstAvailable(candidates, used) {
  return candidates.filter(Boolean).find((candidate) => candidate.sourceFeatureIds.some((sourceId) => !used.has(sourceId)))
    ?? candidates.filter(Boolean)[0]
    ?? null;
}

function asMotif({
  id,
  category,
  title,
  preferredUse,
  paths,
  sourceFeatures,
  processing,
}) {
  const sourceFeatureIds = uniqueNumbers(sourceFeatures.map((feature) => feature.id));

  return {
    id,
    category,
    title,
    preferredUse,
    diagrammatic: true,
    coordinateSpace: [100, 100],
    sourceService: roadLayerUrl,
    sourceFeatureIds,
    sourceRoadNames: uniqueText(sourceFeatures.map((feature) => feature.name)).slice(0, 8),
    sourceRoadClasses: uniqueText(sourceFeatures.map((feature) => feature.roadclass)).slice(0, 8),
    sourceMunicipalities: uniqueText(sourceFeatures.flatMap((feature) => feature.municipalities)).slice(0, 8),
    processing: {
      simplificationTolerance,
      ...processing,
    },
    paths,
  };
}

function singleFeatureCandidate(feature) {
  if (!feature) return null;
  const simplified = simplifyForMotif(feature.points, simplificationTolerance);
  return {
    sourceFeatureIds: [feature.id],
    sourceFeatures: [feature],
    paths: endpointNormalizedPaths([
      { role: 'main', feature, points: simplified },
    ]),
    processing: {
      extraction: 'single source RoadCenterline polyline',
      originalPointCount: feature.points.length,
      simplifiedPointCount: simplified.length,
    },
  };
}

function registerCandidate(feature, flattenScale) {
  const candidate = singleFeatureCandidate(feature);
  if (!candidate) return null;
  return {
    ...candidate,
    paths: candidate.paths.map((pathItem) => ({
      ...pathItem,
      points: pathItem.points.map(([x, y]) => [roundPoint(x), roundPoint(50 + (y - 50) * flattenScale)]),
    })),
    processing: {
      ...candidate.processing,
      regularizedForLegacy: true,
      verticalFlattenScale: flattenScale,
    },
  };
}

function parallelCandidate(features) {
  const candidates = [];
  const simplifiedFeatures = features
    .filter((feature) => feature.length > 240 && feature.straightness > 0.88)
    .slice()
    .sort((a, b) => b.length - a.length)
    .slice(0, 180);

  for (let a = 0; a < simplifiedFeatures.length; a += 1) {
    for (let b = a + 1; b < simplifiedFeatures.length; b += 1) {
      const first = simplifiedFeatures[a];
      const second = simplifiedFeatures[b];
      const angleDiff = Math.abs(first.angle - second.angle);
      const distance = pointDistance(first.midpoint, second.midpoint);
      if (angleDiff < 8 && distance > 45 && distance < 270) {
        candidates.push({ first, second, score: first.length + second.length - distance * 0.4 });
      }
    }
  }

  const pair = candidates.sort((a, b) => b.score - a.score)[0];
  if (!pair) return null;
  const firstPath = simplifyForMotif(pair.first.points, simplificationTolerance);
  const secondPath = simplifyForMotif(pair.second.points, simplificationTolerance);

  return {
    sourceFeatureIds: [pair.first.id, pair.second.id],
    sourceFeatures: [pair.first, pair.second],
    paths: endpointNormalizedPaths([
      { role: 'main', feature: pair.first, points: firstPath },
      { role: 'branch', feature: pair.second, points: secondPath },
    ]),
    processing: {
      extraction: 'two near-parallel Cleveland RoadCenterline polylines normalized to one endpoint frame',
      angleDifferenceDegrees: roundPoint(Math.abs(pair.first.angle - pair.second.angle)),
      midpointDistanceMeters: roundPoint(pointDistance(pair.first.midpoint, pair.second.midpoint)),
    },
  };
}

function denseCandidate(features) {
  const downtown = { lon: -81.6944, lat: 41.4993 };
  const center = projectLonLat([downtown.lon, downtown.lat]);
  const candidates = features
    .map((feature) => ({ feature, distance: pointDistance(feature.midpoint, center) }))
    .filter(({ distance, feature }) => distance < 1050 && feature.length > 80)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 7)
    .map(({ feature }, index) => ({
      role: index === 0 ? 'main' : 'branch',
      feature,
      points: trimPath(simplifyForMotif(feature.points, simplificationTolerance), 340),
    }));
  if (candidates.length < 3) return null;

  return {
    sourceFeatureIds: candidates.map((candidate) => candidate.feature.id),
    sourceFeatures: candidates.map((candidate) => candidate.feature),
    paths: endpointNormalizedPaths(candidates),
    processing: {
      extraction: 'compact group of RoadCenterline polylines near downtown Cleveland, cropped and endpoint-normalized',
      downtownReference: 'Approximate Public Square area used only to select a dense local geometry sample.',
    },
  };
}

function buildEndpointJunctions(features) {
  const clusters = new Map();
  const clusterSize = 34;

  features.forEach((feature) => {
    const start = feature.points[0];
    const end = feature.points[feature.points.length - 1];
    addEndpoint(clusters, clusterSize, feature, start, 0);
    addEndpoint(clusters, clusterSize, feature, end, feature.points.length - 1);
  });

  return Array.from(clusters.values())
    .filter((cluster) => cluster.entries.length >= 3)
    .map(analyzeJunction)
    .filter((junction) => junction.uniqueFeatureIds.length >= 3)
    .sort((a, b) => b.degree - a.degree || b.spread - a.spread);
}

function addEndpoint(clusters, clusterSize, feature, point, pointIndex) {
  if (!point) return;
  const key = `${Math.round(point.x / clusterSize)}:${Math.round(point.y / clusterSize)}`;
  const cluster = clusters.get(key) ?? { key, entries: [], points: [] };
  cluster.entries.push({ feature, pointIndex, point });
  cluster.points.push(point);
  clusters.set(key, cluster);
}

function analyzeJunction(cluster) {
  const center = averagePoint(cluster.points);
  const arms = cluster.entries.map((entry) => {
    const points = entry.pointIndex === 0
      ? entry.feature.points
      : [...entry.feature.points].reverse();
    const trimmed = trimPath(points, 330);
    const endpoint = trimmed[trimmed.length - 1] ?? center;
    const angle = angleOf(center, endpoint);
    return {
      feature: entry.feature,
      points: [center, ...trimmed.slice(1)],
      angle,
      length: pathLength(trimmed),
    };
  });
  const sortedAngles = arms.map((arm) => arm.angle).sort((a, b) => a - b);
  const gaps = sortedAngles.map((angle, index) => {
    const next = sortedAngles[(index + 1) % sortedAngles.length];
    return index === sortedAngles.length - 1 ? next + 360 - angle : next - angle;
  });
  const spread = Math.max(...gaps) - Math.min(...gaps);
  const tScore = Math.abs(Math.max(...gaps) - 180);
  const yScore = Math.abs(Math.max(...gaps) - 140);
  const offsetScore = gaps.reduce((total, gap) => total + Math.abs(gap - 90), 0) / Math.max(gaps.length, 1);
  const gridScore = arms.reduce((total, arm) => total + angleDistanceToGrid(arm.angle), 0) / arms.length;

  return {
    key: cluster.key,
    center,
    arms,
    degree: arms.length,
    spread,
    tScore,
    yScore,
    offsetScore,
    gridScore,
    uniqueFeatureIds: uniqueNumbers(arms.map((arm) => arm.feature.id)),
  };
}

function junctionCandidate(junction, armCount) {
  if (!junction) return null;
  const arms = [...junction.arms]
    .sort((a, b) => b.length - a.length)
    .slice(0, armCount);
  if (arms.length < 3) return null;

  const sortedArms = arms.sort((a, b) => a.angle - b.angle);
  const mainA = sortedArms[0];
  const mainB = sortedArms[Math.floor(sortedArms.length / 2)];
  const main = [
    ...[...mainA.points].reverse(),
    ...mainB.points.slice(1),
  ];
  const branchArms = sortedArms.filter((arm) => arm !== mainA && arm !== mainB);
  const paths = [
    { role: 'main', feature: mainA.feature, points: simplifyForMotif(main, simplificationTolerance) },
    ...branchArms.map((arm) => ({
      role: 'branch',
      feature: arm.feature,
      points: simplifyForMotif(arm.points, simplificationTolerance),
    })),
  ];

  return {
    sourceFeatureIds: sortedArms.map((arm) => arm.feature.id),
    sourceFeatures: sortedArms.map((arm) => arm.feature),
    paths: endpointNormalizedPaths(paths),
    processing: {
      extraction: 'endpoint-clustered RoadCenterline junction with cropped arms',
      junctionClusterKey: junction.key,
      sourceArmCount: junction.degree,
      motifArmCount: arms.length,
    },
  };
}

function bestFeature(features, predicate, score) {
  return features
    .filter(predicate)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0] ?? null;
}

function bestJunction(junctions, predicate, score) {
  return junctions
    .filter(predicate)
    .sort((a, b) => score(b) - score(a))[0] ?? null;
}

function endpointNormalizedPaths(pathItems) {
  const main = pathItems.find((pathItem) => pathItem.role === 'main') ?? pathItems[0];
  const start = main.points[0];
  const end = main.points[main.points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  const normalized = pathItems.map((pathItem) => {
    const raw = pathItem.points.map((point) => {
      const relX = point.x - start.x;
      const relY = point.y - start.y;
      return [
        (relX * ux + relY * uy) / length * 100,
        50 + (relX * nx + relY * ny) / length * 100,
      ];
    });
    return {
      role: pathItem.role,
      sourceFeatureIds: [pathItem.feature.id],
      points: raw,
    };
  });

  const maxOffset = Math.max(
    1,
    ...normalized.flatMap((pathItem) => pathItem.points.map(([, y]) => Math.abs(y - 50))),
  );
  const offsetScale = Math.min(1, 42 / maxOffset);

  return normalized.map((pathItem) => ({
    ...pathItem,
    points: pathItem.points.map(([x, y]) => [
      roundPoint(x),
      roundPoint(50 + (y - 50) * offsetScale),
    ]),
  }));
}

function simplifyForMotif(points, tolerance) {
  const simplified = rdp(points, tolerance);
  if (simplified.length >= 2) return simplified;
  return points.slice(0, 2);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= epsilon) return [start, end];
  const left = rdp(points.slice(0, maxIndex + 1), epsilon);
  const right = rdp(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

function trimPath(points, maxLength) {
  if (points.length <= 2) return points;
  const trimmed = [points[0]];
  let remaining = maxLength;

  for (let index = 1; index < points.length; index += 1) {
    const previous = trimmed[trimmed.length - 1];
    const current = points[index];
    const segment = pointDistance(previous, current);
    if (segment <= remaining) {
      trimmed.push(current);
      remaining -= segment;
      continue;
    }
    const ratio = Math.max(0, Math.min(1, remaining / Math.max(segment, 1)));
    trimmed.push({
      x: previous.x + (current.x - previous.x) * ratio,
      y: previous.y + (current.y - previous.y) * ratio,
    });
    break;
  }

  return trimmed.length >= 2 ? trimmed : points.slice(0, 2);
}

function perpendicularDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return pointDistance(point, start);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

function pathLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += pointDistance(points[index - 1], points[index]);
  }
  return length;
}

function straightness(points) {
  const length = pathLength(points);
  if (!length) return 0;
  return pointDistance(points[0], points[points.length - 1]) / length;
}

function totalTurn(points) {
  let total = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    total += turnAngle(points[index - 1], points[index], points[index + 1]);
  }
  return total;
}

function maxTurn(points) {
  let max = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    max = Math.max(max, turnAngle(points[index - 1], points[index], points[index + 1]));
  }
  return max;
}

function turnAngle(a, b, c) {
  const angleA = angleOf(b, a);
  const angleB = angleOf(b, c);
  let diff = Math.abs(angleA - angleB);
  if (diff > 180) diff = 360 - diff;
  return Math.abs(180 - diff);
}

function principalAngle(points) {
  const start = points[0];
  const end = points[points.length - 1];
  const angle = angleOf(start, end);
  return angle > 180 ? angle - 180 : angle;
}

function angleOf(start, end) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  return (angle + 360) % 360;
}

function angleDistanceToGrid(angle) {
  const normalized = ((angle % 90) + 90) % 90;
  return Math.min(normalized, 90 - normalized);
}

function midpoint(points) {
  return points[Math.floor(points.length / 2)] ?? points[0] ?? { x: 0, y: 0 };
}

function averagePoint(points) {
  return points.reduce(
    (total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roundPoint(value) {
  return Math.round(value * 100) / 100;
}

function uniqueText(values) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function uniqueNumbers(values) {
  return Array.from(new Set(values.map((value) => Number(value)).filter(Number.isFinite)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
