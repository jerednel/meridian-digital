export const SITE = {
  name: 'Meridian',
  legalName: 'Meridian Digital LLC',
  url: 'https://bymeridian.com',
  domain: 'bymeridian.com',
  email: 'jeremy@bymeridian.com',
  founder: 'Jeremy Nelson',
  locale: 'en_US',
  twitter: '',
  gaId: 'G-Q8081KQ05Q',
} as const;

export const OFFER = {
  sprintName: 'Meridian AI Visibility Sprint',
  sprintPrice: 2500,
  sprintPriceLabel: '$2,500',
  sprintDuration: '30 days',
  sprintCadence: 'one-time',
  monitorName: 'Meridian Visibility Monitor',
  monitorPrice: 750,
  monitorPriceLabel: '$750',
  monitorCadence: '/month',
  monitorContract: 'No annual contract',
} as const;

export const DEFAULT_TITLE = 'AI search visibility for B2B — Meridian';
export const DEFAULT_DESCRIPTION =
  'Find where buyers are discovering your competitors instead of you across Google and AI search. A 30-day Sprint, $2,500.';

export const NAV_LINKS = [
  { href: '/sample', label: 'Sample' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/insights', label: 'Insights' },
  { href: '/about', label: 'About' },
] as const;

export const FOOTER_LINKS = [
  { href: '/#sprint', label: 'The Sprint' },
  { href: '/sample', label: 'Sample' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/platform', label: 'Platform' },
  { href: '/insights', label: 'Insights' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export const JOURNEY = [
  {
    stage: 'Discover',
    question: 'What options exist for this problem?',
    why: 'The first answer names the category. If you are absent here, you never enter the later stages.',
  },
  {
    stage: 'Evaluate',
    question: 'What should we check before we buy?',
    why: 'Buyers ask about risk, implementation, and proof. The sources that answer this become the shortlist filter.',
  },
  {
    stage: 'Compare',
    question: 'How does this vendor differ from the others?',
    why: 'Comparison questions are where competitors get written into the deal. Being unnamed here is expensive.',
  },
  {
    stage: 'Validate',
    question: 'Who uses this in an environment like ours?',
    why: 'Industry, facility type, and peer proof decide whether a name survives the last internal review.',
  },
  {
    stage: 'Buy',
    question: 'How do we procure this without getting it wrong?',
    why: 'Procurement language, rollout, and failure modes are the last answers before a vendor is called.',
  },
] as const;

export const SPRINT_WEEKS = [
  {
    week: 'Week 1',
    title: 'Map the questions that can turn into revenue',
    body: 'We build the buyer-question set for your category across Discover, Evaluate, Compare, Validate, and Buy. Not every prompt people might type. The questions that precede a purchase.',
  },
  {
    week: 'Week 2',
    title: 'Measure who gets named',
    body: 'Those questions are run through Google and major AI answer surfaces. You see who is recommended, cited, or omitted — including you — on the questions that matter.',
  },
  {
    week: 'Week 3',
    title: 'Diagnose the sources',
    body: 'We trace why the answer looks that way: which pages, directories, roundups, and third-party writeups the systems are drawing from, and where your evidence is too thin to use.',
  },
  {
    week: 'Week 4',
    title: 'Deliver findings and the first moves',
    body: 'You get a concise brief: where you are missing, why, and the few actions most likely to change the next shortlist. Then you decide whether ongoing monitoring is worth it.',
  },
] as const;

export const DELIVERABLES = [
  {
    title: 'Which buyer questions actually matter',
    body: 'A revenue-bearing question map for your category — not a dump of prompts, and not a keyword list dressed up as strategy.',
  },
  {
    title: 'Where you appear, and who replaces you',
    body: 'Presence, omission, and substitution across Google and AI answers, company by company, question by question.',
  },
  {
    title: 'Which sources form the shortlist',
    body: 'The pages and third-party mentions the systems actually use — so you can see why a competitor is in the answer and you are not.',
  },
  {
    title: 'The gaps that explain the miss',
    body: 'Whether the problem is on your site, off your site, or both, named specifically enough that a marketer or founder can act.',
  },
  {
    title: 'Whether the opportunity is real',
    body: 'A clear recommendation to keep measuring, or to stop. If the gap is not meaningful, that is the finding.',
  },
] as const;

export const FIT = {
  yes: [
    'B2B companies with a defined category and named competitors',
    'Teams where a single closed deal is worth more than the Sprint',
    'Marketing, demand, or product-marketing leaders who need evidence before they commit more budget',
    'Categories where buyers research in writing before they talk to sales — security, infrastructure, software, industrial, professional services',
  ],
  no: [
    'Local or consumer businesses competing on foot traffic and reviews',
    'Teams that want a volume of content shipped and called a visibility program',
    'Anyone looking for a dashboard to check without changing the underlying evidence',
    'Companies that need us to confirm a problem the research does not support',
  ],
} as const;

export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
]);
