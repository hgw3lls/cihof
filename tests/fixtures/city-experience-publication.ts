import type {
  AffiliationAssertion,
  ContentReview,
  EntityDateRange,
  EvidenceReference,
  PublicationTargets,
} from '../../src/data/types';

export const fixtureIds = {
  alpha: 'fixture-person-alpha',
  beta: 'fixture-person-beta',
  place: 'place:fixture-civic-hall',
};

export const approvedReview: ContentReview = {
  status: 'approved',
  decisionReference: 'fixture-decision-001',
  contentVersion: 'fixture-v1',
};

export const needsReview: ContentReview = { status: 'needs-review', contentVersion: 'fixture-v1' };
export const publicAndKiosk: PublicationTargets = { publicWeb: true, kiosk: true };
export const kioskOnly: PublicationTargets = { publicWeb: false, kiosk: true };

export const fixtureEvidence: EvidenceReference = {
  id: 'fixture-evidence-001',
  title: 'Fixture collection record',
  kind: 'collection-record',
  localCitation: 'Fixture collection, box 1, folder 2',
  locator: 'page 3',
};

export const fixtureDateRanges: EntityDateRange[] = [
  { start: '1954', end: '1958', precision: 'bounded-interval', sourceScope: 'Fixture evidence' },
  { label: 'about 1970', precision: 'approximate-interval', uncertain: true, sourceScope: 'Fixture evidence' },
  { precision: 'unknown', sourceScope: 'No date in fixture source' },
];

export const fixtureAffiliations: AffiliationAssertion[] = [
  {
    id: 'fixture-affiliation-cultural',
    personId: fixtureIds.alpha,
    entityId: 'community:fixture-cultural',
    vocabularyKind: 'heritage-cultural-community',
    sourceWording: 'Fixture Cultural Association',
    evidence: [fixtureEvidence],
    provenance: 'documented',
    review: approvedReview,
    publication: publicAndKiosk,
  },
  {
    id: 'fixture-affiliation-organization',
    personId: fixtureIds.alpha,
    entityId: 'organization:fixture-service-league',
    vocabularyKind: 'organizational-affiliation',
    sourceWording: 'Fixture Service League',
    evidence: [fixtureEvidence],
    provenance: 'documented',
    review: approvedReview,
    publication: publicAndKiosk,
  },
];

export const fixtureStoryDocument = {
  schemaVersion: 2,
  records: {
    [fixtureIds.alpha]: {
      inducteeId: fixtureIds.alpha,
      provenance: 'documented',
      curatorNotes: ['Fixture-only staff note'],
      beats: [
        {
          id: 'fixture-public-beat',
          headline: 'A documented fixture action',
          body: 'Fixture wording remains unchanged.',
          provenance: 'documented',
          review: approvedReview,
          publication: publicAndKiosk,
          evidence: [fixtureEvidence],
          relatedPersonId: fixtureIds.beta,
          relatedEntityIds: [fixtureIds.place],
          dateRange: fixtureDateRanges[0],
        },
        {
          id: 'fixture-kiosk-beat',
          headline: 'A kiosk-only fixture action',
          body: 'Kiosk fixture wording.',
          provenance: 'documented',
          review: approvedReview,
          publication: kioskOnly,
          evidence: [fixtureEvidence],
          dateRange: fixtureDateRanges[1],
        },
        {
          id: 'fixture-withheld-beat',
          headline: 'A withheld fixture action',
          body: 'This must not publish.',
          provenance: 'documented',
          review: { status: 'withheld', contentVersion: 'fixture-v1' },
          publication: publicAndKiosk,
          evidence: [fixtureEvidence],
          dateRange: fixtureDateRanges[2],
        },
      ],
    },
  },
};

export const fixturePlacesDocument = {
  schemaVersion: 2,
  places: [
    {
      id: fixtureIds.place,
      name: 'Fixture Civic Hall',
      geometry: { kind: 'schematic', coordinateSystem: 'fixture-grid-v1', x: 30, y: 40 },
      review: approvedReview,
      publication: publicAndKiosk,
    },
    {
      id: 'place:fixture-draft',
      name: 'Fixture Draft Place',
      geometry: { kind: 'geographic-point', longitude: -81.69, latitude: 41.5 },
      review: needsReview,
      publication: publicAndKiosk,
    },
  ],
};
