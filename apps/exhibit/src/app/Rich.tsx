import { emphasised, type Span } from '../state/selectors.ts';

/** Text as the writer set it: their italics shown as italics. */
export function Rich({ text, spans }: { text?: string; spans?: readonly Span[] }) {
  const runs = spans ?? emphasised(text ?? '');
  return <>{runs.map((span, index) => (span.em ? <em key={index}>{span.text}</em> : <span key={index}>{span.text}</span>))}</>;
}
