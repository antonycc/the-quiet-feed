# The Quiet Feed - Scaling Phases Plan

**Document:** AGENT_PLAN_SCALING_PHASES.md
**Version:** 1.0
**Date:** 2026-01-11
**Status:** Planning

---

## Overview

This document defines the scaling phases for The Quiet Feed, mapping functional capabilities and architectural decisions to user growth milestones. Each phase builds on the previous, with infrastructure designed to scale automatically (serverless scale-to-zero).

**Key Principle:** The same CDK stacks deployed at Phase 1 work unchanged at Phase 6. No re-architecture, no migration—just AWS auto-scaling and the economics of caching.

---

## Phase Summary

| Phase | Name | Users | Monthly Cost | Features | Trigger |
|-------|------|-------|--------------|----------|---------|
| **0** | Skeleton | 0 | ~$5 | Infrastructure only | Complete |
| **1** | Prototype | 100 ENHANCE + 100K ANONYMOUS | ~$19 | SCORE, SHIELD, basic feed | MVP launch |
| **2** | Early Traction | 1,000 DAU | ~$270 | + DEDUP, MUTE, TRACE | First paying users |
| **3** | Growing | 10,000 DAU | ~$905 | + WIRE MODE, CLUSTER | $20 Club viable |
| **4** | War Chest | 25,000 DAU | ~$1,500 | + Multi-platform OAuth | Trigger fires |
| **5** | Sustainable | 100,000 DAU | ~$2,280 | + TERM CLI, Export | 10% margin pricing |
| **6** | Scale | 1,000,000 DAU | ~$10,570 | + Advanced DEMOTE | Content ceiling |

---

## Phase 0: Skeleton (Current State)

**Status:** COMPLETE
**Users:** 0
**Monthly Cost:** ~$5 (DNS, CloudWatch, S3 storage)

### What Exists

The foundation infrastructure is deployed and tested:

**Environment Stacks (Long-lived):**
- ObservabilityStack - CloudWatch, CloudTrail, RUM
- DataStack - DynamoDB tables (bundles, async requests)
- IdentityStack - Cognito User Pool with Google OAuth
- ApexStack - Route53 apex domain
- BackupStack - AWS Backup for DynamoDB PITR

**Application Stacks (Per-deployment):**
- DevStack - ECR repository for Lambda images
- AuthStack - Token exchange, custom authorizer Lambdas
- AccountStack - Bundle CRUD Lambdas (GET/POST/DELETE)
- ApiStack - HTTP API Gateway v2 with authorizers
- EdgeStack - CloudFront, S3, WAF WebACL
- PublishStack - S3 static deployment
- OpsStack - CloudWatch dashboards
- SelfDestructStack - Auto-cleanup for non-prod

**Lambda Functions:**
- `cognitoTokenPost` - OAuth code → JWT exchange
- `customAuthorizer` - JWT validation for API routes
- `bundleGet` - Fetch user configurations
- `bundlePost` - Create configuration (async)
- `bundleDelete` - Delete configuration (async)
- `selfDestruct` - Ephemeral stack cleanup

**Data Model:**
- `bundlesTable` - hashedSub (PK) + bundleId (SK)
- `bundlePostAsyncRequests` - Async operation state
- `bundleDeleteAsyncRequests` - Async operation state

### What's Missing for Phase 1

- Feed Lambda (fetch from sources)
- Score Lambda (LLM quality rating)
- ScoresTable (content hash → score cache)
- Curated feed source (RSS/static)
- Frontend feed display UI
- SHIELD implementation (no autoplay, pagination)

---

## Phase 1: Prototype (Enhance Unlimited Beta)

**Target:** 100 ENHANCE users (beta testers) + 100K ANONYMOUS (organic traffic)
**Monthly Cost:** ~$19
**Primary Cost Driver:** LLM scoring (44%)

### User Behavior Assumptions

- ENHANCE: 10 sessions before deciding, 20 items/session = 200 views each
- ANONYMOUS: 2 sessions/month, 15 items/session = 30 views each
- ~60% content overlap between ENHANCE users (same LinkedIn network effects)

### Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| **SCORE** | P0 | Quality rating 0-100 via Claude Haiku |
| **SHIELD** | P0 | No autoplay, explicit pagination, chronological |
| **Feed Display** | P0 | Render feed items with scores |
| **Curated Feed** | P0 | RSS-based public feed for ANONYMOUS |
| **LinkedIn OAuth** | P1 | ENHANCE users pull own feed |

### Architecture Additions

**New Lambda Functions:**
```
app/functions/feed/
├── feedGet.js           # Fetch and assemble feed
├── feedGetWorker.js     # Async feed processing
└── scorePost.js         # Score individual items
```

**New DynamoDB Tables:**
```
DataStack additions:
├── scoresTable          # contentHash (PK) → score, signals, expires
├── feedAsyncRequests    # Async feed fetch state
```

**New CDK Stack:**
```
FeedStack.java           # Feed + Score Lambdas
```

### Success Criteria

- [ ] ANONYMOUS user can view curated feed without login
- [ ] Each item displays SCORE (0-100)
- [ ] ENHANCE user can sign in with Google OAuth
- [ ] ENHANCE user can connect LinkedIn
- [ ] ENHANCE user sees their LinkedIn feed with scores
- [ ] SHIELD: No autoplay, explicit "Load more" pagination
- [ ] Page load <2s for 20 items
- [ ] Score accuracy: 85%+ agreement with manual labels

### Detailed Plan

See: **AGENT_PLAN_PROTOTYPE.md**

---

## Phase 2: Early Traction

**Target:** 1,000 DAU (700 ANONYMOUS, 300 ENHANCE)
**Monthly Cost:** ~$270 ($0.27/user)
**Primary Cost Driver:** LLM scoring (87%)

### Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| **DEDUP** | P0 | Semantic deduplication via embeddings |
| **MUTE** | P0 | Topic/source exclusion filters |
| **TRACE** | P1 | Origin tracking (original → reshares) |
| **Preferences UI** | P1 | User settings persistence |

### Architecture Additions

**New Lambda Functions:**
```
app/functions/dedup/
├── dedupPost.js         # Generate embeddings, cluster
└── dedupWorker.js       # Background clustering
```

**New DynamoDB Tables:**
```
├── embeddingsTable      # contentHash → vector, cluster
├── clustersTable        # clusterId → members, centroid
├── preferencesTable     # hashedSub → mutes, settings
```

### Technical Decisions

**Embedding Model:** all-MiniLM-L6-v2 (self-hosted on Lambda)
- ~10ms per embedding
- 384 dimensions
- Free (no API cost)

**Clustering Algorithm:** HDBSCAN or simple cosine similarity
- Run as batch job every hour
- Store cluster memberships in DynamoDB

### Cache Economics

At 1,000 users with ~500 interest clusters:
- Cache hit rate: ~50%
- Unique items to score: ~900,000/month
- Scoring dominates cost at this scale

### Success Criteria

- [ ] DEDUP groups similar items, shows highest-scored
- [ ] MUTE filters exclude selected topics completely
- [ ] TRACE shows propagation path for items
- [ ] Preferences persist across sessions
- [ ] First paying users acquired

---

## Phase 3: Growing

**Target:** 10,000 DAU (6,000 ANONYMOUS, 4,000 ENHANCE)
**Monthly Cost:** ~$905 ($0.09/user)
**Primary Cost Driver:** LLM scoring (72%)

### Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| **WIRE MODE** | P0 | Headline normalization via LLM |
| **CLUSTER** | P1 | Topic/geographic segmentation |
| **$20 Club** | P0 | Stripe integration for believers |
| **Usage Analytics** | P1 | CloudWatch RUM + custom metrics |

### Architecture Additions

**New Lambda Functions:**
```
app/functions/wire/
└── wireTransform.js     # Headline rewriting
```

**New Infrastructure:**
```
PaymentStack.java        # Stripe webhook handling
```

### $20 Club Implementation

- Stripe subscription at $20/month
- Full HARD COPY access immediately
- Track towards war chest trigger
- Membership status in bundlesTable

### Cache Economics

At 10,000 users with ~3,000 interest clusters:
- Cache hit rate: ~65%
- Unique items/month: ~2,500,000
- Per-user cost drops significantly due to overlap

### Success Criteria

- [ ] WIRE MODE rewrites sensational headlines
- [ ] CLUSTER auto-categorizes by topic
- [ ] $20 Club subscription functional
- [ ] War chest tracking dashboard
- [ ] ~80 $20 Club members (2% of 4,000 ENHANCE)

---

## Phase 4: War Chest Trigger

**Target:** 400,000 DAU (~8,000 $20 Club members)
**Monthly Cost:** ~$4,800
**Trigger Condition:** Monthly profit ≥ 24× monthly costs

### The Math

```
8,000 members × $20/month = $160,000 revenue (£128,000)
£128,000 - £4,800 cost = £123,200 profit
£123,200 profit vs £115,200 trigger (24 × £4,800)
TRIGGER FIRES
```

### What Happens

1. All $20 Club founders go FREE (lifetime HARD COPY)
2. War chest banked (~£123,000 — covers 2+ years of costs)
3. Price drops to $2/month floor (already below 10% margin target)
4. 8,000 evangelists with "I believed early" story

### Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| **Multi-Platform** | P0 | Twitter/X, Instagram OAuth |
| **DEMOTE (basic)** | P1 | Identify promotional content |
| **API Access** | P1 | Public API for HARD COPY |

### Architecture Additions

**OAuth Provider Expansion:**
```
IdentityStack additions:
├── Twitter/X identity provider
├── Instagram identity provider
└── Multi-token storage
```

**New Tables:**
```
├── tokensTable          # Multi-platform OAuth tokens
├── promotionalSignals   # Promotional content markers
```

### Success Criteria

- [ ] War chest trigger fires
- [ ] All founders converted to lifetime free
- [ ] Price drops to 10% margin
- [ ] Twitter/X OAuth functional
- [ ] Instagram OAuth functional
- [ ] Basic promotional detection working

---

## Phase 5: Sustainable

**Target:** 100,000 DAU
**Monthly Cost:** ~$2,280 ($0.023/user)
**Primary Cost Driver:** LLM scoring (57%)

### Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| **TERM CLI** | P0 | Terminal client (@quietfeed/term) |
| **Export** | P0 | Feed data export (JSON, CSV) |
| **Advanced MUTE** | P1 | Regex patterns, AI-detected topics |
| **Account Deletion** | P0 | Full GDPR-compliant deletion |

### TERM CLI Architecture

```
packages/term/
├── package.json         # @quietfeed/term
├── bin/qf.js           # CLI entry point
├── lib/
│   ├── commands/       # feed, auth, export, mute
│   ├── api-client.js   # Same API as web
│   └── renderer.js     # Text-based output
```

**Usage:**
```bash
npm install -g @quietfeed/term
qf auth                              # Browser handoff for OAuth
qf feed                              # View feed
qf feed --source linkedin --wire-mode
qf feed --json | jq '.items[] | select(.score > 80)'
```

### Cache Economics

At 100,000 users with ~10,000 interest clusters:
- Cache hit rate: ~75%
- Unique items/month: ~5,000,000
- Reserved capacity discounts: -20%

### Success Criteria

- [ ] TERM CLI published to npm
- [ ] Export functional (JSON, CSV)
- [ ] Account deletion completes within 72 hours
- [ ] 10% margin pricing stable
- [ ] ~1,000 HARD COPY subscribers

---

## Phase 6: Scale

**Target:** 1,000,000 DAU
**Monthly Cost:** ~$10,570 ($0.011/user)
**Primary Cost Driver:** CloudFront/Lambda (80%)

### The Content Ceiling

At this scale, we hit the fundamental limit: **the world produces ~100,000 unique quality items per day.** More users doesn't mean more content to score—it means more cache hits.

```
Scoring % of costs: 20% (down from 87% at 1K users)
Cache hit rate: 85%
Unique items/month: ~8,000,000 (saturating)
```

### Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| **Advanced DEMOTE** | P0 | ML-based promotional detection |
| **Trend Analysis** | P1 | "How has quality changed over time?" |
| **Team Features** | P2 | Shared feeds, org accounts |

### Architecture Considerations

**Reserved/Committed Discounts:**
- DynamoDB reserved capacity
- Lambda provisioned concurrency
- CloudFront committed pricing
- Target: 30% cost reduction

**Global Distribution:**
- Multi-region DynamoDB replication
- CloudFront origin shield
- Regional Lambda deployment

### Success Criteria

- [ ] Per-user cost below $0.02
- [ ] 95%+ uptime (99.9% SLA)
- [ ] P99 latency <500ms globally
- [ ] ~11,000 HARD COPY subscribers
- [ ] Revenue: ~$550,000/month at $50/HARD COPY

---

## Phase 7+ (Future Vision)

**Target:** 10,000,000 - 100,000,000 DAU
**Monthly Cost:** $60K - $384K ($0.006 - $0.004/user)

At this scale, The Quiet Feed becomes infrastructure. The content ceiling is absolute—no more items to score. Cost is purely distribution.

**Possible Extensions:**
- Federated protocol (open standard)
- Self-hosted option
- Platform partnerships
- Non-profit spin-off

**Financial Model at 100M:**
```
Revenue at $2 floor: $200M/year
Costs: ~$4.6M/year
Margin: 98%
Annual surplus: ~$195M
```

This is "never be acquired, never compromise" territory. Fund ten more quiet projects.

---

## Cross-Phase Architecture Decisions

### What Stays Constant

| Decision | Rationale |
|----------|-----------|
| **Serverless (Lambda)** | Scale-to-zero, no idle costs |
| **DynamoDB on-demand** | Auto-scaling, no capacity planning |
| **CloudFront CDN** | Global edge caching, cheap at scale |
| **Content-addressed caching** | Hash → analysis, immutable |
| **No content storage** | Fresh fetch via user token always |

### What Evolves

| Phase | Change |
|-------|--------|
| 1 → 2 | Add embeddings infrastructure |
| 2 → 3 | Add payment processing |
| 3 → 4 | Multi-provider OAuth |
| 4 → 5 | TERM CLI package |
| 5 → 6 | Reserved capacity, multi-region |

### DynamoDB Table Evolution

```
Phase 0 (current):
├── bundlesTable
├── bundlePostAsyncRequests
└── bundleDeleteAsyncRequests

Phase 1:
├── + scoresTable
└── + feedAsyncRequests

Phase 2:
├── + embeddingsTable
├── + clustersTable
└── + preferencesTable

Phase 4:
├── + tokensTable
└── + promotionalSignals
```

---

## Risk Mitigation

### Platform Risk

**Risk:** OAuth access revoked by source platforms
**Mitigation:**
- RSS fallback for public content
- Multiple platform support
- Clear user communication
- Legal position documented (user-delegated access)

### Cost Risk

**Risk:** LLM API pricing changes
**Mitigation:**
- Content-addressed caching (score once)
- Model flexibility (can swap to cheaper)
- Self-hosted embedding (no API cost)
- $2 floor provides margin buffer

### Technical Risk

**Risk:** Cold start latency at low traffic
**Mitigation:**
- Provisioned concurrency for auth Lambdas
- CloudFront caching reduces origin hits
- Graceful degradation (serve stale)

---

## Summary

The Quiet Feed scales through **caching economics** and the **content ceiling**:

1. **Phase 1-2:** LLM scoring dominates cost (70-87%)
2. **Phase 3-4:** Caching reduces per-item cost, $20 Club founders fund growth
3. **Phase 5-6:** Distribution dominates, scoring is negligible (20% → 4%)
4. **Phase 7+:** Content ceiling reached, pure distribution economics

The same infrastructure handles 10 users and 10,000,000 users. The math just gets better.

---

*The Quiet Feed. Enhance. Stop.*
