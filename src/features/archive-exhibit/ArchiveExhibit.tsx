import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { buildInfo } from '../../app/buildInfo';
import { entryInvitation } from '../../config/exhibitCopy';
import { matchesAdminHotkey, readKioskSettings, subscribeKioskSettings } from '../../app/kioskSettings';
import { stopAllMedia } from '../../app/mediaControl';
import { useColorMode } from '../../app/useColorMode';
import { QRCodePanel } from '../../components/QRCodePanel';
import { Modal } from '../../components/Modal';
import { useInductees } from '../../data/useInductees';
import { useMediaManifest } from '../../data/useMediaManifest';
import { useArchiveLeads, useArchiveLeadsByInductee } from '../../data/useArchiveLeads';
import { useStorySectionMap, useStorySections } from '../../data/useStorySections';
import type { ArchiveLead, Inductee, StorySectionRecord } from '../../data/types';
import { AdminDataPanel } from '../admin/AdminDataPanel';
import {
  clearImportOnSessionReset,
  clearRuntimeDataBundleOverride,
  readRuntimeDataBundleOverrideDescriptor,
  subscribeRuntimeDataBundleChanges,
  type ImportedBundleDescriptor,
} from '../../data/runtimeDataBundle';
import { useRelationships } from '../../data/useRelationships';
import { canonicalContinuationUrl } from '../inductee-detail/personDetailModel';
import { isCollectionEligible, portraitUrl, visitorReadyFilm, type Film, type Scene } from './archiveModel';
import {
  approvedClevelandContext,
  archiveClearedForTarget,
  communityOptions,
  contributionOptions,
  portraitObjectPosition,
  publishedContribution,
  sourceLink,
  sourceBiographyParagraphs,
  sourceBiographyText,
  yearOptions,
} from './interpretiveModel';
import { LinksScene } from './LinksScene';
import { useExhibitSessionTimeout, type SessionResetReason } from './useExhibitSessionTimeout';
import { YearsScene } from './YearsScene';
import { filterPeopleForExhibit, hasActiveDiscovery } from './state/exhibitState';
import { useExhibitController } from './state/useExhibitController';

function Portrait({ person, eager = false }: { person: Inductee; eager?: boolean }) {
  const source = portraitUrl(person);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'missing' | 'failed'>(source ? 'loading' : 'missing');
  useEffect(() => setImageState(source ? 'loading' : 'missing'), [person.id, source]);
  const unavailable = imageState === 'missing' || imageState === 'failed';
  const portraitStyle = { '--portrait-object-position': portraitObjectPosition(person.imageFocalPoint) } as CSSProperties;
  return <span className={`photo${imageState === 'ready' ? ' is-ready' : ''}`} data-image-state={imageState} style={portraitStyle}>
    <span className="photo__initials" aria-hidden="true"><span>{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>
      {unavailable && <small>PORTRAIT NOT AVAILABLE</small>}</span>
    {source && <img src={source} alt="" loading={eager ? 'eager' : 'lazy'} draggable={false}
      onLoad={(event) => setImageState(event.currentTarget.naturalWidth >= 80 && event.currentTarget.naturalHeight >= 80 ? 'ready' : 'failed')}
      onError={() => setImageState('failed')} />}
  </span>;
}

function inductionYearLabel(person: Inductee) {
  return person.classYear === null ? 'INDUCTION YEAR NOT RECORDED' : `CLASS OF ${person.classYear}`;
}

function RecordView({ person, storyRecord, archiveItems, showQr, onOpenQr, onCloseQr, onClose, onReset, warning }: {
  person: Inductee;
  storyRecord?: StorySectionRecord;
  archiveItems: ArchiveLead[];
  showQr: boolean;
  onOpenQr: () => void;
  onCloseQr: () => void;
  onClose: () => void;
  onReset: () => void;
  warning: ReactNode;
}) {
  const url = canonicalContinuationUrl(person);
  const biography = sourceBiographyText(person);
  const paragraphs = sourceBiographyParagraphs(biography);
  const clevelandContext = approvedClevelandContext(person, storyRecord, buildInfo.buildTarget);
  const publishedSourceCount = clevelandContext.length + archiveItems.length;
  return <section className="record-view" aria-label={`${person.name} full record`}>
    <div className="record-view__top"><span>CIHOF / Inductee record</span><button type="button" onClick={onClose}>CLOSE</button></div>
    <header className="record-view__mast"><span>{inductionYearLabel(person)}</span><h2 tabIndex={-1} id="recordTitle">{person.name}</h2></header>
    <div className="record-view__body">
      <div className="record-view__reading">
        <section className="record-view__contribution" aria-labelledby="recordContributionTitle">
          <p className="record-view__kicker">Why this person is honored</p>
          <h3 id="recordContributionTitle">Contribution</h3>
          <p>{publishedContribution(person)}</p>
        </section>
        <article className="record-view__story" aria-labelledby="recordBiographyTitle">
          <p className="record-view__kicker">Complete source text</p>
          <h3 id="recordBiographyTitle">Biography</h3>
          {paragraphs.length
            ? paragraphs.map((paragraph, index) => <p key={`${person.id}-biography-${index}`}>{paragraph}</p>)
            : <p className="record-view__empty">A source biography is not available in this record.</p>}
        </article>
        {clevelandContext.length > 0 && <section className="record-view__context" aria-labelledby="recordContextTitle">
          <p className="record-view__kicker">Curator-approved interpretation</p>
          <h3 id="recordContextTitle">Cleveland context</h3>
          <div className="record-view__context-list">{clevelandContext.map((item) => <article key={item.id}>
            <h4>{item.headline}</h4><p>{item.body}</p>
            {(item.place || item.organization) && <p className="record-view__context-facts">{[item.place, item.organization].filter(Boolean).join(' / ')}</p>}
            <p className="record-view__source">Source: {sourceLink(item.sourceUrl)
              ? <a href={sourceLink(item.sourceUrl)} target="_blank" rel="noopener noreferrer">{item.sourceLabel}</a> : item.sourceLabel}</p>
          </article>)}</div>
        </section>}
        {archiveItems.length > 0 && <section className="record-view__archive" aria-labelledby="recordArchiveTitle">
          <p className="record-view__kicker">Approved linked material</p>
          <h3 id="recordArchiveTitle">Archival material</h3>
          <div className="record-view__archive-list">{archiveItems.map((item) => <article key={item.id}>
            <h4>{item.title}</h4><p>{item.displayText}</p>
            <dl><dt>Repository</dt><dd>{item.repository}</dd>
              {item.collectionTitle && <><dt>Collection</dt><dd>{item.collectionTitle}</dd></>}
              {item.callNumber && <><dt>Reference</dt><dd>{item.callNumber}</dd></>}
              {item.creditLine && <><dt>Credit</dt><dd>{item.creditLine}</dd></>}
              {item.rightsNote && <><dt>Rights scope</dt><dd>{item.rightsNote}</dd></>}
              <dt>Source</dt><dd><a href={sourceLink(item.sourceUrl)} target="_blank" rel="noopener noreferrer">{item.sourcePageTitle || item.repository}</a></dd>
              <dt>Connection</dt><dd>{item.connectionStrength}</dd></dl>
          </article>)}</div>
        </section>}
      </div>
      <aside className="record-view__notes"><h3>Evidence and record notes</h3><dl>
        <dt>Inducted</dt><dd>{person.classYear ?? 'Year not recorded'}</dd>
        {['curated', 'documented'].includes(person.countryTagsSource) && person.countryTags.length > 0 && <><dt>Heritage</dt><dd>{person.countryTags.join(', ')}</dd></>}
        {['curated', 'documented'].includes(person.communityTagsSource) && person.communityTags.length > 0 && <><dt>Community</dt><dd>{person.communityTags.join(', ')}</dd></>}
        {person.inductedBy && <><dt>Induction record</dt><dd>Inducted by {person.inductedBy}</dd></>}
        <dt>Biography source</dt><dd>CIHOF inductee profile</dd>
        <dt>Additional published items</dt><dd>{publishedSourceCount > 0 ? publishedSourceCount : 'None published with this record'}</dd>
      </dl>
        {url && <button className="record-view__take" type="button" onClick={onOpenQr}>TAKE THIS RECORD</button>}
      </aside>
    </div>
    {showQr && url && <Modal className="archive-qr" label={`Take ${person.name} record with you`} onClose={onCloseQr}>
      <QRCodePanel value={url} title={person.name} instruction="Scan to continue reading this record on your device."
        autoCloseMs={0} onClose={onCloseQr} />
      <button className="qr-reset" type="button" onClick={onReset}>START OVER</button>
      {warning}
    </Modal>}
  </section>;
}

export function ArchiveExhibit() {
  const { inductees, loading, error } = useInductees();
  const media = useMediaManifest();
  const relationshipState = useRelationships();
  const storySectionState = useStorySections();
  const archiveLeadState = useArchiveLeads();
  const { mode, toggleMode } = useColorMode();
  const { state: exhibitState, actions: exhibitActions, reset: resetExhibit } = useExhibitController();
  const scene = exhibitState.lens;
  const selectedId = exhibitState.selectedPersonId;
  const recordOpen = exhibitState.detail.kind === 'record' || exhibitState.detail.kind === 'qr';
  const showQr = exhibitState.detail.kind === 'qr';
  const activeFilm = exhibitState.media.kind === 'film' ? exhibitState.media.id : null;
  const peopleQuery = exhibitState.query;
  const peopleSort = exhibitState.sort;
  const contributionFilter = exhibitState.facets.contributionIds[0] ?? '';
  const yearFilter = exhibitState.facets.inductionYears[0] ?? '';
  const communityFilter = exhibitState.facets.communityIds[0] ?? '';
  const linkQuery = exhibitState.query;
  const activeLinkPersonId = exhibitState.activeLinkPersonId;
  const [unavailableRecord, setUnavailableRecord] = useState(false);
  const [adminOpen, setAdminOpen] = useState(() => new URLSearchParams(location.search).get('admin') === '1');
  // An imported bundle outranks the published artifact, so it is never silent.
  const [importedContent, setImportedContent] = useState<ImportedBundleDescriptor | null>(readRuntimeDataBundleOverrideDescriptor);
  const [settings, setSettings] = useState(readKioskSettings);
  const [sessionVersion, setSessionVersion] = useState(0);
  const brandTap = useRef({ count: 0, started: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const yearsScroll = useRef<{ personId: string | undefined; left: number } | null>(null);
  const recordReturn = useRef<{ scrollTop: number; focusId: string; focusElement: HTMLElement | null } | null>(null);
  const warningReturnFocus = useRef<HTMLElement | null>(null);
  const restoreWarningFocus = useRef(false);
  const kioskSession = useMemo(() => buildInfo.buildTarget === 'kiosk' || new URLSearchParams(location.search).get('kiosk') === '1', []);
  const resetSession = useCallback((reason: SessionResetReason) => {
    stopAllMedia();
    recordReturn.current = null;
    yearsScroll.current = null;
    if (fieldRef.current) {
      fieldRef.current.scrollTop = 0;
      fieldRef.current.scrollLeft = 0;
    }
    setUnavailableRecord(false);
    // Q4 policy, stated in runtimeDataBundle.ts. A staff import is a deployment
    // choice, not session state, so by default it outlives Start Over.
    if (clearImportOnSessionReset) clearRuntimeDataBundleOverride();
    resetExhibit();
    setAdminOpen(false);
    setSessionVersion((version) => version + 1);
    window.dispatchEvent(new CustomEvent('cihof:session-reset', { detail: { reason } }));
    window.requestAnimationFrame(() => document.getElementById('startOverButton')?.focus({ preventScroll: true }));
  }, [resetExhibit]);
  useEffect(() => subscribeRuntimeDataBundleChanges(
    () => setImportedContent(readRuntimeDataBundleOverrideDescriptor()),
  ), []);
  const captureWarningFocus = useCallback(() => {
    const active = document.activeElement;
    warningReturnFocus.current = active instanceof HTMLElement && !active.closest('.session-warning') ? active : null;
  }, []);
  const sessionTimeout = useExhibitSessionTimeout({
    enabled: kioskSession,
    suspended: adminOpen || loading || Boolean(error),
    timeoutMs: settings.idleTimeoutMs,
    warningMs: settings.idleWarningMs,
    sessionVersion,
    onWarning: captureWarningFocus,
    onReset: resetSession,
  });
  const people = useMemo(() => inductees.filter(isCollectionEligible).sort((a, b) => a.name.localeCompare(b.name)), [inductees]);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const storySectionsById = useStorySectionMap(storySectionState.records);
  const visitorArchiveRecords = useMemo(() => archiveLeadState.records.filter((record) => archiveClearedForTarget(record, buildInfo.buildTarget)), [archiveLeadState.records]);
  const archiveLeadsById = useArchiveLeadsByInductee(visitorArchiveRecords);
  const selected = byId.get(selectedId);
  const years = useMemo(() => {
    const values = people.map((person) => person.classYear).filter((year): year is number => typeof year === 'number');
    return [...new Set(values)].sort((a, b) => a - b);
  }, [people]);
  const contributions = useMemo(() => contributionOptions(people), [people]);
  const communities = useMemo(() => communityOptions(people), [people]);
  const filterYears = useMemo(() => yearOptions(people), [people]);
  const films = useMemo<Film[]>(() => media.records.flatMap((record) => {
    const person = byId.get(record.id);
    if (!person) return [];
    return (record.videos ?? []).flatMap((asset, index) => visitorReadyFilm(asset) ? [{ person, asset, index, key: `${record.id}-${index}` }] : []);
  }).sort((a, b) => (a.person.classYear ?? 0) - (b.person.classYear ?? 0) || a.person.name.localeCompare(b.person.name)), [media.records, byId]);

  useEffect(() => subscribeKioskSettings(setSettings), []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (matchesAdminHotkey(event, settings.adminHotkey)) { event.preventDefault(); setAdminOpen(true); }
      if (event.key === 'Escape') { if (recordOpen) closeRecord(); else exhibitActions.closeMedia(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [settings.adminHotkey, recordOpen, exhibitActions]);
  useEffect(() => {
    if (!selectedId || loading || byId.has(selectedId)) return;
    setUnavailableRecord(true);
    exhibitActions.clearSelection();
  }, [selectedId, loading, byId, exhibitActions]);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (recordOpen) {
      if (field) field.scrollTop = 0;
      document.getElementById('recordTitle')?.focus({ preventScroll: true });
      return;
    }
    const returnState = recordReturn.current;
    if (!returnState) return;
    if (field) field.scrollTop = returnState.scrollTop;
    const frame = window.requestAnimationFrame(() => {
      const target = [returnState.focusId ? document.getElementById(returnState.focusId) : null,
        returnState.focusElement?.isConnected ? returnState.focusElement : null,
        document.getElementById('mapCenterButton'), document.getElementById('selectedPersonRecordButton'),
        document.getElementById('selectionTitle')].find((element) => element && element.getClientRects().length > 0);
      target?.focus({ preventScroll: true });
      if (field) field.scrollTop = returnState.scrollTop;
    });
    recordReturn.current = null;
    return () => window.cancelAnimationFrame(frame);
  }, [recordOpen]);
  useLayoutEffect(() => {
    if (recordOpen || recordReturn.current || !fieldRef.current) return;
    const viewport = exhibitState.viewports[scene];
    fieldRef.current.scrollTop = viewport.scrollTop;
    fieldRef.current.scrollLeft = viewport.scrollLeft;
    const frame = window.requestAnimationFrame(() => {
      if (viewport.focusId) document.getElementById(viewport.focusId)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scene]);
  useLayoutEffect(() => {
    if (sessionTimeout.warningActive) return;
    const returnFocus = warningReturnFocus.current;
    warningReturnFocus.current = null;
    if (!restoreWarningFocus.current) return;
    restoreWarningFocus.current = false;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }, [sessionTimeout.warningActive]);

  function continueSession() {
    restoreWarningFocus.current = true;
    sessionTimeout.extendSession();
  }
  function openRecord(origin?: HTMLElement) {
    const activeElement = origin instanceof HTMLElement ? origin : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    recordReturn.current = {
      scrollTop: fieldRef.current?.scrollTop ?? 0,
      focusId: activeElement?.id ?? '',
      focusElement: activeElement,
    };
    exhibitActions.openDetail({ kind: 'record' });
  }
  function openPersonRecord(id: string, origin: HTMLElement) {
    if (!byId.has(id)) return;
    recordReturn.current = {
      scrollTop: fieldRef.current?.scrollTop ?? 0,
      focusId: origin.id,
      focusElement: origin,
    };
    exhibitActions.selectPerson(id, { kind: 'record' });
  }
  function closeRecord() { exhibitActions.setDetail({ kind: 'none' }); }
  function select(id: string, film: string | null = null) {
    if (!byId.has(id)) return;
    const origin = document.activeElement;
    setUnavailableRecord(false);
    recordReturn.current = null;
    exhibitActions.selectPerson(id, { kind: 'none' }, film ? { kind: 'film', id: film } : { kind: 'none' });
    window.requestAnimationFrame(() => {
      if (!origin?.isConnected && !film) (document.getElementById('mapCenterButton') ?? document.getElementById('selectionTitle'))?.focus({ preventScroll: true });
    });
  }
  function changeScene(next: Scene) {
    const activeElement = document.activeElement;
    exhibitActions.captureViewport(scene, {
      scrollTop: fieldRef.current?.scrollTop ?? 0,
      scrollLeft: fieldRef.current?.scrollLeft ?? 0,
      focusId: activeElement instanceof HTMLElement ? activeElement.id : '',
    });
    recordReturn.current = null;
    exhibitActions.setLens(next);
  }
  function focusSelection() { window.requestAnimationFrame(() => document.getElementById('selectionTitle')?.focus({ preventScroll: true })); }
  function back() {
    if (!exhibitState.history.some((snapshot) => snapshot.selectedPersonId && snapshot.selectedPersonId !== selectedId)) return;
    recordReturn.current = null;
    exhibitActions.backSelection();
    focusSelection();
  }
  function brandGesture() {
    const now = Date.now();
    if (now - brandTap.current.started > 2200) brandTap.current = { count: 0, started: now };
    brandTap.current.count += 1;
    if (brandTap.current.count >= 5) { setAdminOpen(true); brandTap.current = { count: 0, started: now }; }
  }

  const matches = useMemo(() => filterPeopleForExhibit(people, exhibitState), [people, exhibitState.query, exhibitState.sort, exhibitState.facets]);
  const hasPeopleFilters = hasActiveDiscovery(exhibitState);
  const selectedOutsideFilters = Boolean(selected && !matches.some((person) => person.id === selected.id));
  const hasPriorPerson = exhibitState.history.some((snapshot) => snapshot.selectedPersonId && snapshot.selectedPersonId !== selectedId);
  const datedMatches = matches.filter((person) => person.classYear !== null).length;
  const matchingIds = useMemo(() => new Set(matches.map((person) => person.id)), [matches]);
  const matchingYears = useMemo(() => {
    const values = matches.map((person) => person.classYear).filter((year): year is number => typeof year === 'number');
    return [...new Set(values)].sort((a, b) => a - b);
  }, [matches]);
  const visibleFilms = useMemo(() => films.filter((film) => matchingIds.has(film.person.id)), [films, matchingIds]);
  const shownFilm = films.find((film) => film.key === activeFilm) ?? null;
  const warning = sessionTimeout.warningActive && <section className="session-warning" data-session-warning role="region" aria-live="assertive" aria-labelledby="sessionWarningTitle" aria-describedby="sessionWarningCopy">
    <div className="session-warning__panel" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
      <p>SESSION ENDING</p>
      <h2 id="sessionWarningTitle">STILL EXPLORING?</h2>
      <span id="sessionWarningCopy">This kiosk will start over in {Math.ceil(sessionTimeout.warningMs / 1000)} seconds.</span>
      <div className="session-warning__actions">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={continueSession}>KEEP EXPLORING</button>
        <button type="button" onClick={() => resetSession('manual')}>START OVER NOW</button>
      </div>
    </div>
  </section>;
  return <div className="installation" data-theme={mode} data-view={scene} data-imported-content={importedContent ? 'true' : 'false'} data-selection={selected ? 'person' : 'none'} data-record={recordOpen ? 'open' : 'closed'} data-media={activeFilm ? 'open' : 'closed'}
    data-reachable={kioskSession && new URLSearchParams(location.search).get('reach') === '1'}
    data-session-mode={kioskSession ? 'kiosk' : 'public'} data-session-warning={sessionTimeout.warningActive ? 'active' : 'inactive'}
    data-session-version={sessionVersion} data-session-extensions={sessionTimeout.extensionCount}>
    <a className="skip-link" href="#exhibitContent" onClick={() => document.getElementById('exhibitContent')?.focus()}>Skip to exhibit</a>
    <header className="masthead">
      <div className="brand" onClick={brandGesture}>CLEVELAND INTERNATIONAL<br />HALL OF FAME</div>
      <nav className="views" aria-label="Explore the hall">{(['people', 'links', 'years'] as Scene[]).map((item) =>
        <button type="button" key={item} aria-current={scene === item && !recordOpen ? 'page' : undefined} onClick={() => changeScene(item)}>{item.toUpperCase()}</button>)}</nav>
      <button className="start-over" id="startOverButton" type="button" onClick={() => resetSession('manual')}>START OVER</button>
      <button className="theme" type="button" aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onClick={toggleMode}>{mode === 'light' ? 'DARK' : 'LIGHT'}</button>
    </header>
    {importedContent && <div className="imported-content" role="status">
      <span className="imported-content__label">IMPORTED DATA</span>
      <p>This display is showing an imported data file, not the published collection.
        Revision <code>{importedContent.contentRevision.slice(0, 12)}</code>
        {importedContent.differsFromBuild ? ' does not match this build.' : ' matches this build.'}</p>
      <button type="button" onClick={() => { clearRuntimeDataBundleOverride(); setSessionVersion((version) => version + 1); }}>USE PUBLISHED DATA</button>
    </div>}
    <div className="installation__body">
      <aside className="focus" aria-label={selected ? 'Selected person' : 'Archive overview'}>
        {selected && <button className="focus__portrait" id="selectedPersonRecordButton" type="button" aria-label={`${recordOpen ? 'Close' : 'Open'} full record for ${selected.name}`}
          onClick={(event) => recordOpen ? closeRecord() : openRecord(event.currentTarget)}>
          <Portrait person={selected} eager /><span className="focus__flag">{recordOpen ? 'CLOSE RECORD' : 'READ RECORD'}</span>
        </button>}
        <div className="focus__record"><div className="focus__meta"><span>{selected ? inductionYearLabel(selected) : `${people.length} PORTRAITS / ${years.length} CLASSES`}</span>
          {selected && scene === 'years' && !recordOpen && <button type="button" id="selectedPersonRailRecordButton" onClick={(event) => openRecord(event.currentTarget)}>RECORD</button>}
          {hasPriorPerson && <button className="focus__back" type="button" aria-label="Back to previous person" title="Back to previous person and view" onClick={back}>←</button>}
          {selected && <button className="focus__clear" type="button" aria-label="Clear selection" title="Clear selection" onClick={() => { recordReturn.current = null; exhibitActions.clearSelection(); focusSelection(); }}>×</button>}</div>
          <h1 id="selectionTitle" tabIndex={-1} className={selected ? selected.name.length > 26 ? 'is-long' : '' : 'is-neutral'} aria-live="polite">{selected?.name || 'Choose a person'}</h1>
          <p tabIndex={selected ? 0 : -1}>{selected
            ? publishedContribution(selected)
            : entryInvitation}</p>
          {selectedOutsideFilters && <p className="focus__outside" role="status">Outside the current filters. Clear filters to include this person.</p>}
        </div>
      </aside>
      <main className="archive-field" id="exhibitContent" tabIndex={-1} aria-label={`${scene} exhibit`}><div className="field__content" ref={fieldRef} tabIndex={0} aria-label="Scrollable exhibit content">
        {loading && <p className="load-message">LOADING INDEX</p>}
        {!loading && error && <p className="load-message">{error}</p>}
        {!loading && !error && unavailableRecord && !selected && <p role="status">This record is unavailable. Please choose a person from the collection.</p>}
        {!loading && !error && recordOpen && selected && <RecordView person={selected} storyRecord={storySectionsById.get(selected.id)}
          archiveItems={archiveLeadsById.get(selected.id) ?? []} showQr={showQr} onOpenQr={() => exhibitActions.setDetail({ kind: 'qr' })} onCloseQr={() => exhibitActions.setDetail({ kind: 'record' })} onClose={closeRecord}
          onReset={() => resetSession('manual')} warning={warning} />}
        {!loading && !error && !recordOpen && scene === 'people' && <>
          <section className="people-tools" aria-label="People discovery controls">
            <div className="people-tools__count" role="status"><strong>{matches.length} OF {people.length}</strong><span>People shown</span><small>{datedMatches} dated / 0 mapped</small></div>
            <label className="people-tools__search"><span>Search</span><input id="peopleSearch" type="search" aria-label="Find a person or year" placeholder="Name, year, or approved topic" value={peopleQuery} onChange={(event) => exhibitActions.setQuery(event.target.value)} /></label>
            <label className="people-tools__sort"><span>Sort</span><select aria-label="Sort people" value={peopleSort} onChange={(event) => exhibitActions.setSort(event.target.value as typeof peopleSort)}>
              <option value="name">Name A-Z</option><option value="newest">Newest class</option><option value="earliest">Earliest class</option>
            </select></label>
            <div className="people-tools__filters">
              <label><span>Contribution</span><select aria-label="Filter by contribution" value={contributionFilter} onChange={(event) => exhibitActions.setFacet('contributionIds', event.target.value ? [event.target.value] : [])}>
                <option value="">All contributions</option>{contributions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
              <label><span>Induction year</span><select aria-label="Filter by induction year" value={yearFilter} onChange={(event) => exhibitActions.setFacet('inductionYears', event.target.value ? [event.target.value] : [])}>
                <option value="">All years</option>{filterYears.map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
              <label><span>Community</span><select aria-label="Filter by community" value={communityFilter} onChange={(event) => exhibitActions.setFacet('communityIds', event.target.value ? [event.target.value] : [])}>
                <option value="">All communities</option>{communities.map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
              {hasPeopleFilters && <button type="button" onClick={() => { exhibitActions.clearFilters(); document.getElementById('peopleSearch')?.focus(); }}>Clear filters</button>}
            </div>
          </section>
          <div className="people-grid">{matches.map((person) => {
            const inFocus = person.id === selectedId;
            return <button className={`person-tile${inFocus ? ' is-selected' : ''}`} key={person.id} type="button" data-person-id={person.id}
              aria-pressed={inFocus} aria-label={inFocus ? `${person.name}, ${inductionYearLabel(person)}, in focus` : `Select ${person.name}, ${inductionYearLabel(person)}`}
              onClick={() => select(person.id)}>
              <Portrait person={person} />{inFocus && <span className="person-tile__status">IN FOCUS</span>}
              <span className="person-tile__name">{person.name}<small>{inductionYearLabel(person)}</small></span></button>;
          })}
            {!matches.length && <p className="empty">NO MATCHING PEOPLE</p>}</div>
        </>}
        {!loading && !error && !recordOpen && scene === 'places' && <section className="places-pending" aria-labelledby="placesPendingTitle">
          <p>PLACES</p><h2 id="placesPendingTitle">Reviewed place records are not published in this build.</h2>
          <button type="button" onClick={() => changeScene('people')}>EXPLORE PEOPLE</button>
        </section>}
        {!loading && !error && !recordOpen && scene === 'links' && <LinksScene people={people} matchingIds={matchingIds} relationships={relationshipState.relationships}
          relationshipsLoading={relationshipState.loading} relationshipsError={relationshipState.error} onRetryRelationships={relationshipState.refresh}
          activePersonId={activeLinkPersonId} setActivePersonId={exhibitActions.setLinkFocus}
          selected={selected} query={linkQuery} setQuery={exhibitActions.setQuery} onSelect={select} onRecord={openRecord} onPersonRecord={openPersonRecord} portrait={Portrait} />}
        {!loading && !error && !recordOpen && scene === 'years' && <YearsScene years={matchingYears} people={matches} films={visibleFilms} selected={selected} activeFilm={shownFilm} scrollRef={yearsScroll}
          onPerson={(id) => select(id)} onPersonRecord={openPersonRecord} onFilm={(film) => { select(film.person.id, film.key); }} onCloseFilm={() => exhibitActions.closeMedia()}
          onRecord={openRecord} onSessionActivity={sessionTimeout.noteActivity} portrait={Portrait} />}
      </div></main>
    </div>
    {!(showQr && recordOpen && selected && canonicalContinuationUrl(selected)) && warning}
    <AdminDataPanel open={adminOpen} onClose={() => setAdminOpen(false)} settings={settings} onSettingsChange={setSettings} archiveOnly />
  </div>;
}
