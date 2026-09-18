import type { Link } from './archiveModel';

export function layoutLinks(centerId: string, links: Link[], width: number, height: number): {
  points: Map<string, { x: number; y: number }>;
  scale: number;
};
