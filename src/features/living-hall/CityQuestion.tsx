import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CityQuestionConfig, CityQuestionCounts, CityQuestionOption } from '../../data/useCityQuestion';

type CityQuestionPromptProps = {
  config: CityQuestionConfig;
  counts: CityQuestionCounts;
  onRecordChoice: (optionId: string) => void;
};

type CityQuestionResultsProps = {
  config: CityQuestionConfig;
  counts: CityQuestionCounts;
  reducedMotion: boolean;
};

export function CityQuestionPrompt({ config, counts, onRecordChoice }: CityQuestionPromptProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [activityKey, setActivityKey] = useState(0);
  const selectedOption = config.options.find((option) => option.id === selectedId);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setSelectedId('');
    }, selectedId ? config.autoCloseMs : Math.max(config.autoCloseMs, 18_000));

    return () => window.clearTimeout(timer);
  }, [activityKey, config.autoCloseMs, open, selectedId]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      setSelectedId('');
      setActivityKey((value) => value + 1);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function noteActivity() {
    setActivityKey((value) => value + 1);
  }

  function selectOption(option: CityQuestionOption) {
    onRecordChoice(option.id);
    setSelectedId(option.id);
    noteActivity();
  }

  function closeQuestion() {
    setOpen(false);
    setSelectedId('');
    noteActivity();
  }

  if (!open) {
    return (
      <div
        className="city-question"
        onPointerDown={(event) => {
          event.stopPropagation();
          noteActivity();
        }}
      >
        <button
          className="city-question__trigger"
          type="button"
          aria-label={config.prompt}
          onClick={() => {
            setOpen(true);
            setSelectedId('');
            noteActivity();
          }}
        >
          {config.prompt}
        </button>
      </div>
    );
  }

  const dialog = (
    <div
      className="city-question city-question--open"
      onPointerDown={(event) => {
        event.stopPropagation();
        noteActivity();
      }}
    >
      <button
        className="city-question__scrim"
        type="button"
        aria-label="Close question"
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
          closeQuestion();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          noteActivity();
        }}
        onTouchMove={(event) => {
          event.preventDefault();
          event.stopPropagation();
          noteActivity();
        }}
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          noteActivity();
        }}
      />
      <aside
        className="city-question__panel"
        role="dialog"
        aria-modal="true"
        aria-label={config.prompt}
        onPointerDown={(event) => {
          event.stopPropagation();
          noteActivity();
        }}
        onTouchMove={(event) => {
          event.stopPropagation();
        }}
        onWheel={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="city-question__header">
          <div className="city-question__headerText">
            <p>{config.prompt}</p>
            <span>{selectedOption ? config.privacyNote : config.instruction}</span>
          </div>
          <button className="city-question__close" type="button" onClick={closeQuestion}>
            Close
          </button>
        </div>

        {!selectedOption && (
          <div className="city-question__options" aria-label={config.instruction}>
            {config.options.map((option) => (
              <button
                className="city-question__option"
                key={option.id}
                type="button"
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {selectedOption && (
          <div className="city-question__ack" aria-live="polite">
            <strong>{selectedOption.label}</strong>
            <span>Added to the anonymous field.</span>
            <CityQuestionMiniField config={config} counts={counts} selectedId={selectedOption.id} />
          </div>
        )}
      </aside>
    </div>
  );

  const portalHost = typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('.museum-shell') ?? document.body;

  return portalHost ? createPortal(dialog, portalHost) : dialog;
}

export function CityQuestionResults({ config, counts, reducedMotion }: CityQuestionResultsProps) {
  const total = totalResponses(config.options, counts);
  const max = Math.max(...config.options.map((option) => counts[option.id] ?? 0), 1);

  return (
    <aside
      className={reducedMotion ? 'city-question-results city-question-results--reduced-motion' : 'city-question-results'}
      aria-label={config.resultsTitle}
      data-city-question-total={total}
    >
      <div className="city-question-results__heading">
        <p>{config.prompt}</p>
        <h3>{config.resultsTitle}</h3>
        <span>{total > 0 ? `${total} anonymous responses from this installation` : 'The field is waiting for its first response.'}</span>
      </div>

      <div className="city-question-results__field" aria-hidden="true">
        {config.options.map((option, index) => (
          <CityQuestionCluster
            count={counts[option.id] ?? 0}
            index={index}
            key={option.id}
            max={max}
            option={option}
            total={total}
          />
        ))}
      </div>
    </aside>
  );
}

function CityQuestionCluster({
  option,
  count,
  index,
  max,
  total,
}: {
  option: CityQuestionOption;
  count: number;
  index: number;
  max: number;
  total: number;
}) {
  const visibleDots = total > 0 ? Math.max(5, Math.min(34, Math.round((count / max) * 30) + 4)) : 5;
  const labelScale = total > 0 ? 0.88 + (count / max) * 0.42 : 0.9;
  const dots = useMemo(() => Array.from({ length: visibleDots }, (_, dotIndex) => dotIndex), [visibleDots]);

  return (
    <section
      className={count > 0 ? 'city-question-cluster city-question-cluster--active' : 'city-question-cluster'}
      style={clusterStyle(index, count, max, total)}
    >
      <div className="city-question-cluster__dots">
        {dots.map((dotIndex) => (
          <span
            className="city-question-dot"
            key={dotIndex}
            style={dotStyle(`${option.id}-${dotIndex}`, dotIndex, count)}
          />
        ))}
      </div>
      <strong style={{ '--city-question-label-scale': labelScale } as CSSProperties & Record<string, number>}>
        {option.label}
      </strong>
      <span>{count}</span>
    </section>
  );
}

function CityQuestionMiniField({
  config,
  counts,
  selectedId,
}: {
  config: CityQuestionConfig;
  counts: CityQuestionCounts;
  selectedId: string;
}) {
  return (
    <div className="city-question-mini" aria-hidden="true">
      {config.options.map((option, index) => (
        <span
          className={option.id === selectedId ? 'city-question-mini__word city-question-mini__word--selected' : 'city-question-mini__word'}
          key={option.id}
          style={miniWordStyle(index, counts[option.id] ?? 0)}
        >
          {option.label}
        </span>
      ))}
    </div>
  );
}

function totalResponses(options: CityQuestionOption[], counts: CityQuestionCounts) {
  return options.reduce((total, option) => total + (counts[option.id] ?? 0), 0);
}

function clusterStyle(index: number, count: number, max: number, total: number) {
  const anchors = [
    { x: 63, y: 20 },
    { x: 80, y: 31 },
    { x: 68, y: 47 },
    { x: 86, y: 70 },
    { x: 60, y: 82 },
    { x: 32, y: 75 },
    { x: 17, y: 60 },
    { x: 64, y: 58 },
    { x: 42, y: 54 },
    { x: 89, y: 42 },
    { x: 46, y: 84 },
    { x: 18, y: 34 },
  ];
  const anchor = anchors[index % anchors.length];
  const weight = total > 0 ? count / max : 0;

  return {
    '--city-question-cluster-x': `${anchor.x}%`,
    '--city-question-cluster-y': `${anchor.y}%`,
    '--city-question-cluster-scale': String(0.82 + weight * 0.38),
    '--city-question-cluster-opacity': String(total > 0 && count === 0 ? 0.42 : 0.72 + weight * 0.28),
  } as CSSProperties & Record<string, string>;
}

function dotStyle(seedValue: string, index: number, count: number) {
  const seed = hashNumber(seedValue);
  const angle = ((seed % 360) * Math.PI) / 180;
  const radius = 20 + ((seed >> 3) % 52);
  const activeWeight = count > 0 ? 1 : 0.55;

  return {
    '--city-question-dot-x': `${50 + Math.cos(angle) * radius}%`,
    '--city-question-dot-y': `${50 + Math.sin(angle) * radius * 0.72}%`,
    '--city-question-dot-size': `${Math.round((4 + (seed % 5)) * activeWeight)}px`,
    '--city-question-dot-delay': `${(index % 10) * 90}ms`,
  } as CSSProperties & Record<string, string>;
}

function miniWordStyle(index: number, count: number) {
  return {
    '--city-question-mini-x': `${12 + ((index * 29) % 78)}%`,
    '--city-question-mini-y': `${16 + ((index * 47) % 68)}%`,
    '--city-question-mini-scale': String(0.82 + Math.min(count, 12) * 0.025),
  } as CSSProperties & Record<string, string>;
}

function hashNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
