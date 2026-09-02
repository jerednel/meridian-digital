/**
 * Meridian marketing analytics events
 *
 * Property: Google Analytics 4 G-Q8081KQ05Q
 * Transport: window.gtag('event', name, params) when present.
 *
 * Naming: snake_case, past-tense of the user action.
 * Never send raw form field values other than coarse metadata (source, location).
 */

export const ANALYTICS_EVENTS = {
  /** Primary CTA clicked (nav, hero, inline, footer). */
  cta_see_where_click: {
    description: 'User clicked SEE WHERE YOU\'RE MISSING / SEE WHERE I\'M MISSING.',
    params: ['location'],
  },
  /** Secondary sample CTA clicked. */
  cta_sample_click: {
    description: 'User clicked SEE A SAMPLE ANALYSIS or equivalent.',
    params: ['location'],
  },
  /** First interaction with a lead form field. */
  lead_form_start: {
    description: 'User focused a field on the Sprint inquiry form.',
    params: ['source'],
  },
  /** Form submit attempted (before network). */
  lead_form_submit: {
    description: 'User submitted the Sprint inquiry form.',
    params: ['source'],
  },
  /** Server accepted the lead. */
  lead_form_success: {
    description: 'Sprint inquiry was accepted.',
    params: ['source'],
  },
  /** Validation or server error. */
  lead_form_error: {
    description: 'Sprint inquiry failed validation or delivery.',
    params: ['source', 'reason'],
  },
  /** User clicked through to How it works from a body link. */
  how_it_works_click: {
    description: 'User opened the Sprint process page.',
    params: ['location'],
  },
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;

export function track(event: AnalyticsEvent, params: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === 'function') {
    gtag('event', event, params);
  }
}
