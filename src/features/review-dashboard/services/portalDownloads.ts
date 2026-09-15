import type { Inductee } from '../../../data/types';
import type { DraftMap } from './portalDrafts';
import type {
  CurationReport,
  MediaManifest,
  MediaReport,
} from './portalReports';
import {
  buildReviewCsv,
  dateStamp,
} from '../models/portalReviewModel';

export function downloadReviewQueue(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, drafts: DraftMap, queue: string) {
  if (inductees.length === 0) {
    window.alert('There are no rows to export for this queue.');
    return;
  }
  const csv = buildReviewCsv(inductees, curation, media, manifest, drafts);
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cihof-${queue}-review-queue-${dateStamp()}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
