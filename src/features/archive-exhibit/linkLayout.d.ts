import type { LinkNode } from './archiveModel';

export function layoutLinks(centerId: string, links: LinkNode[], width: number, height: number): {
  points: Map<string, { x: number; y: number }>;
  scale: number;
};
