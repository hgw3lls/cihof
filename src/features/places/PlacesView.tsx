import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { portraitImageUrl } from '../../data/portraitImages';
import type { Inductee, PlaceRecord, PlaceType } from '../../data/types';
import { usePlaces, usePlaceTypes } from '../../data/usePlaces';

type PlacesViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

const allPlaceTypes = 'all';
const typeLabels: Record<PlaceType, string> = {
  neighborhood: 'Neighborhoods',
  cultural_center: 'Cultural Centers',
  church: 'Churches',
  school: 'Schools',
  civic_building: 'Civic Buildings',
  cultural_garden: 'Cultural Gardens',
  business: 'Businesses',
  festival_location: 'Festival Locations',
  community_organization: 'Community Organizations',
  historic_address: 'Historic Addresses',
};
const singularTypeLabels: Record<PlaceType, string> = {
  neighborhood: 'Neighborhood',
  cultural_center: 'Cultural Center',
  church: 'Church',
  school: 'School',
  civic_building: 'Civic Building',
  cultural_garden: 'Cultural Garden',
  business: 'Business',
  festival_location: 'Festival Location',
  community_organization: 'Community Organization',
  historic_address: 'Historic Address',
};

export function PlacesView({ inductees, onSelect }: PlacesViewProps) {
  const { places, loading, error } = usePlaces();
  const placeTypes = usePlaceTypes(places);
  const [activeType, setActiveType] = useState<PlaceType | typeof allPlaceTypes>(allPlaceTypes);
  const [activeId, setActiveId] = useState('');

  const peopleById = useMemo(() => new Map(inductees.map((inductee) => [inductee.id, inductee])), [inductees]);
  const visiblePlaces = useMemo(
    () => places.filter((place) => activeType === allPlaceTypes || place.type === activeType),
    [activeType, places],
  );
  const activePlace = useMemo(() => {
    const scopedPlace = visiblePlaces.find((place) => place.id === activeId);
    return scopedPlace ?? visiblePlaces[0] ?? places[0] ?? null;
  }, [activeId, places, visiblePlaces]);
  const relatedPeople = useMemo(() => {
    if (!activePlace) return [];
    return (activePlace.related.people ?? [])
      .map((personId) => peopleById.get(personId))
      .filter((person): person is Inductee => Boolean(person))
      .slice(0, 8);
  }, [activePlace, peopleById]);

  useEffect(() => {
    if (!activeId && places.length > 0) setActiveId(places[0].id);
  }, [activeId, places]);

  useEffect(() => {
    if (activePlace && activePlace.id !== activeId) setActiveId(activePlace.id);
  }, [activeId, activePlace]);

  if (loading) {
    return (
      <section className="places-view places-view--loading" aria-label="Cleveland places">
        <div className="places-status">Loading Cleveland places</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="places-view places-view--loading" aria-label="Cleveland places">
        <div className="places-status">Places could not be loaded: {error}</div>
      </section>
    );
  }

  if (!activePlace) {
    return (
      <section className="places-view places-view--loading" aria-label="Cleveland places">
        <div className="places-status">No Cleveland places have been curated yet.</div>
      </section>
    );
  }

  return (
    <section className="places-view" aria-label="Cleveland places">
      <header className="places-view__header">
        <div>
          <p className="places-view__kicker">Places</p>
          <h2>Cleveland Map</h2>
        </div>
        <div className="places-view__summary" aria-label="Places summary">
          <span>{places.length} curated places</span>
          <span>{visiblePlaces.length} shown</span>
          <span>Offline map</span>
        </div>
      </header>

      <div className="places-filter" aria-label="Place categories">
        <button
          aria-pressed={activeType === allPlaceTypes}
          className={activeType === allPlaceTypes ? 'places-filter__button places-filter__button--active' : 'places-filter__button'}
          type="button"
          onClick={() => setActiveType(allPlaceTypes)}
        >
          All Places
        </button>
        {placeTypes.map((placeType) => (
          <button
            aria-pressed={activeType === placeType}
            className={activeType === placeType ? 'places-filter__button places-filter__button--active' : 'places-filter__button'}
            key={placeType}
            type="button"
            onClick={() => setActiveType(placeType)}
          >
            {typeLabels[placeType]}
          </button>
        ))}
      </div>

      <div className="places-view__layout">
        <div className="places-map" aria-label="Cleveland-centered map with curated place markers">
          <ClevelandMapSvg />
          <div className="places-map__markers" aria-label="Curated Cleveland place markers">
            {visiblePlaces.map((place) => (
              <button
                aria-pressed={activePlace.id === place.id}
                className={activePlace.id === place.id ? 'places-map__marker places-map__marker--active' : 'places-map__marker'}
                key={place.id}
                style={markerStyle(place)}
                type="button"
                onClick={() => setActiveId(place.id)}
              >
                <span className="places-map__marker-dot" aria-hidden="true" />
                <span className="places-map__marker-label">
                  <strong>{place.name}</strong>
                  <small>{singularTypeLabel(place.type)}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="place-panel" aria-live="polite" aria-label={`${activePlace.name} details`}>
          <p className="place-panel__kicker">{singularTypeLabel(activePlace.type)}</p>
          <h3>{activePlace.name}</h3>
          <div className="place-panel__facts">
            {activePlace.neighborhood && <span>{activePlace.neighborhood}</span>}
            {activePlace.address && <span>{activePlace.address}</span>}
            {activePlace.dateRange?.label && <span>{activePlace.dateRange.label}</span>}
          </div>
          <p className="place-panel__history">{activePlace.shortHistory}</p>

          <section className="place-panel__section" aria-labelledby="place-related-people">
            <h4 id="place-related-people">Related People</h4>
            {relatedPeople.length > 0 ? (
              <div className="place-people-grid">
                {relatedPeople.map((person) => (
                  <button className="place-person" key={person.id} type="button" onClick={() => onSelect(person)}>
                    <span className="place-person__imageWrap">
                      <FallbackImage
                        alt={person.imageAltText || person.name}
                        className="place-person__image"
                        fallbackClassName="place-person__fallback"
                        fallbackLabel={initials(person.name)}
                        src={portraitImageUrl(person, 'thumbnail')}
                      />
                    </span>
                    <span className="place-person__name">{person.name}</span>
                    <span className="place-person__meta">Class {person.classYear ?? 'TBD'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="place-panel__empty">No related people have been curated for this place yet.</p>
            )}
          </section>

          <PlaceList title="Related Communities" values={activePlace.related.communities ?? []} />
          <PlaceList title="Related Organizations" values={activePlace.related.organizations ?? []} />

          {activePlace.media && activePlace.media.length > 0 && (
            <section className="place-panel__section" aria-labelledby="place-archival-images">
              <h4 id="place-archival-images">Archival Images</h4>
              <div className="place-media-grid">
                {activePlace.media.map((media) => (
                  <figure className="place-media" key={media.url}>
                    <FallbackImage
                      alt={media.altText}
                      className="place-media__image"
                      fallbackClassName="place-media__fallback"
                      fallbackLabel="Image"
                      src={media.url}
                    />
                    {media.caption && <figcaption>{media.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          <footer className="place-panel__source">
            <span>{activePlace.provenance.confidence}</span>
            <span>{activePlace.provenance.note ?? activePlace.provenance.source}</span>
          </footer>
        </aside>
      </div>
    </section>
  );
}

function PlaceList({ title, values }: { title: string; values: string[] }) {
  return (
    <section className="place-panel__section" aria-labelledby={slugify(title)}>
      <h4 id={slugify(title)}>{title}</h4>
      {values.length > 0 ? (
        <div className="place-chip-list">
          {values.map((value) => (
            <span className="place-chip" key={value}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="place-panel__empty">No entries curated yet.</p>
      )}
    </section>
  );
}

function ClevelandMapSvg() {
  return (
    <svg className="places-map__svg" viewBox="0 0 1000 640" role="img" aria-label="Abstract local map of Cleveland">
      <rect className="places-map__lake" x="0" y="0" width="1000" height="145" />
      <path
        className="places-map__shore"
        d="M0 142 C95 122 175 132 270 116 C350 102 427 132 514 120 C606 108 692 86 793 104 C884 120 940 100 1000 92 L1000 640 L0 640 Z"
      />
      <path className="places-map__river" d="M446 135 C428 205 470 252 452 316 C436 376 388 416 408 493 C420 540 386 575 352 640" />
      <path className="places-map__road places-map__road--primary" d="M132 432 C248 392 332 372 456 380 C576 386 724 342 892 300" />
      <path className="places-map__road places-map__road--primary" d="M252 532 C382 494 500 486 628 506 C748 524 838 492 944 446" />
      <path className="places-map__road" d="M232 264 C356 244 468 242 592 260 C710 278 808 268 930 238" />
      <path className="places-map__road" d="M584 166 L574 612" />
      <path className="places-map__road" d="M348 196 L342 594" />
      <rect className="places-map__downtown" x="460" y="286" width="150" height="118" />
      <path className="places-map__parks" d="M688 168 C762 150 832 186 846 246 C860 307 820 372 742 382 C676 390 640 342 646 282 C650 226 640 184 688 168 Z" />
      <path className="places-map__parks" d="M596 492 C654 462 730 486 754 542 C778 598 728 634 662 624 C608 616 556 586 560 544 C562 520 574 504 596 492 Z" />
      <text className="places-map__label places-map__label--lake" x="34" y="72">Lake Erie</text>
      <text className="places-map__label" x="482" y="350">Downtown</text>
      <text className="places-map__label" x="674" y="266">Cultural Gardens</text>
      <text className="places-map__label" x="130" y="392">West Side</text>
      <text className="places-map__label" x="748" y="442">East Side</text>
      <text className="places-map__label" x="462" y="610">Cuyahoga River</text>
    </svg>
  );
}

function markerStyle(place: PlaceRecord) {
  return {
    left: `${place.marker.x}%`,
    top: `${place.marker.y}%`,
    '--place-label-x': `${place.marker.labelOffsetX ?? 12}px`,
    '--place-label-y': `${place.marker.labelOffsetY ?? -12}px`,
  } as CSSProperties;
}

function singularTypeLabel(type: PlaceType) {
  return singularTypeLabels[type] ?? type;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
