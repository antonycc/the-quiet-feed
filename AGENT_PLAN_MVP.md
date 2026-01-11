# The Quiet Feed - MVP Plan

**Document:** AGENT_PLAN_MVP.md
**Version:** 1.0
**Date:** 2026-01-11
**Status:** Planning

---

## Overview

This document defines the Minimum Viable Product plan for The Quiet Feed, focusing on:
1. Personal feed provider integrations (5 major platforms)
2. Public content source integrations (5 high-ubiquity sources)
3. Core features from Phase 1-3 of AGENT_PLAN_SCALING_PHASES.md
4. AWS infrastructure considerations

**Goal:** Launch with curated feed aggregation, quality scoring, and essential features for 100 ENHANCE users + 100K ANONYMOUS visitors.

---

## Feed Provider Strategy

### Personal Feed Providers (OAuth-based)

These platforms require user authentication to access personal feeds. Users grant access via OAuth tokens stored securely.

| Provider | API Type | Auth Method | Priority | Notes |
|----------|----------|-------------|----------|-------|
| **LinkedIn** | REST API | OAuth 2.0 | P0 | Primary professional feed source |
| **Twitter/X** | REST API | OAuth 2.0 | P1 | Requires approved developer account |
| **Instagram** | Graph API | OAuth 2.0 | P1 | Business/Creator accounts only |
| **Reddit** | REST API | OAuth 2.0 | P2 | Subreddit-based personalization |
| **Mastodon** | REST API | OAuth 2.0 | P2 | Federated, multiple instances |

#### LinkedIn Integration (P0)

**API:** LinkedIn Marketing API / Consumer API
**Endpoints:**
- `GET /v2/shares` - User's shared content
- `GET /v2/ugcPosts` - User Generated Content posts
- `GET /v2/feed` - Personal feed (requires r_liteprofile, r_basicprofile)

**OAuth Scopes:**
- `r_liteprofile` - Basic profile info
- `r_emailaddress` - Email for identity
- `r_fullprofile` - Extended profile (Partner only)

**Implementation:**
```javascript
// app/functions/feed/linkedinFeed.js
export const fetchLinkedInFeed = async (accessToken) => {
  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.json();
};
```

#### Twitter/X Integration (P1)

**API:** Twitter API v2
**Endpoints:**
- `GET /2/users/:id/timelines/reverse_chronological` - Home timeline
- `GET /2/users/:id/tweets` - User's tweets

**OAuth Scopes:**
- `tweet.read` - Read tweets
- `users.read` - Read user info
- `offline.access` - Refresh tokens

**Rate Limits:** 1,500 requests/15 minutes (user context)

#### Instagram Integration (P1)

**API:** Instagram Graph API
**Endpoints:**
- `GET /me/media` - User's media
- `GET /me/feed` - User's feed (Business accounts)

**Requirements:**
- Facebook Developer App
- Business/Creator account
- Page connection

#### Reddit Integration (P2)

**API:** Reddit API
**Endpoints:**
- `GET /best` - Best posts from subscriptions
- `GET /hot` - Hot posts from subscriptions

**OAuth Scopes:**
- `read` - Access posts/comments
- `identity` - User identity
- `mysubreddits` - Subscribed subreddits

#### Mastodon Integration (P2)

**API:** Mastodon REST API
**Endpoints:**
- `GET /api/v1/timelines/home` - Home timeline
- `GET /api/v1/accounts/:id/statuses` - User statuses

**Considerations:**
- Instance-specific authentication
- Multiple server support required

---

### Public Content Sources (API/RSS-based)

These sources are accessible via RSS feeds or API keys (our credentials, not user tokens).

| Source | Access Method | API Key Required | Priority | Notes |
|--------|---------------|------------------|----------|-------|
| **Hacker News** | RSS/API | No | P0 | Free, high signal-to-noise |
| **BBC News** | RSS | No | P0 | Quality journalism, global |
| **Reuters** | RSS | No | P0 | Wire service, factual |
| **arXiv** | RSS/API | No | P1 | Academic papers, preprints |
| **Lobsters** | RSS | No | P1 | Tech community, curated |

#### Hacker News (P0)

**Access:**
- Official RSS: `https://hnrss.org/frontpage`
- Official API: `https://hacker-news.firebaseio.com/v0/`

**Features:**
- Real-time item updates
- Comment threads
- Points/ranking data

**Implementation:** Already in `feeds.catalogue.toml`

#### BBC News (P0)

**Access:**
- RSS Feeds: `http://feeds.bbci.co.uk/news/rss.xml`
- Multiple category feeds available

**Categories:**
- World, Business, Technology, Science, Health

**Implementation:** Already in `feeds.catalogue.toml`

#### Reuters (P0)

**Access:**
- RSS Feeds: `https://www.reuters.com/tools/rss`
- Categories: World, Business, Technology, Markets

**Note:** Some feeds may require registration

#### arXiv (P1)

**Access:**
- RSS: `http://arxiv.org/rss/`
- API: `http://export.arxiv.org/api/query`

**Categories:**
- cs.* (Computer Science)
- stat.ML (Machine Learning)
- econ.* (Economics)

**Implementation:** Already in `feeds.catalogue.toml`

#### Lobsters (P1)

**Access:**
- RSS: `https://lobste.rs/rss`
- JSON API: `https://lobste.rs/*.json`

**Features:**
- Tag-based filtering
- High quality tech content
- Community curated

**Implementation:** Already in `feeds.catalogue.toml`

---

## Feature Implementation Plan

### Phase 1 Features (MVP Launch)

| Feature | Priority | Description | Effort |
|---------|----------|-------------|--------|
| **SCORE** | P0 | Quality rating 0-100 via Claude Haiku | Done (rule-based) |
| **SHIELD** | P0 | No autoplay, explicit pagination, chronological | Medium |
| **Feed Display** | P0 | Render feed items with scores | Medium |
| **Curated Feed** | P0 | RSS-based public feed for ANONYMOUS | Done |
| **LinkedIn OAuth** | P1 | ENHANCE users pull own feed | High |

#### SCORE Implementation

**Current State:** Rule-based scoring implemented in `app/services/scoringService.js`

**LLM Enhancement:**
```javascript
// app/services/scoringService.js (already exists)
export const scoreWithLLM = async (item, options = {}) => {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  // Claude Haiku scoring with 4 dimensions
  // factual, original, professional, signal
};
```

**Cost Model:**
- Claude Haiku: $0.25/M input tokens, $1.25/M output tokens
- Estimated 200 tokens/item → $0.00005/item
- 100K items/month = $5 scoring cost

#### SHIELD Implementation

**Requirements:**
- Disable autoplay for video/audio content
- Explicit "Load more" pagination (no infinite scroll)
- Chronological feed ordering
- No engagement metrics display (likes, shares hidden)

**Frontend Changes:**
```javascript
// web/public/lib/feed-renderer.js
export const renderFeedItem = (item) => {
  // Render with SHIELD protections
  // - Static thumbnails for video
  // - No like/share counts
  // - Manual load buttons
};
```

#### Feed Display

**Lambda Structure:**
```
app/functions/feed/
├── feedGet.js           # Aggregate and serve feed
├── feedGetWorker.js     # Async feed processing
└── feedSource.js        # Source-specific fetchers
```

**DynamoDB Schema:**
```
scoresTable:
  PK: contentHash (16-char SHA-256)
  score: 0-100
  signals: { factual, original, professional, signal }
  scoredAt: ISO timestamp
  expiresAt: TTL (24 hours)
```

### Phase 2 Features (Early Traction)

| Feature | Priority | Description | Effort |
|---------|----------|-------------|--------|
| **DEDUP** | P0 | Semantic deduplication via embeddings | High |
| **MUTE** | P0 | Topic/source exclusion filters | Medium |
| **TRACE** | P1 | Origin tracking (original → reshares) | Medium |
| **Preferences UI** | P1 | User settings persistence | Medium |

#### DEDUP Implementation

**Approach:** Content embeddings with clustering

**Embedding Model Options:**
1. **all-MiniLM-L6-v2** (Self-hosted on Lambda)
   - 384 dimensions
   - ~10ms per embedding
   - No API cost

2. **Claude Embeddings** (API-based)
   - Higher quality
   - API cost per request

**Algorithm:**
```javascript
// app/functions/dedup/dedupPost.js
export const computeEmbedding = async (text) => {
  // Generate embedding for text
  // Store in embeddingsTable
  // Return vector for clustering
};

export const findDuplicates = async (embedding) => {
  // Cosine similarity against recent items
  // Return cluster ID if similar exists
  // Threshold: 0.85 similarity
};
```

**DynamoDB Schema:**
```
embeddingsTable:
  PK: contentHash
  embedding: Float32Array (384 dimensions)
  clusterId: string (nullable)
  createdAt: ISO timestamp
```

#### MUTE Implementation

**Requirements:**
- Mute by topic (keywords)
- Mute by source (domain/account)
- Mute by phrase (exact match)

**DynamoDB Schema:**
```
preferencesTable:
  PK: hashedSub
  SK: "mutes"
  topics: ["politics", "sports"]
  sources: ["twitter.com/spam_account"]
  phrases: ["shocking news", "you won't believe"]
```

#### TRACE Implementation

**Approach:** Track content propagation across sources

**Data Model:**
```
traceTable:
  PK: contentHash
  SK: sourceId
  firstSeenAt: ISO timestamp
  propagationPath: [
    { source: "reuters", time: "..." },
    { source: "bbc", time: "...", isReshare: true }
  ]
```

### Phase 3 Features ($20 Club Launch)

| Feature | Priority | Description | Effort |
|---------|----------|-------------|--------|
| **WIRE MODE** | P0 | Headline normalization via LLM | Medium |
| **CLUSTER** | P1 | Topic/geographic segmentation | High |
| **$20 Club** | P0 | Stripe integration for believers | Medium |
| **Usage Analytics** | P1 | CloudWatch RUM + custom metrics | Low |

#### WIRE MODE Implementation

**Purpose:** Rewrite sensational/clickbait headlines to neutral wire-service style

**LLM Prompt:**
```
Rewrite this headline in neutral wire-service style.
Remove sensationalism, emotion words, and clickbait patterns.
Keep the factual content intact.

Original: "You Won't BELIEVE What This CEO Did Next!"
Wire Mode: "CEO announces company restructuring plan"
```

**Implementation:**
```javascript
// app/functions/wire/wireTransform.js
export const normalizeHeadline = async (headline) => {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    messages: [{ role: 'user', content: WIRE_MODE_PROMPT + headline }],
    max_tokens: 100
  });
  return response.content[0].text;
};
```

#### $20 Club Implementation

**Stripe Integration:**
```javascript
// app/functions/payment/stripeWebhook.js
export const handleStripeEvent = async (event) => {
  switch (event.type) {
    case 'checkout.session.completed':
      // Grant HARD COPY bundle
      // Update bundlesTable with subscriptionId
      break;
    case 'customer.subscription.deleted':
      // Revoke HARD COPY bundle
      break;
  }
};
```

**War Chest Trigger Logic:**
- Track monthly revenue vs costs
- When profit ≥ 24× costs → Trigger fires
- All $20 Club founders go FREE (lifetime)

---

## AWS Infrastructure Considerations

### Current State (Phase 0 - Skeleton)

**Deployed Stacks:**
- EdgeStack - CloudFront, S3, WAF
- ApiStack - HTTP API Gateway v2
- AuthStack - Cognito, JWT authorizer
- DataStack - DynamoDB tables
- AccountStack - Bundle CRUD Lambdas

### Phase 1 Additions

**New CDK Stack: FeedStack.java**
```java
public class FeedStack extends Stack {
    private final Function feedGetFunction;
    private final Function feedGetWorkerFunction;
    private final Function scorePostFunction;

    // DynamoDB tables
    private final Table scoresTable;
    private final Table feedAsyncRequestsTable;
}
```

**New Lambda Functions:**
```
app/functions/feed/
├── feedGet.js           # GET /api/v1/feed
├── feedGetWorker.js     # SQS worker for async feed processing
└── scorePost.js         # POST /api/v1/score (internal)
```

**API Gateway Routes:**
```
GET /api/v1/feed          → feedGet (ANONYMOUS allowed)
GET /api/v1/feed/personal → feedGet (ENHANCE required)
POST /api/v1/score        → scorePost (internal only)
```

### Phase 2 Additions

**New Tables:**
```java
// DataStack.java additions
private final Table embeddingsTable;
private final Table clustersTable;
private final Table preferencesTable;
```

**New Lambda Functions:**
```
app/functions/dedup/
├── dedupPost.js         # Compute embeddings
└── dedupWorker.js       # Background clustering

app/functions/preferences/
├── preferencesGet.js    # GET /api/v1/preferences
└── preferencesPost.js   # POST /api/v1/preferences
```

### Phase 3 Additions

**New CDK Stack: PaymentStack.java**
```java
public class PaymentStack extends Stack {
    private final Function stripeWebhookFunction;
    private final Secret stripeSecretKey;
}
```

**Environment Variables:**
```
STRIPE_SECRET_KEY     → AWS Secrets Manager
STRIPE_WEBHOOK_SECRET → AWS Secrets Manager
$20_CLUB_PRICE_ID     → Stripe Price ID
```

### Cost Projections

**Phase 1 (100 ENHANCE + 100K ANONYMOUS):**
- Lambda: $2/month (minimal invocations)
- DynamoDB: $3/month (on-demand)
- CloudFront: $5/month (100GB transfer)
- LLM (Claude Haiku): $8/month (160K scorings)
- **Total: ~$19/month**

**Phase 2 (1,000 DAU):**
- Lambda: $15/month
- DynamoDB: $50/month (increased storage)
- CloudFront: $20/month
- LLM: $180/month (900K scorings)
- **Total: ~$270/month**

**Phase 3 (10,000 DAU):**
- Lambda: $80/month
- DynamoDB: $150/month
- CloudFront: $75/month
- LLM: $600/month (cache hits reduce volume)
- **Total: ~$905/month**

---

## Implementation Timeline

### Sprint 1: Core Feed Infrastructure
- [ ] Implement FeedStack.java CDK stack
- [ ] Create feedGet.js Lambda
- [ ] Create scoresTable in DataStack
- [ ] Wire up /api/v1/feed endpoint
- [ ] Basic feed display UI

### Sprint 2: Scoring Pipeline
- [ ] Integrate Claude Haiku for scoring
- [ ] Implement score caching
- [ ] Add SHIELD protections to UI
- [ ] Create score display component

### Sprint 3: Authentication Enhancement
- [ ] Add LinkedIn OAuth to IdentityStack
- [ ] Implement token storage
- [ ] Create personal feed endpoint
- [ ] Test OAuth flow end-to-end

### Sprint 4: DEDUP & MUTE
- [ ] Implement embedding generation
- [ ] Create clustering algorithm
- [ ] Build MUTE preferences UI
- [ ] Test deduplication accuracy

### Sprint 5: WIRE MODE & $20 Club
- [ ] Implement headline normalization
- [ ] Integrate Stripe
- [ ] Create subscription flow
- [ ] Test payment webhooks

---

## Success Criteria

**MVP Launch (End of Sprint 3):**
- [ ] ANONYMOUS user can view curated feed
- [ ] Each item displays SCORE (0-100)
- [ ] ENHANCE user can sign in with Google/LinkedIn
- [ ] ENHANCE user sees personalized feed
- [ ] SHIELD protections active (no autoplay, pagination)
- [ ] Page load <2s for 20 items

**Early Traction (End of Sprint 4):**
- [ ] DEDUP groups similar items
- [ ] MUTE filters work correctly
- [ ] Preferences persist across sessions
- [ ] First 10 beta testers acquired

**$20 Club Launch (End of Sprint 5):**
- [ ] WIRE MODE rewrites headlines
- [ ] Stripe subscription functional
- [ ] War chest tracking active
- [ ] First $20 Club member acquired

---

## Risk Mitigation

### API Access Risks

**Risk:** OAuth access revoked by platforms
**Mitigation:**
- RSS fallback for public content
- Multiple platform support
- Clear user communication about access scope

**Risk:** Rate limits hit during peak usage
**Mitigation:**
- Aggressive caching (content-addressed)
- Request coalescing for duplicate content
- Graceful degradation (serve stale)

### Cost Risks

**Risk:** LLM costs exceed projections
**Mitigation:**
- Score caching with 24-hour TTL
- Rule-based fallback for low-importance content
- Model flexibility (can swap to cheaper alternatives)

### Technical Risks

**Risk:** Cold start latency affects UX
**Mitigation:**
- Provisioned concurrency for critical paths
- Edge caching for static content
- Progressive loading UI

---

*The Quiet Feed. Enhance. Stop.*
