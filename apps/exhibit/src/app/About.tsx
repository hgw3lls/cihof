import { Modal } from './Modal.tsx';
import type { AboutText } from '../data/runtime.ts';

/**
 * What the Hall of Fame is, in the words a curator approved for it.
 *
 * Paragraphs are separated by a blank line in the source. Nothing here is
 * written in code: with no approved words a visitor is offered no About at
 * all, and an editor's copy says the words are not written yet.
 */
export function About({ text, onClose }: { text: AboutText | null; onClose: () => void }) {
  const paragraphs = (text?.body ?? '').split(/\n{2,}/).map((each) => each.trim()).filter(Boolean);
  return (
    <Modal className="about" labelledBy="aboutTitle" onClose={onClose}>
      <div className="about__panel">
        <h2 id="aboutTitle" data-autofocus tabIndex={-1}>About the Hall of Fame</h2>
        {paragraphs.length > 0
          ? (
            <div data-edit="about" data-edit-id="about">
              {text?.unreviewed && <p><em className="unreviewed">Unreviewed</em></p>}
              {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          )
          : <p data-edit="about" data-edit-id="about">No words are written for this yet.</p>}
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
