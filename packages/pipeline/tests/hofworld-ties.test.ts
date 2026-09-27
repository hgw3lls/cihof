import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { mergePlaceAssociations, type PlaceAssociationSeed } from '../src/sources/hofworld.ts';

/**
 * Re-importing HOF_WORLD must not undo a curator's work.
 *
 * Every tie the archive supplies has no role and no review. The import used to
 * write that list over `data/cihof_place_associations.json`, which erased every
 * approved role in one step and reported it as a successful import.
 */

const approved = {
  id: 'edge:8a74bc52cac2d3',
  person: 'leo-weidenthal-2010',
  place: 'place:cleveland-cultural-gardens',
  kind: 'associated_with_place',
  role: 'founded',
  evidence: [{ id: 'edge:8a74bc52cac2d3:src0', title: 'Curator-written evidence.', kind: 'secondary-source' }],
  verificationLayer: 'curated',
  review: {
    status: 'approved',
    decisionReference: 'place-roles-review-2026-09-24',
    contentVersion: 'places-v1',
    reviewedAt: '2026-09-24T23:37:39.138Z',
    note: 'Reviewed in the staff review app.',
  },
  publication: { publicWeb: false, kiosk: true },
};

function seed(id: string, person: string, place: string): PlaceAssociationSeed {
  return { id, person, place, kind: 'associated_with_place', role: null, evidence: [{ text: 'harvested', sourceUrls: [] }], verificationLayer: 'harvested' };
}

test('a held tie is kept as it is and only unheld ids are added', () => {
  const incoming = [
    seed(approved.id, approved.person, approved.place),
    seed('edge:new', 'alex-machaskee-2010', 'place:cleveland-ohio'),
    seed('edge:new', 'alex-machaskee-2010', 'place:cleveland-ohio'),
  ];
  const merged = mergePlaceAssociations([approved], incoming);
  assert.equal(merged.held, 1);
  assert.deepEqual(merged.added.map((tie) => tie.id), ['edge:new'], 'a duplicate archive id is added once');
  assert.deepEqual(merged.associations[0], approved, 'role, review and evidence untouched');
  assert.equal(merged.associations.length, 2);
});

test('a held tie the archive no longer has is not dropped', () => {
  const merged = mergePlaceAssociations([approved], []);
  assert.deepEqual(merged.associations, [approved]);
  assert.equal(merged.added.length, 0);
});

const repoRoot = resolve(import.meta.dirname, '../../..');

test('ingest-hofworld --apply keeps an approved tie through a re-import', () => {
  const work = mkdtempSync(resolve(tmpdir(), 'cihof-ingest-'));
  try {
    const repo = resolve(work, 'repo');
    const archive = resolve(work, 'HOF_WORLD');
    for (const path of ['scripts/ingest-hofworld.js', 'scripts/working-tree.js', 'packages/pipeline/src/sources/hofworld.ts']) {
      mkdirSync(dirname(resolve(repo, path)), { recursive: true });
      cpSync(resolve(repoRoot, path), resolve(repo, path));
    }
    const write = (path: string, value: unknown) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    };

    const place = { id: 'place:cleveland-cultural-gardens', name: 'Cleveland Cultural Gardens', type: 'cultural_garden', shortHistory: 'A history.', neighborhood: 'University Circle' };
    write(resolve(repo, 'data/cihof_curated_metadata.json'), { inductees: {} });
    write(resolve(repo, 'data/cihof_places.json'), { places: [place] });
    write(resolve(repo, 'data/cihof_places_removed.json'), { removed: [{ id: 'place:akron-ohio' }] });
    const heldDoc = { schemaVersion: 1, source: 'HOF_WORLD v3 edges/edges.json', generatedAt: '2026-09-23T02:34:42.562Z', note: 'Unreviewed.', associations: [approved] };
    write(resolve(repo, 'data/cihof_place_associations.json'), heldDoc);

    const person = (legacyId: string) => ({ legacyId, id: `person:${legacyId}`, changed: false });
    write(resolve(archive, '_meta/id-map.json'), { people: [person('leo-weidenthal-2010'), person('alex-machaskee-2010')] });
    write(resolve(archive, 'app/curated-metadata.json'), { inductees: {} });
    write(resolve(archive, 'core/places.json'), { places: [place, { id: 'place:akron-ohio', name: 'Akron' }] });
    const edge = (id: string, subject: string, object: string) => ({ id, type: 'associated_with_place', subject, object, evidence: [], verification: { layer: 'harvested' } });
    write(resolve(archive, 'edges/edges.json'), { edges: [
      edge(approved.id, 'person:leo-weidenthal-2010', approved.place),
      edge('edge:new', 'person:alex-machaskee-2010', 'place:cleveland-cultural-gardens'),
      edge('edge:removed', 'person:alex-machaskee-2010', 'place:akron-ohio'),
    ] });

    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', ...args], { cwd: repo, stdio: 'pipe' });
    git('init', '-q');
    git('add', '.');
    git('commit', '-qm', 'fixture');

    const run = (...extra: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/ingest-hofworld.js', `--archive=${archive}`, ...extra], { cwd: repo, encoding: 'utf8' });

    const dry = run();
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /already held here\s+1 \(1 approved\)/);
    assert.match(dry.stdout, /would add, unreviewed\s+1\n/);
    assert.deepEqual(JSON.parse(readFileSync(resolve(repo, 'data/cihof_place_associations.json'), 'utf8')), heldDoc, 'a dry run writes nothing');

    const applied = run('--apply');
    assert.equal(applied.status, 0, applied.stderr);
    const after = JSON.parse(readFileSync(resolve(repo, 'data/cihof_place_associations.json'), 'utf8'));
    assert.deepEqual(after.associations[0], approved, 'the approved tie survives with its role and review');
    assert.deepEqual(after.associations.map((tie: { id: string }) => tie.id), [approved.id, 'edge:new'], 'removed places stay skipped');
    assert.equal(after.associations[1].role, null);
    assert.equal(after.associations[1].review, undefined);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
