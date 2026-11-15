import type { MouseEvent } from 'react';

const rows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '-', '.'],
] as const;

type Props = {
  onKey: (text: string) => void;
  onDelete: () => void;
};

/**
 * The display's own keys, for a touchscreen with no keyboard in front of it.
 * Shown on the installed display only: a phone or a computer has its own.
 * A keyboard plugged in still types as before, because a key here never takes
 * the focus from the search field.
 */
export function TouchKeyboard({ onKey, onDelete }: Props) {
  // A key pressed keeps the field focused, so its caret stays and a plugged-in keyboard still types there.
  const keepFocus = (event: MouseEvent) => event.preventDefault();
  return (
    <div className="touchkeys" role="group" aria-label="Keyboard">
      {rows.map((row) => (
        <div className="touchkeys__row" key={row.join('')}>
          {row.map((key) => (
            <button key={key} type="button" className="touchkeys__key" onMouseDown={keepFocus} onClick={() => onKey(key)}>
              {key.toUpperCase()}
            </button>
          ))}
          {row.length < 10 && (
            <button type="button" className="touchkeys__key touchkeys__key--wide" aria-label="Delete" onMouseDown={keepFocus} onClick={onDelete}>
              ⌫
            </button>
          )}
        </div>
      ))}
      <div className="touchkeys__row">
        <button type="button" className="touchkeys__key touchkeys__key--space" onMouseDown={keepFocus} onClick={() => onKey(' ')}>Space</button>
      </div>
    </div>
  );
}
