export function eventTargetClosest(target: EventTarget | null, selector: string) {
  const element = typeof Element !== 'undefined' && target instanceof Element
    ? target
    : typeof Node !== 'undefined' && target instanceof Node
      ? target.parentElement
      : null;

  return Boolean(element?.closest(selector));
}

export function eventTargetInsideFocusCard(target: EventTarget | null) {
  return eventTargetClosest(target, '.living-hall__focusCard');
}

export function eventTargetInsideContentWindow(target: EventTarget | null) {
  return eventTargetClosest(target, '.living-hall__focusCard, .living-hall__personActionPanel');
}
