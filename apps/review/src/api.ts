export type Person = {
  id: string;
  name: string;
  classYear: number | null;
  portrait: string | null;
  biography: string;
};

export type Tie = {
  tieId: string;
  a: Person;
  b: Person;
  sourceType: string;
  suggestedKind: string;
  verificationLayer: string;
  evidence: string[];
  sourceUrls: string[];
  status: string;
  current: { decision: string; kind: string; label: string; inverseLabel: string; reversed: boolean } | null;
  wordingProblem: string | null;
  suggestion: (TieDecision & { because?: string }) | null;
};

export type Place = {
  placeId: string;
  name: string;
  neighborhood: string;
  address: string;
  dates: string;
  shortHistory: string;
  canApprove: boolean;
  reviewed: boolean;
  /** What approving the words shown records. */
  contentVersion: string;
  /** For a reviewed place: whether its approval covers these words. */
  words: 'current' | 'legacy' | 'changed' | null;
  /** A plainer wording drafted from these words, adding nothing, or null. */
  suggestion: string | null;
  ties: { person: Person; harvested: string; role: string | null }[];
};

export type Bio = {
  id: string;
  name: string;
  classYear: string;
  portrait: string | null;
  provenance: string;
  text: string;
};

export type Text = { text: string; provenance: string };

export type Profile = {
  id: string;
  name: string;
  classYear: number | null;
  portrait: { src: string; alt: string; shown: boolean; rights: string } | null;
  biography: Text | null;
  contribution: Text | null;
  context: Text | null;
  tags: { contributions: string[]; communities: string[]; countries: string[] };
  presentedBy: string | null;
  sourceUrl: string | null;
  contentVersion: string;
  state: 'unreviewed' | 'approved' | 'changed-since-approval' | 'changes-requested';
  reviewNote: string;
};

export type ProfileDecision = { decision: 'approve' | 'changes'; seenVersion: string; note?: string };

/** The attract screen's words, as they stand. */
export type AttractWords = {
  headline: string;
  tagline: string;
  contentVersion: string;
  approved: boolean;
  problem: string | null;
  reviewedAt: string | null;
};

export type AttractDecision =
  | { decision: 'approve'; seenVersion: string; note?: string }
  | { decision: 'reword'; headline: string; tagline: string; note?: string };

/** A curated tour, whether it is approved, and who it visits now. */
export type Tour = {
  tourId: string;
  label: string;
  prompt: string;
  description: string;
  terms: string[];
  themes: string[];
  /** Names of the people always first, and never included. */
  pinned: string[];
  excluded: string[];
  /** Its words and rules as stored, which the tour editor starts from. */
  changes: TourChanges;
  /** What approving the tour as shown records. */
  contentVersion: string;
  state: 'approved' | 'changed-since-approval' | 'draft';
  /** Where its approval lets it be shown now. */
  shownOn: { kiosk: boolean; publicWeb: boolean };
  reviewedAt: string | null;
  people: TourPerson[];
};

export type TourPerson = { id: string; name: string; classYear: number | null; portrait: string | null };

/** What the tour editor changes: a tour's words, and the rules that choose its people. */
export type TourChanges = {
  label: string;
  prompt: string;
  description: string;
  terms: string[];
  themes: string[];
  /** Always first, in this order. */
  pinnedPersonIds: string[];
  /** Never in the tour. */
  excludedPersonIds: string[];
  maxPortraits: number;
};

export type TourDecision =
  | { decision: 'approve'; seenVersion: string; audience: Audience; note?: string }
  | { decision: 'withdraw'; note?: string }
  /**
   * `seenVersion` is the tour the editing began from. An audience approves it
   * as edited; `nobody` leaves it a draft for somebody else to approve; null
   * is not yet chosen, and the edit cannot be saved until it is.
   */
  | { decision: 'edit'; seenVersion: string; changes: TourChanges; audience: Audience | 'nobody' | null; note?: string }
  /** Out of the records altogether; `seenVersion` is the tour the reviewer chose to delete. */
  | { decision: 'delete'; seenVersion: string; note?: string }
  /** A new tour, kept under the name it was given when first kept; its audience as for an edit. */
  | { decision: 'create'; changes: TourChanges; audience: Audience | 'nobody' | null; note?: string };

/** A tour as an edit would leave it. */
export type TourPreview = { contentVersion: string; changed: boolean; problems: string[]; people: TourPerson[] };

export async function previewTour(tourId: string, changes: TourChanges, creating = false): Promise<TourPreview> {
  return request('/api/tours/preview', { method: 'POST', body: JSON.stringify({ tourId, changes, creating }) });
}

/** A film, whose it is, what it is called on the display, and its YouTube title as a suggestion. */
export type FilmTitle = {
  filmId: string;
  people: string[];
  poster: string | null;
  durationSeconds: number | null;
  /** Its approved title, or null: it is described by its length. */
  approvedTitle: string | null;
  /** Its title on YouTube, collected and unreviewed. */
  suggestion: { title: string; uploader: string; url: string } | null;
};

export type FilmTitleDecision =
  | { decision: 'approve'; title: string; note?: string }
  | { decision: 'clear'; note?: string };

/** Someone whose film is a ceremony shared with others, and where it opens. */
export type FilmStart = {
  key: string;
  personId: string;
  name: string;
  portrait: string | null;
  filmId: string;
  durationSeconds: number | null;
  sharedWith: number;
  /** The approved second it opens at now, or null for the beginning. */
  approvedSeconds: number | null;
  /** Where the captions suggest their part begins, with what is said there. */
  suggestion: { seconds: number; reason: string; context: { t: number; words: string }[] } | null;
};

export type FilmStartDecision =
  | { decision: 'start'; seconds: number; note?: string }
  | { decision: 'beginning'; note?: string };

export type ReadinessLine = { group: string; title: string; done: number; total: number; open: number; where: string };

/** A sign-off, what accepting it confirms, and whether it is signed. */
export type Signoff = {
  id: string;
  title: string;
  who: string;
  where: string;
  /** The lines of docs/sign-off.md the person confirms, if it is a section of it. */
  confirms: string[];
  /** A question the acceptance must answer in its note. */
  asks?: string;
  /** Sign-offs that must be signed before this one. */
  requires?: string[];
  signed: { by: string; date: string; reference: string; scan?: string; note?: string } | null;
};

/** Accepted by `by`, the reviewer's own name, on `date`, the day they pressed Accept. */
export type SignoffDecision =
  | { action: 'accept'; by: string; date: string; note?: string }
  | { action: 'clear'; note: string };

export type FixPreview = { transcriptCount: number; captionCount: number; examples: { before: string; after: string }[] };

/** A film, whose it is, and the noise found in its words. */
export type Film = { filmId: string; people: string[]; copies: number; music: FixPreview; blank: FixPreview };

export type FilmFix = { filmId: string; fix: 'music' | 'blank' | 'phrase'; find?: string; replaceWith: string; note?: string };

export type PlaceDecision =
  | { approve: true; seenVersion: string; history?: string; note?: string }
  | { approve: false; note?: string };

export type Kind = { kind: string; label: string; directional: boolean; example: string; inverse?: string; sentence?: string };
export type Role = { role: string; label: string };

export type TieDecision = {
  decision: 'relationship' | 'context' | 'reject';
  kind?: string;
  direction?: 'a-to-b' | 'b-to-a';
  label?: string;
  inverseLabel?: string;
  note?: string;
};

export type Draft = {
  reviewer: string;
  ties: Record<string, TieDecision>;
  /**
   * `approve: true` with the version of the words seen, and `history` when the
   * reviewer wrote their own; `approve: false` is "not yet".
   */
  places: Record<string, PlaceDecision>;
  placeTies: Record<string, { role: string; note?: string }>;
  bios: Record<string, { correctedText?: string; useSourceText?: boolean; note?: string }>;
  profiles: Record<string, ProfileDecision>;
  attract: Record<string, AttractDecision>;
  tours: Record<string, TourDecision>;
  filmTitles: Record<string, FilmTitleDecision>;
  filmStarts: Record<string, FilmStartDecision>;
  signoffs: Record<string, SignoffDecision>;
  filmFixes: Record<string, FilmFix>;
};

export type Counts = { ties: number; places: number; placeTies: number; bios: number; profiles: number; attract: number; tours: number; filmTitles: number; filmStarts: number; signoffs: number; filmFixes: number };
export type GitState = { clean: boolean; unpushed: number | null };

export type Review = {
  ties: Tie[];
  places: Place[];
  bios: Bio[];
  profiles: Profile[];
  kinds: Kind[];
  attract: AttractWords;
  tours: Tour[];
  /** Everyone a tour may visit. */
  tourPeople: TourPerson[];
  /** Where a new tour starts. */
  blankTour: TourChanges;
  /** Every name a tour already has, so a new one takes another. */
  tourIds: string[];
  filmTitles: FilmTitle[];
  filmStarts: FilmStart[];
  /** What still stands between the exhibit and opening day, from the records. */
  readiness: ReadinessLine[];
  signoffs: Signoff[];
  films: Film[];
  limits: {
    label: number; headline: number; tagline: number; placeHistory: number; filmTitle: number;
    tour: { label: number; prompt: number; description: number; term: number; terms: number; maxPortraits: number };
  };
  roles: Role[];
  draft: Draft;
  counts: Counts;
  git: GitState;
  /** `commit` in the project; `export` in the staff review app on a staff computer, which writes a file for the developer. */
  mode: 'commit' | 'export';
};

export type StepResult = { task: string; title: string; ok: boolean; count?: number; commit?: string | null; output: string };
export type Audience = 'kiosk' | 'kiosk-and-web';

export async function loadReview(): Promise<Review> {
  return request('/api/review');
}

export async function putDraft(draft: Draft): Promise<{ counts: Counts }> {
  return request('/api/draft', { method: 'PUT', body: JSON.stringify(draft) });
}

export async function checkDecisions(audience: Audience): Promise<{ results: StepResult[] }> {
  return request('/api/check', { method: 'POST', body: JSON.stringify({ audience }) });
}

export type ExportOutcome = { ok: boolean; results: StepResult[]; file: string | null; problem?: string; counts: Counts };

export async function exportDecisions(audience: Audience): Promise<ExportOutcome> {
  return request('/api/export', { method: 'POST', body: JSON.stringify({ audience }) });
}

/** Only in the staff review app: shows an exported file in the computer's own file browser. */
export function showExportedFile(file: string) {
  (window as unknown as { cihofReview?: { showExport?: (path: string) => void } }).cihofReview?.showExport?.(file);
}

export const canShowFiles = () => Boolean((window as unknown as { cihofReview?: { showExport?: unknown } }).cihofReview?.showExport);

export async function saveDecisions(audience: Audience): Promise<{ results: StepResult[]; counts: Counts; git: GitState }> {
  return request('/api/save', { method: 'POST', body: JSON.stringify({ audience }) });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } });
  const value = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) throw new Error((value as { error?: string }).error ?? response.statusText);
  return value as T;
}

export function tieKey(placeId: string, personId: string): string {
  return `${placeId}|${personId}`;
}

/** What a caption fix would change, read from the film's files. */
export async function previewFilmFix(fix: FilmFix): Promise<FixPreview> {
  return request('/api/films/preview', { method: 'POST', body: JSON.stringify(fix) });
}

export const filmFixKey = (fix: Pick<FilmFix, 'filmId' | 'fix' | 'find'>) => `${fix.filmId}|${fix.fix}|${fix.find ?? ''}`;
