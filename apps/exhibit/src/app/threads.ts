import type { RuntimePerson } from '../data/runtime.ts';

/**
 * Threads: walks through Connections that visitors saved, kept on the display
 * for the visitors after them, and offered beside the curated tours.
 *
 * A thread is named for where it starts and ends, and nobody types a name:
 * words a visitor typed would be shown to every visitor after them, with no
 * one to read them first. A thread holds only people in this release; one
 * whose people have gone is dropped rather than shown half empty.
 */
export type Thread = {
  readonly id: string;
  readonly name: string;
  readonly personIds: readonly string[];
  readonly created: string;
};

/** Where the display keeps them, in its own browser storage. */
export const threadsKey = 'cihof-wall-threads';
/** How many are kept; the oldest go first. */
export const threadLimit = 24;

export function threadName(people: readonly RuntimePerson[]): string {
  const first = people[0];
  const last = people[people.length - 1];
  return first && last ? `From ${first.name} to ${last.name}` : 'A thread';
}

export function loadThreads(byId: ReadonlyMap<string, RuntimePerson>): Thread[] {
  let stored: unknown;
  try { stored = JSON.parse(localStorage.getItem(threadsKey) ?? '[]'); } catch { return []; }
  if (!Array.isArray(stored)) return [];
  const threads: Thread[] = [];
  for (const entry of stored) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, personIds, created } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !Array.isArray(personIds)) continue;
    const people = personIds.filter((each): each is string => typeof each === 'string' && byId.has(each));
    if (people.length < 2) continue;
    // The name is made again from the people, never read back from storage.
    threads.push({ id, personIds: people, name: threadName(people.map((each) => byId.get(each)!)), created: typeof created === 'string' ? created : '' });
  }
  return threads.slice(0, threadLimit);
}

export function saveThreads(threads: readonly Thread[]) {
  // A display that cannot keep them still shows them for this visit.
  try { localStorage.setItem(threadsKey, JSON.stringify(threads.slice(0, threadLimit))); } catch { /* not kept */ }
}

export function sameThread(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
