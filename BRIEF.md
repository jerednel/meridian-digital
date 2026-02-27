# Meridian — Build Brief

## What We're Building
A premium SEO agency website for Meridian. The core positioning: systematic SEO infrastructure applied with bespoke strategy per client. We've built a proprietary automation pipeline (daily technical audits, AI-assisted content creation, weekly reports) but every engagement is custom — different keyword strategies, content voices, competitive landscapes.

## Design Direction
Think: Linear.app, Vercel.com, Raycast.com. Minimal, confident, premium typography. Not a marketing agency with stock photo heroes.

### Colors
- Hero/dark sections bg: `#060B18`
- Accent: `#6366F1` (indigo)
- Accent hover: `#4F46E5`
- Hero text: `#F8FAFC`
- Body text on dark: `#94A3B8`
- Light section bg: `#FFFFFF`
- Light section secondary text: `#475569`
- Border/divider: `#1E293B`
- Card bg on dark: `#0F172A`

### Typography
- Use Google Fonts: `Inter` for body, `Plus Jakarta Sans` for headings
- Add to Layout: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">`
- Hero H1: 64px+, bold, tight tracking
- Section H2: 40-48px, semibold
- Body: 18px, comfortable line-height

### Feel
- Lots of whitespace
- Sharp, precise
- NO stock photos anywhere
- NO carousels/sliders
- Subtle gradient on hero (dark navy to slightly lighter)
- Clean hover states on all interactive elements

---

## Pages

### 1. Layout (src/layouts/Layout.astro)
Base layout with Nav + Footer. Import global.css and Google Fonts.

Nav:
- Logo: "Meridian" in Plus Jakarta Sans, white, 20px
- Links: Process | Services | About | Contact (right side)
- Nav bg: transparent → `#060B18` on scroll (add JS for this)
- On mobile: hamburger

Footer:
- Simple. "© 2026 Meridian Digital Media LLC · meridian.digital"
- Two links: Privacy · Contact

---

### 2. Home (src/pages/index.astro)

**Hero Section** (dark, full viewport height)
- Eyebrow text: "SEO Infrastructure for Growing Businesses" (small, indigo, uppercase, letter-spaced)
- H1: "Systematic SEO.\nBuilt around\nyour business."
- Sub (18px, slate): "Most agencies give you a monthly report and a content calendar. We built an automated pipeline that monitors your site daily, identifies opportunities in real time, and creates content continuously — all tailored specifically to your business."
- Two CTAs: Primary "See the process →" (indigo button) | Secondary "View services" (ghost button)
- Below the fold hint: thin line with "↓" to encourage scroll

**Differentiators Section** (white bg)
- H2: "Not a retainer. An infrastructure."
- Three columns with icons (use simple SVG icons, not emoji):
  1. **Daily Monitoring** — "Your site is audited every morning. Rank changes, technical issues, and CTR opportunities surface before you've had coffee."
  2. **Intelligence-Led Content** — "We track trending topics across your industry every week — news, Reddit, trade publications — and use that signal to inform every piece of content we create."
  3. **Transparent by Design** — "Every Friday, you get a plain-English performance report. Every deliverable has a clear path to publish. No black boxes."

**How It Works** (light gray bg `#F8FAFC`)
- H2: "A system that runs. A strategy that's yours."
- Sub: "The process is engineered. The strategy is bespoke."
- Four steps in a horizontal flow (with connecting line on desktop, stacked on mobile):
  1. **Audit** — We pull live data from Google Search Console, rank trackers, and your actual page HTML to understand exactly where you stand.
  2. **Identify** — Technical issues, CTR opportunities, content gaps, and trending topics in your industry are surfaced and prioritized daily.
  3. **Create** — Drafts are written for your site — your voice, your keywords, your industry — and handed off ready to publish.
  4. **Report** — Weekly performance numbers, Friday client emails, monthly strategy reviews. You always know what's happening and why.

**Services Preview** (white bg)
- H2: "Choose your level of coverage"
- Three tier cards side by side:

  **Foundation** (~$X/mo — leave price as "Starting at — let's talk")
  - Daily technical audits
  - GSC + rank tracking for up to 20 keywords
  - Weekly performance report
  - Monthly strategy review
  
  **Growth** (Most Popular badge — indigo)
  - Everything in Foundation
  - 2 SEO content drafts per week
  - Friday client email draft
  - Content intelligence (weekly trending topics)
  - Up to 30 keywords tracked
  
  **Authority**
  - Everything in Growth
  - Competitor gap analysis
  - Monthly strategy deck
  - Unlimited keywords
  - Priority support

- CTA below: "Not sure which fits? Let's talk." → contact page

**Closing CTA Section** (dark bg, indigo gradient)
- H2: "Your competitors are publishing content. Are you?"
- Sub: "Most SEO agencies do a site audit in month one and coast. We're running your pipeline every single day."
- CTA button: "Book an intro call"

---

### 3. Process (src/pages/process.astro)

**Hero**
- Dark bg
- Eyebrow: "The Meridian Pipeline"
- H1: "SEO infrastructure that runs every day."
- Sub: "Here's exactly what happens behind the scenes — no vague 'strategy sessions', no waiting for the monthly report."

**The Daily Pipeline** (alternating light/dark sections or timeline)
Show the actual cadence visually. Use a vertical timeline on mobile, horizontal on desktop.

**Monday Morning — Content Intelligence**
Icon: radar/signal
"Every week we scan Google News, Reddit, HackerNews, and industry publications to identify trending topics relevant to your business. This intelligence feeds into every content decision for the week."

**Every Weekday — Technical Audit**
Icon: magnifying glass / scan
"Each morning we pull fresh data from Google Search Console and our rank tracker, then fetch your actual live pages to check title tags, meta descriptions, H1s, canonical tags, and indexability. We're looking for rank drops, CTR opportunities, and technical issues — with the exact current values, not guesses."

**Every Weekday — Content Production**
Icon: pen / document
"Our content system checks what already exists before creating anything new. Drafts are written against your brand voice and keyword strategy — and every page with an existing draft is skipped so we never recreate work."

**Every Weekday — Daily Briefing**
Icon: notification / pulse
"A concise summary lands in your inbox: what changed, what's ready to publish, and the single highest-impact action you can take today."

**Every Friday — Weekly Report + Client Email**
Icon: chart / email
"A full performance report (clicks, impressions, CTR, position — week over week) plus a ready-to-send client email with percentage changes only. No raw numbers that require explanation."

**Monthly — Strategy Review**
Icon: compass / map
"A month-over-month analysis deck covering what moved, what didn't, competitive signals, and next month's priorities. This is where bespoke strategy lives."

**The Bespoke Layer** (dark section)
- H2: "The system is standard. The strategy isn't."
- Sub: "Every client has different keywords, different competitors, different content voices, and different technical footprints. The pipeline is the same. What it finds and what it creates is entirely yours."
- Three points:
  - Keyword strategy built from scratch for your business
  - Brand voice guidelines that govern every piece of content
  - Competitor analysis specific to your market

---

### 4. Services (src/pages/services.astro)

**Hero** (dark)
- H1: "Clear deliverables. Custom strategy."
- Sub: "You know exactly what you're getting every week. The thinking behind it is built for you."

**Tiers** (detailed, white bg)
Three full-width tier sections (not cards — full sections, stacked):

**Foundation**
Best for: businesses that create their own content but need professional technical oversight
Deliverables each week:
- ✓ Daily GSC + rank tracking pull (up to 20 keywords)
- ✓ Live page metadata audit (title, meta, H1, canonical, indexability)
- ✓ Technical issue detection and prioritized fix list
- ✓ Weekly performance report with WoW trends
- ✓ Monthly strategy review

**Growth** ← Highlighted/featured
Best for: businesses ready to scale organic content production
Everything in Foundation, plus:
- ✓ 2 SEO content drafts per week (blog posts, landing pages, or optimizations)
- ✓ Weekly content intelligence brief (trending topics from your industry)
- ✓ Draft status tracking — nothing gets recreated, nothing gets lost
- ✓ Friday client-ready email draft (% changes, no explanation required)
- ✓ Up to 30 keywords tracked

**Authority**
Best for: competitive markets where content velocity and strategic depth matter
Everything in Growth, plus:
- ✓ Competitor gap analysis
- ✓ Monthly strategy deck (MoM analysis, competitive signals, next-month priorities)
- ✓ Content brief reviews and edits
- ✓ Unlimited keyword tracking
- ✓ Priority turnaround

**FAQ section**
- "Do I publish the content myself?" — Yes. You get publish-ready drafts with exact WP instructions. We don't need site access.
- "How do you learn my brand voice?" — We build a brand voice document for your business before we touch any content.
- "What if I already have an SEO agency?" — We can audit what's been done and either complement it or replace it. We'll be honest about what we find.
- "How fast can we start?" — Usually within one week of kickoff.

---

### 5. About (src/pages/about.astro)

**Hero** (dark)
- H1: "Built by someone who measures everything."
- Sub: "Meridian started as internal tooling. It became a service."

**Story section** (white)
Body copy:
"Most SEO agencies treat organic search as a creative problem. We treat it as a data engineering problem.

Meridian was built by a data engineer who got frustrated watching clients pay for monthly reports that didn't move the needle. So we built the infrastructure first — automated audits, rank tracking, content pipelines, performance snapshots — and let the data drive the strategy.

The result is an SEO operation that runs continuously, surfaces real opportunities, and creates content that's actually informed by what people are searching for this week — not what ranked two years ago.

We work with a small number of clients by design. You get direct access to the person running your account, not an account manager passing notes."

**Values / Principles** (3 columns, light bg)
1. **Show your work** — Every recommendation comes with the data behind it. We don't ask you to trust us. We show you the numbers.
2. **Continuous beats periodic** — Monthly reporting is a relic. Your site is getting crawled every day. Your monitoring should match that pace.
3. **Small by choice** — We limit client count deliberately. Not because we can't scale, but because bespoke work requires actual attention.

---

### 6. Contact (src/pages/contact.astro)

**Hero** (dark)
- H1: "Let's look at your site."
- Sub: "Tell us a bit about where you are and what you're trying to grow. We'll take a look and come back with honest observations — no pitch deck."

**Form** (white bg, centered, max-w-2xl)
Fields:
- Name (required)
- Email (required)  
- Website URL (required)
- What are you trying to grow? (textarea, 4 rows)
- How did you hear about us? (optional)

Submit button: "Send it →" (indigo)

Below form: "We respond within 1 business day. If you'd prefer to talk directly: [email placeholder]"

---

## Technical Requirements

1. All pages use Layout.astro
2. Active nav link gets indigo color
3. Smooth scroll behavior
4. Mobile responsive — nav collapses to hamburger below md
5. Meta tags on every page (title, description, og:title, og:description)
6. Create `public/favicon.svg` — simple "M" lettermark in indigo on dark circle
7. Create `vercel.json`: `{"framework": "astro"}`
8. Create `.gitignore` if not present: node_modules, dist, .env
9. Form action: set to `#` for now (static, no backend yet)
10. `src/styles/global.css` — import tailwind directives + set font-family defaults

## File Structure
```
src/
  layouts/Layout.astro
  pages/
    index.astro
    process.astro
    services.astro
    about.astro
    contact.astro
  styles/
    global.css
  components/
    Nav.astro
    Footer.astro
public/
  favicon.svg
vercel.json
```

Build it fully — all pages complete with real copy as specified above. This is going straight to production.
