# Meridian

Public site for [bymeridian.com](https://bymeridian.com) — a B2B visibility practice. The primary commercial offer is the 30-day **Meridian AI Visibility Sprint**.

## Local

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
npm run preview
```

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Sprint sales page |
| `/sample` | Labeled sample analysis |
| `/how-it-works` | 30-day method |
| `/about` | Firm and founder |
| `/insights` | Articles |
| `/contact` | Inquiry form |
| `/privacy`, `/terms` | Legal |
| `/platform` | Monitor, after the Sprint |
| `/app/*` | Existing client application |

Lead inquiries post to `/api/lead`. Analytics events are listed in `docs/analytics-events.md`.
