---
title: "Untitled"
description: ""
pubDate: 2026-04-21
author: "Meridian"
tags: ["SEO", "AI", "automation"]
featured: false
---

# Building AI Agent Workflows for Technical SEO Audits

**Stop running crawlers by hand. Here's how to build an agent system that audits your site while you sleep.**

Most technical SEO audits still follow the same exhausting pattern: open Screaming Frog, crawl the site, export to Excel, manually flag issues, paste findings into a deck, repeat weekly. It's not just slow-it's brittle. One missed crawl and your rankings suffer before you notice.

At Meridian Digital, we replaced this manual loop with an autonomous agent workflow. Our `tech_auditor` agent runs daily, finds issues, scores them by business impact, and hands critical findings to a coordinator that alerts the team. What used to take four hours now happens before coffee.

This post is a tactical guide to building the same thing-no AI hype, just the architecture, prompts, and orchestration patterns that actually work.

--

## What "Agent Workflow" Actually Means Here

An agent, in this context, is an LLM-powered task runner with three capabilities: it can call tools (crawl APIs, run Lighthouse, query Google Search Console), make decisions (is this a P1 fix or noise?), and hand off to other agents (route content issues to the content team).

A workflow is the DAG-Directed Acyclic Graph-that chains these agents together with conditional logic. Think: crawl → analyze → triage → report → alert. If no critical issues exist, skip the alert and log silently.

The goal isn't fancy AI. It's **reliable automation with judgment**.

--

## Step 1: Define Your Audit Surface

Before building agents, lock down what they actually need to check. We use a three-layer model:

| Layer | Data Source | Agent Tool |
|----|-------|------|
| **Crawlability** | Screaming Frog / Sitebulb API | `run_crawl()` |
| **Performance** | Lighthouse CI + CrUX | `run_lighthouse()` |
| **Indexation** | Google Search Console API | `query_gsc()` |

**Actionable task:** Export your current manual audit checklist. Every checkbox becomes a function your agent can call. If you check for orphaned pages, write `find_orphaned_pages(crawl_data)`. If you validate hreflang, write `validate_hreflang(sitemap, crawl_data)`.

Start with five core checks. Expanding to twenty is easy once the scaffold exists.

--

## Step 2: Build the Agent Core (The "Judge")

The agent itself is a prompt + tool definitions. We use Anthropic Claude with a system prompt structured like this:

```
You are a technical SEO auditor. You have access to:
- crawl_site(url) → returns page-level metadata, status codes, canonicals
- run_lighthouse(url) → returns Core Web Vitals, accessibility scores
- query_gsc(site, days) → returns clicks, impressions, indexing errors

Your job: analyze the provided data, identify issues, and assign severity:
- P1: Indexing blocked, major canonical errors, 5xx on key pages
- P2: Slow LCP on high-traffic pages, missing structured data
- P3: Minor hreflang mismatches, image compression opportunities

Return a JSON object with findings[] and recommended_fixes[].
```

The key design decision: **the agent returns structured data, not prose**. JSON in, JSON out. This lets downstream agents consume findings without parsing paragraphs.

**Actionable task:** Write your system prompt. Test it manually against a real crawl export. Tune it until the severity rankings match what your human team would assign. Only then wire it into automation.

--

## Step 3: Orchestrate the Workflow (The "Nervous System")

A single agent that audits everything is a single point of failure. We split into a pipeline:

1. **Crawler Agent** - Runs the crawl, normalizes data, stores in a shared cache (we use Redis).
2. **Auditor Agent** - Reads the cache, runs the prompt from Step 2, outputs findings.
3. **Triage Agent** - Filters findings against business rules (e.g., ignore 404s on `/old-blog/*`, escalate anything on `/product/`).
4. **Reporter Agent** - Formats findings into a Slack message or Notion page.
5. **Coordinator Agent** - Decides if human intervention is needed and routes to the right person.

We define this as a YAML DAG-simple, version-controlled, readable:

```yaml
workflow: technical_audit
steps:
  - id: crawl
    agent: crawler
    output: crawl_data
  
  - id: audit
    agent: tech_auditor
    input: crawl_data
    output: raw_findings
  
  - id: triage
    agent: triage
    input: raw_findings
    condition: "findings.length > 0"
    output: prioritized_findings
  
  - id: alert
    agent: coordinator
    input: prioritized_findings
    condition: "any(f.severity == 'P1' for f in prioritized_findings)"
```

**Tooling note:** We run this on Celery with Redis as the broker. Task retries, scheduling, and failure handling come for free. For smaller setups, a GitHub Actions cron job calling a Python script is perfectly fine. Don't over-engineer until you need multi-tenancy.

--

## Step 4: Add Memory (The "Context Layer")

Agents are stateless by default. A catastrophic failure mode: the auditor flags a 404 on `/pricing` today, you fix it, and tomorrow it flags the same URL because it doesn't remember yesterday's crawl.

We solve this with a lightweight context layer:

- **Snapshot store:** Each crawl is versioned. The auditor can diff against the last run to identify *new* issues.
- **Ignore lists:** The triage agent reads a `known_issues.json` file. If an issue is acknowledged and scheduled for fix, it's suppressed for N days.
- **Trend tracking:** Store historical Lighthouse scores. The auditor should flag "LCP degraded 0.4s since last week" even if the absolute score isn't terrible yet.

**Actionable task:** Create a `known_issues.json` with schema: `{url, issue_type, acknowledged_at, suppress_until}`. Teach your triage agent to read it. This one file eliminates 80% of repeated noise.

--

## Step 5: Human-in-the-Loop (The "Safety Valve")

Fully autonomous remediation is risky. We don't let agents push code or edit robots.txt. Instead, the coordinator agent generates:

1. **A summary report** (auto-posted to Slack)
2. **A decision prompt** for P1 issues: "Approve suggested fix? [Yes] [Edit] [Ignore]"

This keeps humans sovereign while removing the drudgery of discovery. Our team spends time *deciding* and *fixing*, not *finding*.

**Actionable task:** Set a threshold. Ours is: P1 issues always notify. P2 issues notify if there are ≥3 new ones. P3 issues go to a weekly digest. Tune this based on your team's capacity-automation should reduce noise, not create it.

--

## What We Actually Built (And You Can Too)

Our `tech_auditor` runs on a schedule: daily for high-traffic clients, weekly for smaller sites. It coordinates with our `content_strategist` agent-if the auditor finds thin content ranking poorly, it flags the URL for content refresh. If it detects a competitor outranking us on a tracked keyword, it notifies the `trend_scout` to investigate.

The system isn't perfect. Agents occasionally hallucinate a severity ranking or miss a nuanced canonical chain. But it's **consistently imperfect in detectable ways**, which means we iterate. A human auditor misses things too-they just don't do it at 6 AM every day without complaining.

--

## Start Small, Today

You don't need a multi-agent platform to begin. Here's a 30-minute starter:

1. Export your last Screaming Frog crawl to CSV.
2. Write a Python script that reads it, calls the OpenAI/Claude API with a simple system prompt ("Find 404s, redirect chains, and missing canonicals"), and outputs a markdown report.
3. Schedule it with cron or GitHub Actions.

That's it. You now have an agent workflow. The rest-DAGs, triage logic, multi-agent handoffs-is optimization, not prerequisite.

**The agencies that win the next five years won't be the ones with the biggest teams. They'll be the ones that automated the work everyone else still does by hand.**

--

*Meridian Digital builds autonomous SEO systems for growing businesses. If you're tired of manual audits, [let's talk](https://bymeridian.com).*