# THE QUIET FEED

> *"I've seen things you people wouldn't believe. Attack ships on fire off the shoulder of Orion. I watched C-beams glitter in the dark near the Tannhäuser Gate. All those moments will be lost in time, like tears in rain."*  
> — Roy Batty, Blade Runner (1982)

Your feeds, stripped of the garbage.

---

## What Is This?

The Quiet Feed is a read-only feed aggregator that surfaces signal from your existing social connections while filtering noise. It does not post, comment, or interact with source platforms. It exists to give you back your attention.

**"We have not been responsible with AI and we have broken the internet."**

The Slopalypse is here. The Quiet Feed is a filter between you and the flood.

---

## The $100 Club: Believer Pricing

We use a model inspired by [Roam Research's Believer pricing](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/) and [Ghost's Kickstarter](https://www.thegrowthlist.co/tactics/charge-early-adopters): early adopters fund the build, then get rewarded when it succeeds.

```
THE $100 CLUB

$100/month while we build.

You get:
├─ Full HARD COPY access from day one
├─ Lifetime FREE when trigger fires
│   (1 month's profit ≥ 24 months of costs)
├─ Founding member status forever
└─ No ads, ever

No cap on members.
More founders = faster trigger = everyone wins.
```

### The Four Numbers

| Number | What It Means |
|--------|---------------|
| **$100/month** | Founder price during build phase |
| **24× costs** | War chest trigger—when 1 month profit covers 2 years runway |
| **10% margin** | Post-trigger pricing floats to maintain this margin |
| **$2 floor** | Price never drops below $2/month; surplus builds resilience |

### How The Trigger Works

| Scale | Cost | Trigger (24×) | $100 Club @ 2% | Profit | Fires? |
|-------|------|---------------|----------------|--------|--------|
| 5K users | £600 | £14,400 | 100 members | £7,400 | ✗ |
| 10K users | £905 | £21,720 | 200 members | £15,095 | ✗ |
| **25K users** | £1,500 | £36,000 | 500 members | **£38,500** | **✓** |

At ~25,000 users with ~500 $100 Club members:
- You bank £38,500 (the war chest)
- All 500 founders go FREE forever
- Price drops to 10% margin (~$3.33 at that scale)
- Price floats down as scale increases, floor at $2

---

## Access Tiers

| Tier | Access | Features |
|------|--------|----------|
| **ANONYMOUS** | No login. Optional local storage. | Curated public feed. SCORE visible. Basic MUTE and WIRE MODE. Free forever. |
| **ENHANCE** | Free, authenticated. Social login. | All filters. Deep DEDUP. Origin TRACE. Persisted preferences. Free forever. |
| **HARD COPY** | Paid subscription. | Unlimited platforms. Export. API access. Priority processing. |
| **TERM** | Terminal client | Same features as browser tier. Text-based interface. |

*Naming: "Enhance" and "Hard Copy" from Blade Runner's ESPER scene.*

### Feature Migration Model

Features flow downward over time:

- **HARD COPY → ENHANCE:** When per-user cost drops below ~£0.50/month
- **ENHANCE → ANONYMOUS:** When it can work with optional browser local storage

**Marketing principle:** ANONYMOUS and ENHANCE demonstrate value. The more we give away free, the more obvious the product's worth.

---

## Features

| Feature | Function |
|---------|----------|
| **SCORE** | Quality rating 0-100. Originality, AI detection, engagement authenticity, information density. |
| **TRACE** | Origin tracking. Propagation path: original → reshares → derivatives. |
| **DEDUP** | Semantic deduplication. Shows highest-quality version of similar content. |
| **MUTE** | Complete exclusion. Nothing mentioning this topic appears. |
| **WIRE MODE** | Headline normalization. Rewrites sensational headlines to factual substance. |
| **SHIELD** | Dark pattern neutralization. No autoplay. No infinite scroll. |
| **DEMOTE** | Promotional rebalancing. Marks and downranks sponsored content. |
| **CLUSTER** | Topic and geographic segmentation. |

---

## Architecture: Infrastructure for 10 That Scales to 1M

The architecture is designed so that **the same CDK stacks deployed for 10 users will work unchanged at 1,000,000 users.** No re-architecture, no migration—just AWS auto-scaling and the economics of caching.

### AWS Account Topology

```
Polycode Limited (Root)
       │
       └── Master Account
             │
             ├── GitHub OIDC Trust (no long-lived credentials)
             ├── Apex DNS (Route53 hosted zones)
             │
             └── Member Accounts
                   ├── ci      - Feature branch deployments, ephemeral stacks
                   ├── prod    - Production workloads (thequietfeed.com)
                   └── backup  - Cross-region replication, disaster recovery
```

**Principles:**
- Master account is minimal and stable (bootstrap scripts + DNS only)
- All application code lives in member accounts
- GitHub Actions assumes roles via OIDC (no credentials stored)
- `ci` and `prod` are completely isolated (no cross-account access)
- `backup` receives one-way replication (cannot modify prod)

### Request Flow

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  CloudFront (CDN Edge)                                          │
│  ├─ Cache HIT (90%+ at scale) → Return cached JSON             │
│  └─ Cache MISS → Route to origin                               │
└─────────────────────────────────────────────────────────────────┘
     │ (cache miss only)
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Gateway (HTTP API)                                         │
│  ├─ /feed → Feed Lambda                                        │
│  ├─ /auth → Auth Lambda                                        │
│  └─ /score → Score Lambda                                      │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lambda Functions (Node.js 20, ARM64)                          │
│  ├─ Feed: Fetch from source, apply filters                     │
│  ├─ Score: Check DynamoDB cache → Claude API if miss          │
│  ├─ Dedup: Check embedding cache → Generate if miss           │
│  └─ Auth: OAuth token exchange and refresh                     │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  DynamoDB (On-Demand, Multi-AZ)                                │
│  ├─ ScoresTable: content_hash → {score, signals, expires}     │
│  ├─ EmbeddingsTable: content_hash → {vector, expires}         │
│  ├─ UsersTable: user_id → {tokens, preferences}               │
│  └─ ClustersTable: cluster_id → {members, centroid}           │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  External APIs                                                  │
│  ├─ Claude API (Haiku 3): Quality scoring                      │
│  ├─ Source Platforms: LinkedIn, Twitter/X, Instagram           │
│  └─ Embedding Model: all-MiniLM-L6-v2 (self-hosted on Lambda) │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Hierarchy

| Layer | Technology | TTL | What's Cached | Hit Rate at Scale |
|-------|------------|-----|---------------|-------------------|
| **L1** | CloudFront Edge | 1hr fresh / 24hr stale | Assembled feed JSON | 70-90% |
| **L2** | DynamoDB | 7 days | Scores, embeddings, clusters | 95%+ |
| **L3** | S3 | 90 days | Historical scores for trend analysis | N/A (cold) |

**Key insight:** At 1M users, 95%+ of requests are served from cache. The expensive operations (LLM scoring, embedding generation) happen once per content item, not once per view.

### Repository Structure

```
the-quiet-feed/
├── infra/                          # CDK (Java/Maven)
│   └── src/main/java/com/thequietfeed/
│       ├── TheQuietFeedApp.java   # CDK app entry point
│       └── stacks/
│           ├── DnsStack.java      # Route53, ACM certificates
│           ├── DataStack.java     # DynamoDB tables
│           ├── ApiStack.java      # API Gateway, Lambda functions
│           ├── CdnStack.java      # CloudFront distribution
│           └── ObservabilityStack.java  # CloudWatch, alarms
├── packages/
│   ├── core/                       # Shared types (TypeScript)
│   ├── api/                        # Lambda functions (Node.js)
│   │   ├── feed/
│   │   ├── score/
│   │   ├── dedup/
│   │   └── auth/
│   ├── web/                        # Frontend (vanilla JS/ESM)
│   └── term/                       # Terminal client (React/Ink)
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions (OIDC auth)
└── scripts/
    └── bootstrap/                  # Master account setup (CloudShell)
```

### CDK Stacks

| Stack | Resources | Notes |
|-------|-----------|-------|
| **DnsStack** | Route53 hosted zone, ACM certificate | Deployed once, rarely changes |
| **DataStack** | DynamoDB tables (on-demand), S3 buckets | On-demand = auto-scaling |
| **ApiStack** | API Gateway, Lambda functions | ARM64, 256MB, 10s timeout |
| **CdnStack** | CloudFront distribution, cache policies | Edge locations worldwide |
| **ObservabilityStack** | CloudWatch dashboards, alarms, SNS | Alerts on error rate, latency |

### GitHub Actions Workflow

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  id-token: write  # OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsRole
          aws-region: eu-west-2
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Lambda functions
        run: npm run build
      
      - name: Deploy CDK
        run: |
          cd infra
          mvn package
          npx cdk deploy --all --require-approval never
```

### Why This Scales

| Component | At 10 Users | At 1M Users | Change Required |
|-----------|-------------|-------------|-----------------|
| CloudFront | Idle | Serving 95% of requests | None (auto) |
| API Gateway | Idle | Handling cache misses | None (auto) |
| Lambda | Cold starts OK | Warm, auto-scaling | None (auto) |
| DynamoDB | On-demand minimum | On-demand scales | None (auto) |
| Claude API | $0.25/day | $70/day (cached) | None |

**The content ceiling:** The world produces ~100K unique quality items/day. At 1M users, you're not scaling content discovery—you're scaling distribution. Marginal cost per user approaches zero.

### Cost Model

| Scale | Monthly Cost | Per User | Scoring % |
|-------|-------------|----------|-----------|
| 1,000 users | £270 | £0.27 | 87% |
| 10,000 users | £905 | £0.09 | 72% |
| 100,000 users | £2,280 | £0.023 | 57% |
| 1,000,000 users | £10,570 | £0.011 | 20% |

---

## Security Model

| Boundary | Mechanism |
|----------|-----------|
| GitHub → AWS | OIDC (no stored credentials) |
| Master → Member Accounts | Cross-account IAM roles with conditions |
| ci ↔ prod | Complete isolation |
| prod → backup | One-way replication |
| User data at rest | DynamoDB encryption, Secrets Manager |
| OAuth tokens | Encrypted, never logged, auto-refresh |

### Trust Relationships

```
GitHub Actions
     │ (OIDC)
     ▼
Master Account
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
 ci account        prod account      backup account
```

---

## Design Principles

### Computation

**Process once, serve many.** LLM scoring, embedding, deduplication—all happen once per content item. First viewer pays; every subsequent view is cached.

**Tolerate duplication to avoid coordination.** If two Lambdas score the same item, take the first result. Idempotent operations, eventual consistency. Duplicate work < coordination bugs.

**Cache at every layer.** CDN edge → DynamoDB → S3. Marginal cost of serving approaches zero.

### User Relationship

**Fail in favour of the customer.** When in doubt, choose the user's benefit.

**Fail in favour of privacy.** Collect less, store less, share less. Default private.

**The user's data is theirs.** Full export, full deletion, no lock-in.

### Engineering

**Small pieces, loosely joined.** Each component does one thing. Clear interfaces. Replaceable.

**Multiple routes to the summit.** Browser, terminal, API. CLI is first-class.

**Falling is part of the process.** Graceful degradation. Clear errors. Auto-recovery.

### Culture

**Quiet confidence over loud promises.** No hype. Let the work speak.

**Bloody-minded independence.** Sustainable from the start. Bootstrap mentality.

**Longevity through simplicity.** Boring technology. Outlast the creators.

---

## Legal Position

### Our Architecture

- **User-delegated access:** All API calls use user's OAuth tokens. We're the tool they authorized.
- **No content storage:** We don't cache original content. Fresh fetch every view.
- **Derivative data only:** We cache scores, embeddings, clusters—our analysis, not their content.
- **Links to originals:** Every item links back. We're a lens, not a destination.

### Caching and Copyright

- **Content hash ≠ content.** SHA-256 fingerprint cannot be reversed.
- **Analysis is transformative.** Scores are commentary, not reproduction.
- **Embeddings are mathematical.** Vectors cannot be decoded to text.

### Favorable Precedents

- **hiQ v. LinkedIn (9th Cir. 2022):** Public data access ≠ CFAA violation
- **Meta v. Bright Data (2024):** ToS cannot bind authorized API users
- **X v. Bright Data (2024):** Dismissed; data sales undermined harm claims

---

## TERM: Terminal Client

```bash
npm install -g @quietfeed/term

qf auth                              # Opens browser for OAuth
qf feed                              # View feed
qf feed --source linkedin            # Specific platform
qf feed --mute "crypto" --wire-mode  # Filtered
qf feed --json | jq '.items[] | select(.score > 80)'
```

Design origins: MU/TH/UR 6000 (Alien, 1979) + Claude Code (Anthropic, 2024). Industrial warmth meets Unix composability.

---

## Success Criteria (Prototype)

- [ ] Anonymous user can view feed without login
- [ ] Anonymous user sees SCORE (0-100) on each item
- [ ] Authenticated user can sign in with LinkedIn OAuth
- [ ] Authenticated user sees their own feed with DEDUP
- [ ] TERM user can view feed with `qf feed`
- [ ] SCORE accuracy: 85%+ agreement with manual labels
- [ ] Cache hit rate: >80% for items older than 1 hour
- [ ] Page load: <2s for 20 items

---

## References

- [Blade Runner ESPER Scene](https://www.youtube.com/watch?v=qHepKd38pr0) - Tier naming inspiration
- [Tears in Rain Monologue](https://en.wikipedia.org/wiki/Tears_in_rain_monologue) - Opening quote
- [Claude Code Philosophy](https://www.latent.space/p/claude-code) - TERM design influence
- [The Bootstrapped Founder on Lifetime Deals](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/) - $100 Club inspiration
- [Roam Research Believer Pricing](https://www.thegrowthlist.co/tactics/charge-early-adopters) - Pricing model reference

---

*The Quiet Feed. Enhance. Stop.*
