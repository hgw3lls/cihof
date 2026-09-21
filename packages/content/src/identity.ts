/**
 * Identity is by canonical id only.
 *
 * Names are never used to match people. Two inductees may share a name, a name
 * may be recorded differently in two sources, and the harvested roster carries
 * suffixed variants such as "Arnie de la Porte – 2016" for the same person.
 * Matching on any of that manufactures identity the sources do not assert.
 */

const personEntityPrefix = 'person:';

/** A canonical inductee id, e.g. `alex-machaskee-2010`. */
export type InducteeId = string & { readonly __brand: 'InducteeId' };

/** A canonical entity id, e.g. `person:alex-machaskee-2010`. */
export type PersonEntityId = string & { readonly __brand: 'PersonEntityId' };

export function isInducteeId(value: unknown): value is InducteeId {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

export function personEntityId(id: InducteeId): PersonEntityId {
  return `${personEntityPrefix}${id}` as PersonEntityId;
}

export function inducteeIdFromEntityId(value: string): InducteeId | null {
  if (!value.startsWith(personEntityPrefix)) return null;
  const id = value.slice(personEntityPrefix.length);
  return isInducteeId(id) ? (id as InducteeId) : null;
}
