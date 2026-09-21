#!/usr/bin/env python3
"""Inspect an extracted CIHOF public deployment without executing application code.

Usage:
  python tools/inspect_deployment.py --site-root /path/to/extracted/site --out evidence/deployment_inventory.json
The root must contain index.html and data/. This is a static inventory, not a
browser, accessibility, security, rights, or physical-installation certification.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def values(value: Any) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.values())
    return []


def inspect(root: Path) -> dict:
    root = root.resolve()
    if not (root / 'index.html').is_file():
        raise ValueError(f'No index.html in site root: {root}')
    data = root / 'data'
    def read(name: str):
        with (data / name).open(encoding='utf-8') as stream:
            return json.load(stream)
    people = read('inductees.json')
    if not isinstance(people, list):
        raise ValueError('Expected inductees.json to be an array')
    bundle = read('cihof-runtime-data.json')
    relationships = read('relationships.json')
    entities = read('entities.json').get('entities', [])
    edges = read('entity-relationships.json').get('relationships', [])
    media = values(read('media-manifest.json').get('assets', {}))
    primary = [item['images']['primary'] for item in media if item.get('images', {}).get('primary')]
    gallery = [image for item in media for image in item.get('images', {}).get('gallery', [])]
    images = primary + gallery
    records = values(read('story-sections.json').get('records', {}))
    approved_beats = []
    for record in records:
        if record.get('provenance') not in ('curated', 'documented'):
            continue
        for beat in record.get('beats', []):
            # Mirrors the inspected interpretiveModel publication conditions.
            if (beat.get('provenance') != 'inferred'
                and beat.get('contextScope') == 'cleveland'
                and beat.get('reviewStatus') == 'approved'
                and str(beat.get('sourceReference', '')).strip()):
                approved_beats.append(beat)
    leads = read('archive-leads.json').get('records', [])
    def cleared(lead: dict) -> bool:
        url = urlparse(str(lead.get('sourceUrl', '')))
        return (lead.get('status') == 'visitor-ready'
                and lead.get('visibility') == 'visitor-ready'
                and bool(str(lead.get('rightsNote', '')).strip())
                and url.scheme in ('http', 'https') and bool(url.netloc)
                and lead.get('approvedForPublicWeb') is True)
    def exists_local(asset: dict) -> bool:
        path = str(asset.get('runtimePath', ''))
        if not path or urlparse(path).scheme:
            return False
        candidate = (root / path.lstrip('/')).resolve()
        return candidate.is_relative_to(root) and candidate.is_file()
    files = [p for p in root.rglob('*') if p.is_file()]
    hashes = {}
    for name in ['build-info.json', 'cihof-runtime-data.json', 'inductees.json',
                 'relationships.json', 'entities.json', 'entity-relationships.json',
                 'media-manifest.json', 'places.json', 'story-sections.json', 'archive-leads.json']:
        raw = (data / name).read_bytes()
        hashes[f'data/{name}'] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    return {
        'method': 'Static inspection of extracted deployment. No application code executed.',
        'build': read('build-info.json'),
        'collection': {
            'inductees': len(people),
            'valid_id_and_name': sum(bool(str(p.get('id','')).strip() and str(p.get('name','')).strip()) for p in people),
            'induction_classes': sorted({p['classYear'] for p in people if isinstance(p.get('classYear'), int)}),
            'workflow_approval_status_values': dict(Counter(p.get('approvalStatus') for p in people)),
            'country_tag_source_values': dict(Counter(p.get('countryTagsSource') for p in people)),
            'community_tag_source_values': dict(Counter(p.get('communityTagsSource') for p in people)),
            'community_vocabulary': sorted({t for p in people for t in p.get('communityTags', [])}),
            'heritage_field_unique_terms': len({t for p in people for t in p.get('countryTags', [])}),
        },
        'relationships': {
            'explicit_records': len(relationships),
            'bundle_explicit_records': len(bundle.get('relationships', [])),
            'public_entities': len(entities),
            'entity_types': dict(Counter(e.get('type') for e in entities)),
            'public_generated_edges': len(edges),
            'generated_edge_types': dict(Counter(e.get('type') for e in edges)),
            'note': 'Generated membership, theme, induction, and media edges are not direct person-to-person collaboration evidence.'
        },
        'interpretation': {
            'place_starters': len(read('places.json').get('places', [])),
            'story_records': len(records),
            'story_beats': sum(len(r.get('beats', [])) for r in records),
            'cleveland_beats_passing_current_display_gate': len(approved_beats),
            'archive_leads': len(leads),
            'archive_leads_passing_public_display_gate': sum(cleared(r) for r in leads),
        },
        'media': {
            'person_records': len(media),
            'primary_image_references': len(primary),
            'gallery_image_references': len(gallery),
            'all_image_runtime_files_exist': all(exists_local(a) for a in images),
            'image_runtime_files_found': sum(exists_local(a) for a in images),
            'image_rights_status': dict(Counter(a.get('rightsStatus') for a in images)),
            'image_approved_for_kiosk': dict(Counter(str(a.get('approvedForKiosk')) for a in images)),
            'image_public_approval_field_present': sum('approvedForPublicWeb' in a for a in images),
            'shipped_video_records': sum(len(r.get('videos', [])) for r in media),
            'note': 'Existing fields are metadata, not a new rights determination. No public image clearance has been granted by this audit.'
        },
        'artifact': {
            'total_bytes': sum(p.stat().st_size for p in files),
            'files': len(files),
            'extensions': dict(Counter(p.suffix.lower() or '[none]' for p in files)),
            'source_curation_has_records': 'records' in bundle.get('sourceCuration', {}),
            'unpublished_story_beats_retained_in_bundle': sum(
                len(r.get('beats', [])) for r in values(bundle.get('storySections', {}).get('records', {}))
            ) - len(approved_beats),
            'archive_leads_not_public_display_eligible_retained_in_bundle': sum(
                not cleared(r) for r in bundle.get('archiveLeads', {}).get('records', [])
            ),
        },
        'inspected_file_hashes': hashes,
        'not_performed': ['browser interaction tests', 'visual rendering review', 'performance profiling',
                          'service-worker/offline runtime tests', 'screen reader testing',
                          'touchscreen or physical installation testing', 'new rights or curator approval'],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-root', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    try:
        result = inspect(args.site_root)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, f'Inspection failed: {exc}\n')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(args.out)

if __name__ == '__main__':
    main()
