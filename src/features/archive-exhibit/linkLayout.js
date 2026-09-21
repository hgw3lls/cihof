import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation } from 'd3-force';

export function layoutLinks(centerId, links, width, height) {
  const scale = Math.min(2.1, Math.max(0.85, height / 760));
  const center = { x: width / 2, y: height / 2 };
  const outer = Math.min(330 * scale, width / 2 - 85 * scale, height / 2 - 85 * scale);
  const inner = Math.min(210 * scale, outer - 70 * scale);
  const counts = { documented: links.filter((link) => link.kind === 'documented').length, class: links.filter((link) => link.kind === 'class').length };
  const sequence = { documented: 0, class: 0 };
  const nodes = [{ id: centerId, kind: 'center', x: center.x, y: center.y, fx: center.x, fy: center.y }];
  for (const link of links) {
    const radius = link.kind === 'documented' ? inner : outer;
    const angle = -Math.PI / 2 + (sequence[link.kind]++ / counts[link.kind]) * Math.PI * 2 + (link.kind === 'documented' ? 0.36 : 0);
    nodes.push({ id: link.person.id, kind: link.kind, x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  }
  const edges = links.map((link) => ({ source: centerId, target: link.person.id, kind: link.kind }));
  forceSimulation(nodes)
    .force('link', forceLink(edges).id((node) => node.id).distance((edge) => edge.kind === 'documented' ? inner : outer).strength(0.2))
    .force('collide', forceCollide((node) => (node.kind === 'center' ? 166 : node.kind === 'documented' ? 90 : 78) * scale).iterations(3))
    .force('charge', forceManyBody().strength((node) => node.kind === 'center' ? -170 * scale : -55 * scale))
    .force('radial', forceRadial((node) => node.kind === 'documented' ? inner : outer, center.x, center.y).strength((node) => node.kind === 'center' ? 0 : 0.14))
    .stop().tick(280);
  const points = new Map();
  for (const node of nodes) {
    const margin = (node.kind === 'center' ? 166 : node.kind === 'documented' ? 90 : 78) * scale;
    points.set(node.id, {
      x: Math.max(margin, Math.min(width - margin, node.x)),
      y: Math.max(margin, Math.min(height - margin, node.y)),
    });
  }
  return { points, scale };
}
