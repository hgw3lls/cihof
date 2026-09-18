import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesAdminHotkey, readKioskSettings, subscribeKioskSettings } from '../../app/kioskSettings';
import { useColorMode } from '../../app/useColorMode';
import { QRCodePanel } from '../../components/QRCodePanel';
import { useInductees } from '../../data/useInductees';
import { useMediaManifest } from '../../data/useMediaManifest';
import type { Inductee } from '../../data/types';
import { AdminDataPanel } from '../admin/AdminDataPanel';
import { canonicalContinuationUrl } from '../inductee-detail/personDetailModel';
import { portraitUrl, publicReadyFilm, useArchiveRelationships, type Film, type Scene } from './archiveModel';
import { LinksScene } from './LinksScene';
import { YearsScene } from './YearsScene';

function initialScene(): Scene {
  const params = new URLSearchParams(location.search);
  const value = params.get('scene') ?? params.get('view');
  if (value === 'links' || value === 'years') return value;
  if (['world', 'connections', 'journeys', 'routes', 'places', 'region-map'].includes(value ?? '')) return 'links';
  if (value === 'time' || value === 'timeline') return 'years';
  return 'people';
}

function Portrait({ person, eager = false }: { person: Inductee; eager?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(false), [person.id]);
  return <span className={`photo${ready ? ' is-ready' : ''}`}>
    <span className="photo__initials" aria-hidden="true">{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>
    <img src={portraitUrl(person)} alt="" loading={eager ? 'eager' : 'lazy'} draggable={false}
      onLoad={(event) => setReady(event.currentTarget.naturalWidth >= 80 && event.currentTarget.naturalHeight >= 80)}
      onError={() => setReady(false)} />
  </span>;
}

function biographyParagraphs(person: Inductee) {
  const text = (person.bioText || person.lifeWorkSummary || person.storySummary || '').trim();
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [text];
  const paragraphs: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > 440 && current) { paragraphs.push(current.trim()); current = ''; }
    current += sentence;
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs;
}

function RecordView({ person, onClose }: { person: Inductee; onClose: () => void }) {
  const [showQr, setShowQr] = useState(false);
  const url = canonicalContinuationUrl(person);
  const paragraphs = biographyParagraphs(person);
  useEffect(() => { if (showQr) document.querySelector<HTMLButtonElement>('.archive-qr .qr-continuation__close')?.focus(); }, [showQr]);
  return <section className="record-view" aria-label={`${person.name} full record`}>
    <div className="record-view__top"><span>CIHOF / INDUCTEE RECORD</span><button type="button" onClick={onClose}>CLOSE</button></div>
    <header className="record-view__mast"><span>CLASS OF {person.classYear}</span><h2 tabIndex={-1} id="recordTitle">FULL RECORD</h2></header>
    <div className="record-view__body">
      <article className="record-view__story"><h3>BIOGRAPHY</h3>
        {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{/^[a-z]/.test(paragraph) ? `${person.name} ${paragraph}` : paragraph}</p>) : <p>Biography is being prepared.</p>}
      </article>
      <aside className="record-view__notes"><h3>RECORD NOTES</h3><dl>
        <dt>INDUCTED</dt><dd>{person.classYear}</dd>
        {person.countryTags.length > 0 && <><dt>HERITAGE</dt><dd>{person.countryTags.join(', ')}</dd></>}
        {person.inductedBy && <><dt>INDUCTED BY</dt><dd>{person.inductedBy}</dd></>}
        {person.communityTags.length > 0 && <><dt>COMMUNITY</dt><dd>{person.communityTags.join(', ')}</dd></>}
      </dl>
        {person.honoredForSummary && <div className="record-view__honors"><h3>HONORED FOR</h3><p>{person.honoredForSummary}</p></div>}
        {url && <button className="record-view__take" type="button" onClick={() => setShowQr(true)}>TAKE THIS RECORD</button>}
      </aside>
    </div>
    {showQr && url && <div className="archive-qr" role="dialog" aria-modal="true" aria-label={`Take ${person.name} record with you`}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setShowQr(false); } }}>
      <QRCodePanel value={url} title={person.name} instruction="Scan to continue reading this record on your device."
        onClose={() => setShowQr(false)} onAutoClose={() => setShowQr(false)} />
    </div>}
  </section>;
}

export function ArchiveExhibit() {
  const { inductees, loading, error } = useInductees();
  const media = useMediaManifest();
  const relationships = useArchiveRelationships();
  const { mode, toggleMode } = useColorMode();
  const [scene, setScene] = useState<Scene>(initialScene);
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(location.search).get('person') || '');
  const [selectionHistory, setSelectionHistory] = useState<string[]>([]);
  const [recordOpen, setRecordOpen] = useState(false);
  const [activeFilm, setActiveFilm] = useState<string | null>(null);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [adminOpen, setAdminOpen] = useState(() => new URLSearchParams(location.search).get('admin') === '1');
  const [settings, setSettings] = useState(readKioskSettings);
  const brandTap = useRef({ count: 0, started: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const yearsScroll = useRef<number | null>(null);
  const people = useMemo(() => inductees.filter((person) => person.primaryImageUrl).sort((a, b) => a.name.localeCompare(b.name)), [inductees]);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const selected = byId.get(selectedId);
  const years = useMemo(() => {
    const values = people.map((person) => person.classYear).filter((year): year is number => typeof year === 'number');
    if (!values.length) return [];
    return Array.from({ length: Math.max(...values) - Math.min(...values) + 1 }, (_, index) => Math.min(...values) + index);
  }, [people]);
  const films = useMemo<Film[]>(() => media.records.flatMap((record) => {
    const person = byId.get(record.id);
    if (!person) return [];
    return (record.videos ?? []).map((asset, index) => ({ person, asset, index, approved: publicReadyFilm(asset), key: `${record.id}-${index}` }));
  }).sort((a, b) => (a.person.classYear ?? 0) - (b.person.classYear ?? 0) || a.person.name.localeCompare(b.person.name)), [media.records, byId]);

  useEffect(() => subscribeKioskSettings(setSettings), []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (matchesAdminHotkey(event, settings.adminHotkey)) { event.preventDefault(); setAdminOpen(true); }
      if (event.key === 'Escape') { setRecordOpen(false); setActiveFilm(null); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [settings.adminHotkey]);
  useEffect(() => {
    if (!selectedId || loading || byId.has(selectedId)) return;
    setSelectedId('');
  }, [selectedId, loading, byId]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    params.delete('view');
    if (scene === 'people') params.delete('scene'); else params.set('scene', scene);
    if (selected) params.set('person', selected.id); else params.delete('person');
    window.history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }, [scene, selected]);
  useEffect(() => { if (recordOpen) document.getElementById('recordTitle')?.focus({ preventScroll: true }); }, [recordOpen]);
  useEffect(() => { if (fieldRef.current) fieldRef.current.scrollTop = 0; }, [scene, recordOpen]);
  useEffect(() => {
    if (settings.idleTimeoutMs <= 0 || adminOpen) return;
    let timer = window.setTimeout(reset, settings.idleTimeoutMs);
    const renew = () => { window.clearTimeout(timer); timer = window.setTimeout(reset, settings.idleTimeoutMs); };
    for (const type of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(type, renew, { passive: true });
    return () => { window.clearTimeout(timer); for (const type of ['pointerdown', 'keydown', 'wheel']) window.removeEventListener(type, renew); };
  }, [settings.idleTimeoutMs, adminOpen]);

  function reset() { setSelectedId(''); setSelectionHistory([]); setRecordOpen(false); setActiveFilm(null); setScene('people'); }
  function select(id: string, film: string | null = null) {
    if (!byId.has(id)) return;
    if (id !== selectedId) setSelectionHistory((current) => [...current, selectedId]);
    setSelectedId(id); setRecordOpen(false); setActiveFilm(film);
  }
  function changeScene(next: Scene) { setScene(next); setRecordOpen(false); setActiveFilm(null); }
  function back() { const previous = selectionHistory[selectionHistory.length - 1]; if (previous === undefined) return; setSelectionHistory((current) => current.slice(0, -1)); setSelectedId(previous); setRecordOpen(false); setActiveFilm(null); }
  function brandGesture() {
    const now = Date.now();
    if (now - brandTap.current.started > 2200) brandTap.current = { count: 0, started: now };
    brandTap.current.count += 1;
    if (brandTap.current.count >= 5) { setAdminOpen(true); brandTap.current = { count: 0, started: now }; }
  }

  const matches = people.filter((person) => person.id !== selectedId && (!peopleQuery.trim() || person.name.toLowerCase().includes(peopleQuery.trim().toLowerCase()) || String(person.classYear).includes(peopleQuery.trim())));
  const shownFilm = films.find((film) => film.key === activeFilm) ?? null;
  return <div className="installation" data-theme={mode} data-view={scene} data-selection={selected ? 'person' : 'none'} data-record={recordOpen ? 'open' : 'closed'} data-media={activeFilm ? 'open' : 'closed'}>
    <header className="masthead">
      <div className="brand" onClick={brandGesture}>CLEVELAND INTERNATIONAL<br />HALL OF FAME</div>
      <nav className="views" aria-label="Explore the hall">{(['people', 'links', 'years'] as Scene[]).map((item) =>
        <button type="button" key={item} aria-current={scene === item && !recordOpen ? 'page' : undefined} onClick={() => changeScene(item)}>{item.toUpperCase()}</button>)}</nav>
      <button className="theme" type="button" aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onClick={toggleMode}>{mode === 'light' ? 'DARK' : 'LIGHT'}</button>
    </header>
    <div className="installation__body">
      <aside className="focus" aria-label={selected ? 'Selected person' : 'Archive overview'}>
        {selected && <button className="focus__portrait" type="button" aria-label={`${recordOpen ? 'Close' : 'Open'} full record for ${selected.name}`} onClick={() => setRecordOpen((open) => !open)}>
          <Portrait person={selected} eager /><span className="focus__flag">{recordOpen ? 'CLOSE RECORD' : 'READ RECORD'}</span>
        </button>}
        <div className="focus__record"><div className="focus__meta"><span>{selected ? `CLASS OF ${selected.classYear}` : `${new Set(people.map((person) => person.classYear).filter(Boolean)).size} CLASSES`}</span>
          {selected && scene === 'years' && !recordOpen && <button type="button" onClick={() => setRecordOpen(true)}>RECORD</button>}
          {selectionHistory.length > 0 && selectionHistory[selectionHistory.length - 1] && <button className="focus__back" type="button" aria-label="Back to previous person" title="Back to previous person" onClick={back}>←</button>}
          {selected && <button className="focus__clear" type="button" aria-label="Clear selection" title="Clear selection" onClick={() => { setSelectedId(''); setSelectionHistory([]); setRecordOpen(false); setActiveFilm(null); }}>×</button>}</div>
          <h1 className={selected ? selected.name.length > 26 ? 'is-long' : '' : 'is-neutral'} aria-live="polite">{selected?.name || `${people.length} INDUCTEES`}</h1>
          <p tabIndex={selected ? 0 : -1}>{selected ? (selected.honoredForSummary || selected.lifeWorkSummary || selected.storySummary) : years.length ? `${years[0]} - ${years[years.length - 1]}` : ''}</p>
        </div>
      </aside>
      <main className="archive-field"><div className="field__content" ref={fieldRef}>
        {loading && <p className="load-message">LOADING INDEX</p>}
        {!loading && error && <p className="load-message">{error}</p>}
        {!loading && !error && recordOpen && selected && <RecordView person={selected} onClose={() => setRecordOpen(false)} />}
        {!loading && !error && !recordOpen && scene === 'people' && <>
          <div className="people-tools"><strong>{matches.length} TO EXPLORE</strong><label><input type="search" aria-label="Find a person or year" placeholder="Find a person or year" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} /></label></div>
          <div className="people-grid">{matches.map((person) => <button className="person-tile" key={person.id} type="button" aria-label={`Select ${person.name}, Class of ${person.classYear}`} onClick={() => select(person.id)}>
            <Portrait person={person} /><span className="person-tile__name">{person.name}<small>Class of {person.classYear}</small></span></button>)}
            {!matches.length && <p className="empty">{selected?.name.toLowerCase().includes(peopleQuery.toLowerCase()) ? 'ALREADY IN FOCUS' : 'NO MATCHING PEOPLE'}</p>}</div>
        </>}
        {!loading && !error && !recordOpen && scene === 'links' && <LinksScene people={people} relationships={relationships} selected={selected} query={linkQuery} setQuery={setLinkQuery} onSelect={select} onRecord={() => setRecordOpen(true)} portrait={Portrait} />}
        {!loading && !error && !recordOpen && scene === 'years' && <YearsScene years={years} people={people} films={films} selected={selected} activeFilm={shownFilm} scrollRef={yearsScroll} onFilm={(film) => { select(film.person.id, film.key); }} onCloseFilm={() => setActiveFilm(null)} onRecord={() => setRecordOpen(true)} portrait={Portrait} />}
      </div></main>
    </div>
    <AdminDataPanel open={adminOpen} onClose={() => setAdminOpen(false)} settings={settings} onSettingsChange={setSettings} archiveOnly />
  </div>;
}
