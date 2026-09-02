# Meridian marketing analytics

Property: Google Analytics 4 `G-Q8081KQ05Q`.

Events fire through `window.gtag('event', name, params)` from `src/lib/analytics.ts`. Form field values are never sent.

| Event | When | Parameters |
| --- | --- | --- |
| `cta_see_where_click` | Primary CTA clicked | `location`: `nav`, `nav-mobile`, `hero`, `pricing-sprint`, `about`, `insight` |
| `cta_sample_click` | Sample analysis CTA clicked | `location`: `hero`, `teaser` |
| `lead_form_start` | First focus on a Sprint inquiry field | `source`: form id context (`homepage-hero`, `homepage-final`, `sample`, `how-it-works`, `contact`, `platform`) |
| `lead_form_submit` | Submit attempted | `source` |
| `lead_form_success` | Server accepted the lead | `source` |
| `lead_form_error` | Validation or delivery failed | `source`, `reason` (short message, not field values) |
| `how_it_works_click` | Reserved for in-body process links | `location` |

Page views use the default GA4 config (`gtag('config', ...)` in the layout).
