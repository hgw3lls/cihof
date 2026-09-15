import { expect, type Page } from '@playwright/test';

type TypographyCheck = {
  selector: string;
  max: number;
};

type TypographyViolation = {
  target: string;
  selector: string;
  fontSize: number;
  max: number;
  text: string;
};

const CLOSE_VIEW_TYPOGRAPHY_CHECKS: TypographyCheck[] = [
  { selector: '.living-hall__title h2', max: 52 },
  { selector: '.living-hall__era', max: 22 },
  { selector: '.living-hall__touchCue', max: 22 },
  { selector: '.museum-nav-item', max: 28 },
  { selector: '.living-hall__statusMetric small', max: 14 },
  { selector: '.living-hall__statusMetric strong', max: 18 },
  { selector: '.living-hall__groupLabel strong', max: 42 },
  { selector: '.living-hall__focusIdentity h3', max: 54 },
  { selector: '.living-hall__focusContext', max: 18 },
  { selector: '.living-hall__focusLens p', max: 18 },
  { selector: '.living-hall__focusWhy p', max: 18 },
  { selector: '.living-hall__tracePanel strong', max: 34 },
  { selector: '.living-hall__legacyFocus strong', max: 34 },
  { selector: '.living-hall__fullTextHeader h3', max: 46 },
  { selector: '.living-hall__visitQrPanel .qr-continuation__copy h3', max: 46 },
  { selector: '.living-hall__personActionPanel .story-mode__header h3', max: 46 },
  { selector: '.living-hall__personActionPanel .story-mode__copy > p', max: 22 },
  { selector: '.living-hall__personActionPanel .media-experience__header h3', max: 46 },
  { selector: '.living-hall__personActionPanel .media-stage__body h4', max: 46 },
  { selector: '.living-hall__personActionPanel .qr-continuation__copy h3', max: 46 },
  { selector: '.latest-class-sequence__intro h3', max: 76 },
  { selector: '.latest-class-sequence__person h3', max: 70 },
  { selector: '.latest-class-sequence__group h3', max: 76 },
  { selector: '.latest-class-sequence__finale strong', max: 70 },
  { selector: '.latest-class-sequence__intro p', max: 22 },
  { selector: '.latest-class-sequence__person p', max: 22 },
  { selector: '.latest-class-sequence__person span', max: 22 },
  { selector: '.latest-class-sequence__group p', max: 22 },
  { selector: '.latest-class-sequence__finale p', max: 22 },
  { selector: '.latest-class-sequence__grid span', max: 22 },
  { selector: '.latest-class-sequence__fallback', max: 60 },
  { selector: '.latest-class-sequence__gridFallback', max: 36 },
  { selector: '.city-question__header p', max: 48 },
  { selector: '.city-question__ack strong', max: 58 },
  { selector: '.city-question-results__heading h3', max: 76 },
  { selector: '.city-question-cluster strong', max: 46 },
  { selector: '.qr-continuation__copy h3', max: 52 },
  { selector: '.idle-warning__panel h2', max: 70 },
];

export async function expectCloseViewTypography(page: Page, stateLabel: string) {
  const violations = await page.evaluate<TypographyViolation[]>((checks) => {
    function isVisible(element: HTMLElement) {
      if (element.closest('[aria-hidden="true"], [hidden]')) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0.05
        && rect.width > 1
        && rect.height > 1
        && rect.right > 0
        && rect.bottom > 0
        && rect.left < window.innerWidth
        && rect.top < window.innerHeight;
    }

    function elementTarget(element: HTMLElement) {
      const classes = Array.from(element.classList).slice(0, 3).join('.');
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
    }

    return checks.flatMap((check) => {
      return Array.from(document.querySelectorAll<HTMLElement>(check.selector))
        .filter(isVisible)
        .map((element) => {
          const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
          return {
            target: elementTarget(element),
            selector: check.selector,
            fontSize: Math.round(fontSize * 10) / 10,
            max: check.max,
            text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 72),
          };
        })
        .filter((snapshot) => snapshot.fontSize > check.max + 0.5);
    });
  }, CLOSE_VIEW_TYPOGRAPHY_CHECKS);

  expect(violations, `${stateLabel} close-view typography scale`).toEqual([]);
}
