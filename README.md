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

## Features (Planned)

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

## Architecture: Infrastructure That Scales to Zero

The architecture is **serverless scale-to-zero**: when no users are active, AWS costs approach zero. When traffic arrives, it auto-scales. The same CDK stacks deployed for 10 users work unchanged at 1,000,000 users.

### AWS Account Topology

```
Polycode Limited (Root: 541134664601)
       │
       └── Master Account
             │
             ├── GitHub OIDC Trust (no long-lived credentials)
             ├── Apex DNS (Route53 hosted zones only)
             │
             └── Member Accounts
                   ├── ci      - Feature branch deployments, ephemeral stacks
                   ├── prod    - Production workloads (thequietfeed.com)
                   └── backup  - Cross-region replication, disaster recovery
```

**Principles:**
- Master account is minimal and stable (bootstrap scripts + apex DNS only)
- All application code lives in member accounts
- GitHub Actions assumes roles via OIDC (no credentials stored anywhere)
- `ci` and `prod` are completely isolated (no cross-account access)
- `backup` receives one-way replication (cannot modify prod)
- Everything below master is scriptable, backupable, and re-deployable

See `_developers/AWS_ACCOUNT_TOPOLOGY.md` for detailed account structure.

### CDK Stack Architecture

The infrastructure is split into two CDK applications:

#### Environment Stacks (Long-Lived, Shared)

Deployed once per environment via `deploy-environment.yml`:

| Stack | Resources | Purpose |
|-------|-----------|---------|
| **ObservabilityStack** | CloudWatch Log Groups, CloudTrail, RUM | Monitoring and audit trail |
| **DataStack** | DynamoDB tables (on-demand billing) | User data storage |
| **IdentityStack** | Cognito User Pool, OAuth providers | Authentication |
| **ApexStack** | Route53 apex domain records | DNS for thequietfeed.com |
| **BackupStack** | AWS Backup plans, cross-region replication | Disaster recovery |

#### Application Stacks (Per-Deployment)

Deployed on every push via `deploy.yml`:

| Stack | Resources | Purpose |
|-------|-----------|---------|
| **DevStack** | ECR repository, lifecycle policies | Docker image storage |
| **AuthStack** | Token exchange Lambda, custom authorizer Lambda | OAuth token handling |
| **AccountStack** | Bundle CRUD Lambdas (GET/POST/DELETE) | User preferences API |
| **ApiStack** | HTTP API Gateway v2, routes, authorizers | API routing |
| **EdgeStack** | CloudFront, S3 origin, WAF WebACL | CDN and security |
| **PublishStack** | S3 bucket deployment | Static file publishing |
| **OpsStack** | CloudWatch dashboards | Operational visibility |
| **SelfDestructStack** | Auto-cleanup Lambda (non-prod only) | Ephemeral stack cleanup |

### Request Flow (Current Implementation)

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  CloudFront (Edge)                                               │
│  ├─ Static files → S3 origin (cached at edge)                   │
│  ├─ /api/v1/* → API Gateway origin (no caching)                 │
│  └─ WAF: Rate limiting (2000 req/5min), AWS managed rules       │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Gateway (HTTP API v2)                                       │
│  ├─ JWT Authorizer (Cognito tokens)                             │
│  ├─ Custom Authorizer (X-Authorization header)                  │
│  └─ Routes with Lambda integrations                             │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lambda Functions (Node.js 20, ARM64, Docker images)            │
│  ├─ cognitoTokenPost  - OAuth code → JWT token exchange         │
│  ├─ customAuthorizer  - JWT validation for API routes           │
│  ├─ bundleGet         - Fetch user's bundle configurations      │
│  ├─ bundlePost        - Create bundle (async: ingest + worker)  │
│  └─ bundleDelete      - Delete bundle (async: ingest + worker)  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  DynamoDB (On-Demand, Multi-AZ, PITR enabled)                   │
│  ├─ bundlesTable: hashedSub (PK) + bundleId (SK)               │
│  ├─ bundlePostAsyncRequests: Request state for POST ops        │
│  └─ bundleDeleteAsyncRequests: Request state for DELETE ops    │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  AWS Secrets Manager                                             │
│  ├─ {env}/quietfeed/google/client_secret - Google OAuth         │
│  └─ {env}/quietfeed/user-sub-hash-salt - HMAC-SHA256 salt       │
└─────────────────────────────────────────────────────────────────┘
```

### Async Lambda Pattern

Long-running operations use the **ingest + worker** pattern:

```
Client Request
     │
     ▼
┌──────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Ingest Lambda   │────▶│  SQS Queue   │────▶│  Worker Lambda   │
│  (returns 202)   │     │              │     │  (processes)     │
└──────────────────┘     └──────────────┘     └──────────────────┘
     │                                              │
     │                                              ▼
     │                                    ┌──────────────────┐
     │                                    │  DynamoDB        │
     │                                    │  (result stored) │
     │                                    └──────────────────┘
     │                                              │
     ▼                                              │
┌──────────────────────────────────────────────────┴─────────────┐
│  Client polls GET /api/v1/bundle?requestId=xxx until complete  │
└────────────────────────────────────────────────────────────────┘
```

### Scale-to-Zero Economics

| Component | At 0 Users | At 1M Users | Auto-Scaling |
|-----------|------------|-------------|--------------|
| **CloudFront** | $0 (no requests) | $0.085/GB + $0.01/10K req | Automatic |
| **API Gateway** | $0 (no requests) | $1.00/1M requests | Automatic |
| **Lambda** | $0 (no invocations) | $0.20/1M req + duration | Automatic |
| **DynamoDB** | $0 (on-demand minimum) | $1.25/1M writes, $0.25/1M reads | Automatic |
| **S3** | ~$0.02/GB storage | ~$0.02/GB storage | N/A |
| **Cognito** | $0 (first 50K MAU free) | $0.0055/MAU after 50K | Automatic |

**Monthly floor**: ~$5-10/month for idle infrastructure (DNS, CloudWatch logs, S3 storage).

### Security Architecture

| Boundary | Mechanism |
|----------|-----------|
| GitHub → AWS | OIDC (no stored credentials) |
| Master → Member Accounts | Cross-account IAM roles with conditions |
| ci ↔ prod | Complete isolation (no cross-account access) |
| prod → backup | One-way replication only |
| User IDs at rest | HMAC-SHA256 hashed (salt in Secrets Manager) |
| OAuth tokens | Never logged, encrypted in transit |
| API access | JWT validation via Cognito or custom authorizer |
| Edge protection | WAF rate limiting, AWS managed rule sets |

### Repository Structure (Actual)

```
the-quiet-feed/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # Application stack deployment
│       ├── deploy-environment.yml  # Environment stack deployment
│       ├── test.yml                # Test runner (reusable)
│       └── set-origins.yml         # DNS/CloudFront updates
├── app/
│   ├── bin/                        # Entry points (server.js, ngrok.js, dynamodb.js)
│   ├── data/                       # DynamoDB repository implementations
│   ├── functions/
│   │   ├── auth/                   # cognitoTokenPost.js, customAuthorizer.js
│   │   ├── account/                # bundleGet.js, bundlePost.js, bundleDelete.js
│   │   └── infra/                  # selfDestruct.js
│   ├── lib/                        # Shared utilities (logger, JWT, HTTP helpers)
│   ├── services/                   # Business logic (bundleManagement.js)
│   ├── unit-tests/                 # Vitest unit tests
│   └── system-tests/               # Vitest integration tests
├── behaviour-tests/                # Playwright E2E tests
├── cdk-application/                # CDK config for application stacks
├── cdk-environment/                # CDK config for environment stacks
├── infra/
│   └── main/java/com/thequietfeed/
│       ├── QuietFeedApplication.java   # CDK app entry (application stacks)
│       ├── QuietFeedEnvironment.java   # CDK app entry (environment stacks)
│       ├── QuietFeedSharedNames.java   # Resource naming conventions
│       ├── stacks/                     # CDK stack definitions
│       └── constructs/                 # Reusable CDK constructs (ApiLambda, AsyncApiLambda)
├── scripts/                        # Development and deployment utilities
├── web/
│   ├── public/                     # Static website files
│   │   ├── auth/                   # Login pages
│   │   ├── account/                # Bundle management UI
│   │   └── widgets/                # Reusable Web Components
│   ├── unit-tests/                 # Vitest frontend tests
│   └── browser-tests/              # Playwright browser tests
├── _developers/                    # Developer documentation
├── CLAUDE.md                       # Claude Code instructions
├── REPOSITORY_DOCUMENTATION.md     # Complete architecture reference
└── README.md                       # This file
```

---

## Current State vs. Planned Features

### What's Deployed Now (Skeleton)

- **Authentication**: Cognito User Pool with Google OAuth and custom OIDC provider
- **Bundle CRUD**: Create, read, delete user preference bundles (placeholder for feed configs)
- **API Gateway**: HTTP API v2 with JWT and custom authorizers
- **CDN**: CloudFront with S3 origin for static files, API origin for /api/v1/*
- **Security**: WAF rate limiting, HTTPS everywhere, HMAC-SHA256 user ID hashing
- **Observability**: CloudWatch logs, CloudTrail audit, access logging
- **CI/CD**: GitHub Actions with OIDC authentication to AWS

### What's Planned (Not Yet Implemented)

- **Feed Lambda**: Fetch and aggregate feeds from source platforms
- **Score Lambda**: Quality scoring via Claude API with caching
- **Dedup Lambda**: Semantic deduplication via embeddings
- **TERM CLI**: Terminal client for feed access
- **Multi-Platform OAuth**: LinkedIn, Twitter/X, Instagram
- **Stripe Integration**: HARD COPY tier payments

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

## References

- [Blade Runner ESPER Scene](https://www.youtube.com/watch?v=qHepKd38pr0) - Tier naming inspiration
- [Tears in Rain Monologue](https://en.wikipedia.org/wiki/Tears_in_rain_monologue) - Opening quote
- [Claude Code Philosophy](https://www.latent.space/p/claude-code) - TERM design influence
- [The Bootstrapped Founder on Lifetime Deals](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/) - $100 Club inspiration
- [Roam Research Believer Pricing](https://www.thegrowthlist.co/tactics/charge-early-adopters) - Pricing model reference

---

*The Quiet Feed. Enhance. Stop.*
