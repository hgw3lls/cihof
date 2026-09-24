import type { DocumentedRelationship, SharedContext, VisitorTarget } from '@cihof/content';
import { allowsTarget } from '@cihof/content';
import type { TieDecision } from '../sources/ties.ts';

/**
 * Turns reviewed tie decisions into the records the bundle carries.
 *
 * A relationship becomes a documented relationship with its review, its
 * publication and the corpus passages as citations, and then goes through
 * `publishedRelationships` like every other claim — nothing here decides
 * whether it is shown. A context decision becomes shared context, kept to the
 * audiences the decision named. A rejection becomes nothing, and only stops the
 * preview proposing the tie again.
 */
export function tieRelationships(decisions: readonly TieDecision[]): DocumentedRelationship[] {
  return decisions
    .filter((decision) => decision.decision === 'relationship')
    .map((decision) => ({
      claim: 'documented',
      id: `tie:${decision.corpusIds[0] ?? decision.tieId}` as DocumentedRelationship['id'],
      from: decision.personA as DocumentedRelationship['from'],
      to: decision.personB as DocumentedRelationship['to'],
      kind: decision.kind as DocumentedRelationship['kind'],
      label: decision.label ?? '',
      ...(decision.inverseLabel ? { inverseLabel: decision.inverseLabel } : {}),
      review: {
        status: 'approved',
        decisionReference: decision.decisionReference,
        contentVersion: decision.contentVersion,
        reviewedAt: decision.reviewedAt,
        ...(decision.note ? { note: decision.note } : {}),
      },
      publication: decision.publication,
      evidence: decision.evidence.map((excerpt, index) => {
        const url = decision.sourceUrls[index] ?? decision.sourceUrls[0];
        return {
          id: `corpus:${decision.corpusIds[index] ?? decision.corpusIds[0] ?? decision.tieId}`,
          title: `HOF World corpus (${decision.verificationLayer || 'unstated layer'})`,
          kind: 'collection-record' as const,
          excerpt,
          ...(url ? { url } : {}),
        };
      }),
    }));
}

export function tieContexts(decisions: readonly TieDecision[], target: VisitorTarget): SharedContext[] {
  return decisions
    .filter((decision) => decision.decision === 'context' && allowsTarget(decision.publication, target))
    .map((decision) => ({
      claim: 'context',
      id: `context:${decision.corpusIds[0] ?? decision.tieId}` as SharedContext['id'],
      between: [decision.personA, decision.personB] as unknown as SharedContext['between'],
      basis: 'appeared-together',
      value: decision.sourceType,
      statement: decision.label ?? '',
    }));
}

/** Every corpus row somebody has decided, so the preview stops proposing it. */
export function decidedCorpusIds(decisions: readonly TieDecision[]): Set<string> {
  return new Set(decisions.flatMap((decision) => decision.corpusIds));
}
