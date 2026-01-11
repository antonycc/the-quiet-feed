# THE QUIET FEED

> *"Enhance 224 to 176. Enhance, stop. Move in, stop. Pull out, track right, stop. Center in, pull back. Stop... Give me a hard copy right there."*  
> — Deckard, Blade Runner

Your feeds, stripped of the garbage.

---

## What Is This?

The Quiet Feed is a read-only feed aggregator that surfaces signal from your existing social connections while filtering noise. It does not post, comment, or interact with source platforms. It exists to give you back your attention.

The internet is drowning in AI-generated slop. In 2025, Merriam-Webster named "slop" their word of the year. Over half of newly published web articles are AI-generated. The Dead Internet Theory is no longer conspiracy—it's observable reality.

The Quiet Feed is a filter between you and the flood.

---

## Access Tiers

| Tier | Access | Features |
|------|--------|----------|
| **DEFAULT** | Anonymous, no login | Curated public feed with SCORE visible. MUTE and WIRE MODE on select topics. Free forever. |
| **ENHANCE** | Social login (OAuth) | Pull your own feeds. Single platform, 20 posts. All features enabled. |
| **HARD COPY** | Paid subscription | Unlimited platforms. Export. API access. Priority processing. |

*Naming: "Enhance" and "Hard Copy" are Blade Runner ESPER scene references.*

---

## Features

All feature names follow Deckard's rhythm—terse, imperative, system-command style.

| Feature | Function |
|---------|----------|
| **SCORE** | Quality rating 0-100. Composite of originality, AI detection, engagement authenticity, information density, source reputation. |
| **TRACE** | Origin tracking. Propagation path: original → first reshare → derivatives. |
| **DEDUP** | Semantic deduplication. Clusters similar content. Shows highest-quality version. |
| **MUTE** | Complete exclusion. "Mute [topic]. Stop." Nothing appears. |
| **WIRE MODE** | Headline normalization. Rewrites sensational headlines to factual substance. |
| **SHIELD** | Dark pattern neutralization. No autoplay. No infinite scroll. Chronological always available. |
| **DEMOTE** | Promotional rebalancing. Marks and downranks sponsored content. |
| **CLUSTER** | Topic and geographic segmentation. Auto-categorization with override. |
| **TERM** | Terminal interface. Full functionality via CLI. Browser handoff for OAuth only. |

---

## TERM: Terminal Interface

> *"INTERFACE 2037 READY FOR INQUIRY"*
> — MOTHER (MU-TH-UR 6000), Alien

TERM is The Quiet Feed as a command-line application. Same features, rendered in text.

### Design Lineage

TERM draws from two sources:

**Alien's MOTHER** — The Nostromo's shipboard computer communicated through amber CRT terminals. Terse. All-caps. No pleasantries. When Ripley queried "What is Special Order 937?", MOTHER replied with brutal clarity. That economy of language—system commands that do exactly what they say—is the template.

**Claude Code** — Anthropic's terminal-based assistant operates on the same principle: text-first interaction, streaming responses, and browser handoff only when necessary (OAuth, complex visualizations). The interface stays in the terminal; the browser is a tool, not the home. Claude Code proves that sophisticated AI interaction doesn't require a GUI—it can feel more direct without one.

TERM inherits both: the aesthetic discipline of 1979 sci-fi and the practical architecture of 2025 AI tooling.

### Interface

```
$ quiet-feed

THE QUIET FEED v0.1.0
INTERFACE READY

> FEED
[SCORE 87] Original research on LLM reasoning chains
           @researcher · 2h · arxiv.org/abs/2025.1234
[SCORE 72] Thread: What I learned building a startup for 3 years
           @founder · 4h · 12 reshares
[SCORE 31] 🚨 YOU WON'T BELIEVE what happened next...
           @clickbait · 1h · DEMOTED: promotional

> MUTE crypto
FILTER APPLIED: "crypto" - 0 items currently visible

> WIRE MODE ON
HEADLINE NORMALIZATION ENABLED

> TRACE 2
ORIGIN: @researcher (2025-01-10 14:23 UTC)
  └─ reshare: @commenter (2025-01-10 15:01 UTC)
  └─ reshare: @founder (2025-01-10 16:45 UTC)
  └─ quote: @critic (2025-01-10 17:12 UTC)

> ENHANCE
OPENING BROWSER FOR LINKEDIN OAUTH...
[Browser opens, user authenticates, returns token]
AUTHENTICATED AS: user@example.com
FEED SOURCE: LinkedIn (20 items)

> EXPORT json
WRITING: feed-2025-01-10.json (20 items)
DONE
```

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TERM (CLI)                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Command Parser                                  │   │
│  │  FEED | MUTE | TRACE | WIRE | ENHANCE | EXPORT  │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API Client (same as web)                        │   │
│  │  → /api/v1/feed                                  │   │
│  │  → /api/v1/score                                 │   │
│  │  → /api/v1/auth/*                                │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│            ┌────────────┴────────────┐                 │
│            ▼                         ▼                 │
│    ┌──────────────┐         ┌──────────────┐          │
│    │ Text Renderer │         │ Browser Open │          │
│    │ (stdout)      │         │ (OAuth only) │          │
│    └──────────────┘         └──────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### Why Terminal?

1. **Accessibility** — Screen readers work better with text
2. **Scriptability** — Pipe output, cron jobs, automation
3. **Focus** — No visual distractions, no infinite scroll by accident
4. **Speed** — Text renders instantly
5. **Offline-first** — Cached feeds readable without network
6. **SSH-friendly** — Check your feed from any server

### Browser Handoff

TERM opens your default browser only for OAuth flows. This is the Claude Code pattern: stay in terminal, hand off to browser for auth, return with token. The browser is a tool for authentication, not the primary interface.

```
> ENHANCE
OPENING BROWSER FOR LINKEDIN OAUTH...
[System browser opens to LinkedIn consent screen]
[User authorizes]
[Browser redirects to localhost callback]
[CLI captures token]
TOKEN RECEIVED. BROWSER CAN BE CLOSED.
AUTHENTICATED.
```

---

## Prototype Plan

### Phase 1: Core Infrastructure

```
the-quiet-feed/
├── packages/
│   ├── core/                    # Shared types and utilities
│   ├── api/                     # Lambda functions
│   │   ├── feed/               # Feed fetching and aggregation
│   │   ├── score/              # Quality scoring (Claude API)
│   │   ├── dedup/              # Semantic deduplication
│   │   └── auth/               # OAuth handling
│   ├── web/                     # Frontend (vanilla JS/ESM)
│   └── infra/                   # CDK infrastructure
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── README.md
└── package.json
```

### Phase 2: Feature Implementation Order

1. **DEFAULT tier** (anonymous access)
   - Static curated feed (RSS sources)
   - Basic SCORE display
   - SHIELD (no autoplay, pagination)

2. **ENHANCE tier** (authenticated)
   - LinkedIn OAuth integration
   - Feed fetching via user token
   - Full SCORE calculation
   - DEDUP across items
   - MUTE filter
   - WIRE MODE transformation

3. **HARD COPY tier** (paid)
   - Stripe integration
   - Multiple platform OAuth
   - TRACE visualization
   - Export functionality

---

## Success Criteria (Prototype)

The prototype is considered successful when:

### Functional Requirements

- [ ] **Anonymous user** can view DEFAULT feed without login
- [ ] **Anonymous user** sees SCORE (0-100) on each item
- [ ] **Anonymous user** can apply MUTE filter to exclude topics
- [ ] **Anonymous user** can enable WIRE MODE to see normalized headlines
- [ ] **Authenticated user** can sign in with LinkedIn OAuth
- [ ] **Authenticated user** sees their own LinkedIn feed
- [ ] **Authenticated user** sees DEDUP grouping (similar items collapsed)
- [ ] **All users** experience SHIELD (no autoplay, pagination, explicit click for media)

### Quality Requirements

- [ ] SCORE accuracy: 85%+ agreement with manual labeling on 100-item test set
- [ ] DEDUP precision: <5% false positives (unrelated items grouped)
- [ ] WIRE MODE: Headlines rewritten are factually accurate to original
- [ ] Page load: <2s for feed of 20 items
- [ ] No content persistence: verified via infrastructure audit

### Technical Requirements

- [ ] Deploys via `npm run deploy` (CDK + GitHub Actions)
- [ ] All secrets in AWS Secrets Manager (no .env files in repo)
- [ ] OAuth tokens encrypted at rest (DynamoDB encryption)
- [ ] Frontend works without JavaScript frameworks (vanilla ESM)

---

## Testable Behaviors

### DEFAULT Tier

```gherkin
Feature: Anonymous Feed Access
  
  Scenario: View curated feed without login
    Given I am not logged in
    When I visit the homepage
    Then I see a feed of curated items
    And each item displays a SCORE (0-100)
    And each item links to original source

  Scenario: Apply MUTE filter
    Given I am viewing the feed
    When I add "crypto" to MUTE filters
    Then no items mentioning "crypto" appear in my feed

  Scenario: Enable WIRE MODE
    Given I am viewing the feed
    And there is an item with headline "Starmer SLAMS critics in fiery Commons showdown"
    When I enable WIRE MODE for "UK Politics"
    Then the headline is rewritten to factual form
    And the rewritten headline contains no opinion words
```

### ENHANCE Tier

```gherkin
Feature: Authenticated Feed Access

  Scenario: Sign in with LinkedIn
    Given I am on the homepage
    When I click "Enhance"
    Then I am redirected to LinkedIn OAuth
    When I authorize The Quiet Feed
    Then I am returned to my personalized feed
    And I see my LinkedIn connections' posts

  Scenario: View DEDUP clusters
    Given I am viewing my feed
    And three people have shared the same article
    When the feed loads
    Then I see one item for that article
    And the item shows "3 shares" indicator
    And clicking expands to show all three sources
    And the highest SCORE version is shown by default

  Scenario: TRACE origin
    Given I see a deduplicated item
    When I click "TRACE"
    Then I see a propagation timeline
    And the original source is highlighted
    And reshares are shown in chronological order
```

### TERM (CLI)

```gherkin
Feature: Terminal Interface

  Scenario: View feed in terminal
    Given I have the quiet-feed CLI installed
    When I run "quiet-feed" and type "FEED"
    Then I see a text-formatted list of feed items
    And each item shows SCORE, title, author, and age
    And items are rendered without any GUI elements

  Scenario: Authenticate via browser handoff
    Given I am running quiet-feed in terminal
    When I type "ENHANCE"
    Then my default browser opens to LinkedIn OAuth
    When I complete authentication in the browser
    Then the CLI displays "AUTHENTICATED"
    And subsequent FEED commands show my LinkedIn feed

  Scenario: Export feed to file
    Given I am viewing my feed in terminal
    When I type "EXPORT json"
    Then a JSON file is written to current directory
    And the CLI confirms the filename and item count
```

### SHIELD (All Tiers)

```gherkin
Feature: Dark Pattern Protection

  Scenario: No autoplay
    Given I am viewing the feed
    And there is a video item
    Then the video does not play automatically
    When I click the video thumbnail
    Then the video plays

  Scenario: Pagination not infinite scroll
    Given I am viewing the feed
    And I scroll to the bottom
    Then I see a "Load more" button
    And more items do not load automatically

  Scenario: Chronological option
    Given I am viewing the feed
    When I select "Chronological" sort
    Then items are sorted by publication time (newest first)
    And no algorithmic reordering is applied
```

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 |
| Cloud | AWS (Lambda, DynamoDB, API Gateway, S3) |
| Infrastructure | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions |
| Package Manager | npm (workspaces) |
| Quality Scoring | Claude API |
| Embeddings | all-MiniLM-L6-v2 (or similar open-source) |
| Frontend | Vanilla JS/ESM, no framework |
| Styling | CSS custom properties, system fonts |

---

## Design Aesthetic

> *"Think Blade Runner / Alien timeless system feel, old school telex news service, but a clean optimistic future (white minimalism unbounded by classical engineering or paper ways of thinking)."*

### Visual Principles

- **White space**: Clean, minimal, breathing room
- **Monospace accents**: Courier/system font for data, labels, commands
- **Amber highlights**: Warm accent color (not neon, not cold)
- **No chrome**: No gradients, no shadows, no skeuomorphism
- **System terminal feel**: Commands are terse ("MUTE", "TRACE", "SCORE")
- **Optimistic future**: Light backgrounds, not green-on-black

### Typography

```css
:root {
  --font-body: system-ui, -apple-system, sans-serif;
  --font-mono: "SF Mono", "Consolas", "Courier New", monospace;
  --color-text: #1f2937;
  --color-secondary: #475569;
  --color-accent: #b45309;
  --color-background: #ffffff;
  --color-surface: #fef3c7;
}
```

---

## Development

### Prerequisites

- Node.js 20+
- AWS CLI configured
- LinkedIn Developer App (OAuth credentials)
- Claude API key

### Setup

```bash
git clone https://github.com/[you]/the-quiet-feed.git
cd the-quiet-feed
npm install
cp .env.example .env.local  # Add your API keys
npm run dev                  # Local development
```

### Deploy

```bash
npm run deploy  # Deploys to AWS via CDK
```

### Test

```bash
npm test                    # Unit tests
npm run test:e2e           # End-to-end tests (Playwright)
npm run test:score         # SCORE accuracy vs labeled test set
```

---

## Legal Architecture

- **No content persistence**: We do not store platform content
- **User-delegated access**: All API calls use user's OAuth token
- **Links to originals**: Every item links to source platform
- **RSS fallback**: If OAuth revoked, fall back to public RSS where available

See `LEGAL.md` for full analysis of hiQ v. LinkedIn, Meta v. Bright Data, and current risk landscape.

---

## Roadmap

### Prototype (Now)
- [ ] DEFAULT tier with curated RSS feed
- [ ] SCORE, MUTE, WIRE MODE, SHIELD
- [ ] LinkedIn OAuth for ENHANCE tier
- [ ] DEDUP and TRACE

### V1 (Post-validation)
- [ ] TERM CLI (npm package, installable globally)
- [ ] Instagram, Twitter/X OAuth
- [ ] HARD COPY tier with Stripe
- [ ] Newsletter ingestion via email

### V2 (If traction)
- [ ] TERM as standalone binary (compiled with pkg or similar)
- [ ] Mobile app (PWA first)
- [ ] Team features
- [ ] API for third-party integrations

---

## Contributing

This is a quiet project. No Discord. No Slack. If you want to help:

1. Open an issue describing what you'd like to do
2. Wait for acknowledgment
3. Submit a PR

We value calm, considered contributions over velocity.

---

## License

MIT. See `LICENSE`.

---

<p align="center">
  <em>"All those moments will be lost in time, like tears in rain."</em><br>
  <em>Unlike Roy's memories, your feed shouldn't be lost in the noise.</em><br><br>
  <strong>The Quiet Feed. Enhance. Stop.</strong>
</p>
