import { useEffect, useMemo, useState } from 'react';

type Entry = {
  commit: string;
  date: string;
  who: string;
  kind: string;
  fromApp: boolean;
  count: number | null;
  reference: string | null;
  subject: string;
  sheets: string[];
};

type Sheet = { kind: 'table'; header: string[]; rows: string[][]; total: number } | { kind: 'text'; text: string };

/**
 * Who decided what, and when: every saved review, and every decision a
 * developer applied with the tools, from the project's history. Each comes
 * with the signed sheet it archived, which is what the decision rests on.
 * Nothing here can be changed.
 */
export function History({ onDone }: { onDone: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [problem, setProblem] = useState('');
  const [person, setPerson] = useState('');
  const [kind, setKind] = useState('');
  const [everything, setEverything] = useState(false);

  useEffect(() => {
    fetch('/api/history')
      .then((response) => response.json())
      .then((value: { entries?: Entry[]; error?: string }) => (value.entries ? setEntries(value.entries) : setProblem(value.error ?? 'The history could not be read.')))
      .catch(() => setProblem('The history could not be read.'));
  }, []);

  const decisions = useMemo(() => (entries ?? []).filter((entry) => everything || entry.fromApp || entry.sheets.length > 0), [entries, everything]);
  const people = [...new Set(decisions.map((entry) => entry.who))].sort();
  const kinds = [...new Set(decisions.map((entry) => entry.kind))].sort();
  const shown = decisions.filter((entry) => (!person || entry.who === person) && (!kind || entry.kind === kind));

  return (
    <main className="page">
      <h1>History</h1>
      <p className="lead">Every decision saved in this app or applied by the developer, newest first, with the sheet it rests on.</p>

      <div className="row filters">
        <label className="field field--inline">
          <span>Who</span>
          <select value={person} onChange={(event) => setPerson(event.target.value)}>
            <option value="">Everyone</option>
            {people.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="field field--inline">
          <span>What</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">Every kind</option>
            {kinds.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="inline">
          <input type="checkbox" checked={everything} onChange={(event) => setEverything(event.target.checked)} />
          include the developer&rsquo;s other changes to the data
        </label>
      </div>

      {problem && <p className="notice" role="alert">{problem}</p>}
      {entries === null && !problem && <p className="quiet">Reading the history…</p>}
      {entries !== null && shown.length === 0 && <p className="quiet">Nothing matches.</p>}

      <ol className="history">
        {shown.map((entry) => <HistoryEntry key={entry.commit} entry={entry} />)}
      </ol>

      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function HistoryEntry({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const show = (path: string) => {
    if (open === path) { setOpen(null); return; }
    setOpen(path);
    setSheet(null);
    fetch(`/api/history/sheet?path=${encodeURIComponent(path)}`).then((response) => response.json()).then(setSheet).catch(() => setSheet(null));
  };

  return (
    <li className="panel history__entry">
      <p>
        <strong>{sentence(entry.kind)}</strong>
        {entry.count !== null && <> · {entry.count} decision{entry.count === 1 ? '' : 's'}</>}
        {' · '}{entry.who}
        <span className="quiet"> · {new Date(entry.date).toLocaleString()}</span>
      </p>
      {!entry.fromApp && <p className="quiet small">{entry.subject}</p>}
      <p className="quiet small">
        {entry.reference && <>Reference {entry.reference} · </>}commit {entry.commit}
      </p>
      {entry.sheets.map((path) => (
        <div key={path}>
          <button type="button" className="link" onClick={() => show(path)}>
            {open === path ? 'Hide' : 'Show'} what was decided ({path.split('/').pop()})
          </button>
          {open === path && sheet && <SheetView sheet={sheet} />}
        </div>
      ))}
    </li>
  );
}

function SheetView({ sheet }: { sheet: Sheet }) {
  if (sheet.kind === 'text') return <pre className="output">{sheet.text}</pre>;
  return (
    <div className="sheet">
      <table>
        <thead><tr>{sheet.header.map((cell, index) => <th key={index}>{cell}</th>)}</tr></thead>
        <tbody>
          {sheet.rows.map((row, index) => (
            <tr key={index}>{sheet.header.map((_, column) => <td key={column}>{row[column] ?? ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {sheet.total > sheet.rows.length && <p className="quiet small">The first {sheet.rows.length} of {sheet.total} rows.</p>}
    </div>
  );
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
