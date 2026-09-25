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
  filmStarts: Record<string, FilmStartDecision>;
};

export type Counts = { ties: number; places: number; placeTies: number; bios: number; profiles: number; attract: number; filmStarts: number };
export type GitState = { clean: boolean; unpushed: number | null };

export type Review = {
  ties: Tie[];
  places: Place[];
  bios: Bio[];
  profiles: Profile[];
  kinds: Kind[];
  attract: AttractWords;
  filmStarts: FilmStart[];
  /** What still stands between the exhibit and opening day, from the records. */
  readiness: ReadinessLine[];
  limits: { label: number; headline: number; tagline: number; placeHistory: number };
  roles: Role[];
  draft: Draft;
  counts: Counts;
  git: GitState;
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
