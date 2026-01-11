# The Quiet Feed - Phase 1: Prototype Implementation Plan

**Document:** AGENT_PLAN_PROTOTYPE.md
**Version:** 1.0
**Date:** 2026-01-11
**Status:** Planning
**Parent:** AGENT_PLAN_SCALING_PHASES.md (Phase 1)

---

## Overview

Phase 1 delivers the core prototype with SCORE, SHIELD, and basic feed functionality. This is the "Enhance Unlimited Beta" phase targeting 100 ENHANCE users and 100K ANONYMOUS users.

**Monthly Cost Target:** ~$19
**Primary Cost Driver:** LLM scoring (44%)

---

## Success Criteria

### Functional Requirements

- [ ] Anonymous user can view DEFAULT feed without login
- [ ] Anonymous user sees SCORE (0-100) on each item
- [ ] Authenticated user can sign in with Google OAuth (existing)
- [ ] Authenticated user can connect LinkedIn OAuth
- [ ] Authenticated user sees their LinkedIn feed with scores
- [ ] SHIELD: No autoplay, explicit "Load more" pagination
- [ ] Page load <2s for 20 items
- [ ] SCORE accuracy: 85%+ agreement with manual labels

### Technical Requirements

- [ ] All secrets in AWS Secrets Manager
- [ ] OAuth tokens encrypted at rest (DynamoDB encryption)
- [ ] Frontend works without JavaScript frameworks (vanilla ESM)
- [ ] Deploys via GitHub Actions (`git push origin`)
- [ ] CDK stacks synthesize without errors

---

## Architecture Additions

### New DynamoDB Tables

**scoresTable** - Content hash to score cache
```
Partition Key: contentHash (S)
Attributes:
  - score (N): 0-100 quality rating
  - signals (M): scoring breakdown
  - modelId (S): LLM model used
  - createdAt (S): ISO timestamp
  - expiresAt (N): TTL epoch seconds (7 days default)

GSI: None (direct hash lookup only)
TTL: expiresAt (automatic cleanup)
```

**feedSourcesTable** - Curated RSS sources for DEFAULT tier
```
Partition Key: sourceId (S)
Attributes:
  - feedUrl (S): RSS/Atom URL
  - sourceName (S): Display name
  - category (S): Topic category
  - enabled (BOOL): Active flag
  - lastFetched (S): ISO timestamp
  - lastError (S): Error message if failed
```

**feedAsyncRequestsTable** - Async feed fetch state
```
Same pattern as bundlePostAsyncRequestsTable
Partition Key: requestId (S)
```

### New Lambda Functions

```
app/functions/feed/
├── feedGet.js           # GET /api/v1/feed - Authenticated feed
├── feedGetAnon.js       # GET /api/v1/feed/default - Anonymous feed
├── feedGetWorker.js     # Async feed processing (if needed)
└── rssRefresh.js        # EventBridge scheduled RSS fetch

app/functions/score/
├── scorePost.js         # POST /api/v1/score - Score single item
└── scoreBatch.js        # Batch scoring worker
```

### New CDK Stack

**FeedStack.java** - Feed and scoring infrastructure
```java
public class FeedStack extends Stack {
    // 1. feedGet Lambda (authenticated route)
    // 2. feedGetAnon Lambda (public route)
    // 3. scorePost Lambda (internal/authenticated)
    // 4. rssRefresh Lambda (EventBridge scheduled)
    // 5. API Gateway routes
    // 6. IAM roles with least privilege
}
```

### API Routes

| Method | Path | Auth | Lambda | Description |
|--------|------|------|--------|-------------|
| GET | /api/v1/feed | JWT | feedGet | User's authenticated feed |
| GET | /api/v1/feed/default | None | feedGetAnon | Curated public feed |
| POST | /api/v1/score | JWT | scorePost | Score individual item |

---

## Implementation Tracks

### Track 1: Data Layer (~1 day)

**Objective:** Add DynamoDB tables for scores and feed sources

**Files to create/modify:**
- `infra/main/java/com/thequietfeed/stacks/DataStack.java` - Add tables
- `app/data/dynamoDbScoreRepository.js` - Score CRUD
- `app/data/dynamoDbFeedSourceRepository.js` - Feed source CRUD

**scoresTable DynamoDB operations:**
```javascript
// dynamoDbScoreRepository.js
export const getScore = async (contentHash) => { ... };
export const putScore = async (contentHash, score, signals, modelId) => { ... };
export const batchGetScores = async (contentHashes) => { ... };
```

**Content hash algorithm:**
```javascript
// Use SHA-256 of normalized content for dedup-safe caching
import { createHash } from 'crypto';

export const computeContentHash = (item) => {
  const normalized = JSON.stringify({
    url: item.url,
    title: item.title?.toLowerCase().trim(),
    // Exclude author/timestamp for dedup across reshares
  });
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
};
```

### Track 2: Scoring Service (~2 days)

**Objective:** Claude API integration for quality scoring

**Files to create:**
- `app/services/scoringService.js` - LLM scoring logic
- `app/functions/score/scorePost.js` - Lambda handler
- `app/lib/claudeClient.js` - Anthropic SDK wrapper

**Scoring prompt (Claude Haiku):**
```javascript
const SCORING_PROMPT = `
Rate this social media post for informational quality on a scale of 0-100.

Consider:
- Factual substance (not just opinion/reaction)
- Original insight vs reshared content
- Professional relevance vs personal update
- Signal vs noise ratio

Post:
{content}

Respond with JSON only:
{
  "score": <0-100>,
  "signals": {
    "factual": <0-25>,
    "original": <0-25>,
    "professional": <0-25>,
    "signal": <0-25>
  },
  "reasoning": "<one sentence>"
}
`;
```

**Cost estimation at Phase 1 scale:**
```
100 ENHANCE × 200 items = 20,000 items
100K ANONYMOUS × 30 items = 3,000,000 items
Cache hit rate: 60% overlap = ~1,200,000 unique items
Claude Haiku: $0.25/1M input, $1.25/1M output
~500 tokens/item average
Cost: ~$8.40/month for scoring
```

### Track 3: Curated Feed (DEFAULT Tier) (~1 day)

**Objective:** RSS-based public feed for anonymous users

**Files to create:**
- `app/functions/feed/feedGetAnon.js` - Anonymous feed handler
- `app/functions/feed/rssRefresh.js` - Scheduled RSS fetch
- `app/services/rssFeedService.js` - RSS parsing

**Initial curated sources:**
```javascript
const DEFAULT_SOURCES = [
  { sourceId: 'bbc-news', feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'news' },
  { sourceId: 'reuters-world', feedUrl: 'https://www.reutersagency.com/feed/', category: 'news' },
  { sourceId: 'hackernews', feedUrl: 'https://hnrss.org/frontpage', category: 'tech' },
  { sourceId: 'arxiv-cs', feedUrl: 'https://export.arxiv.org/rss/cs', category: 'research' },
];
```

**RSS refresh schedule:**
- EventBridge rule: every 15 minutes
- Fetch all enabled sources
- Parse and store items in S3 (hot cache)
- Score new items via scoreBatch

### Track 4: LinkedIn OAuth (~2 days)

**Objective:** ENHANCE users can connect LinkedIn

**LinkedIn API scopes needed:**
- `r_liteprofile` - Basic profile
- `r_emailaddress` - Email (for account linking)
- `r_basicprofile` - Profile details

**Note:** LinkedIn's Share API is limited. For feed access, we need:
- Marketing API access (requires LinkedIn Partner approval)
- OR user-delegated feed fetch via browser extension
- OR curated LinkedIn public pages via RSS

**Pragmatic approach for prototype:**
1. Implement LinkedIn OAuth for identity verification
2. For feed content, use curated LinkedIn public pages (RSS where available)
3. Document limitation clearly to users
4. Plan browser extension for true feed access in Phase 2

**Files to modify:**
- `infra/main/java/com/thequietfeed/stacks/IdentityStack.java` - Add LinkedIn provider
- `app/functions/auth/linkedinTokenPost.js` - Token exchange
- `web/public/auth/loginWithLinkedIn.html` - OAuth initiation

### Track 5: Frontend Feed UI (~2 days)

**Objective:** Display scored feed with SHIELD principles

**Files to create:**
- `web/public/feed/index.html` - Main feed page
- `web/public/feed/feed.js` - Feed rendering logic
- `web/public/css/feed.css` - Feed-specific styles

**SHIELD implementation:**
```javascript
// No autoplay
video.autoplay = false;
video.preload = 'none';

// Explicit pagination (not infinite scroll)
const loadMoreBtn = document.getElementById('load-more');
loadMoreBtn.addEventListener('click', () => loadNextPage());

// Chronological by default
items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
```

**Score display component:**
```html
<div class="feed-item" data-score="85">
  <div class="score-badge">
    <span class="score-value">85</span>
    <span class="score-label">SCORE</span>
  </div>
  <h2 class="item-title">{title}</h2>
  <p class="item-source">{source} · {timeAgo}</p>
  <a href="{originalUrl}" class="item-link" target="_blank">View original</a>
</div>
```

**Design variables (from AGENT_PLAN_PROTOTYPE.md):**
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

## Sprint Breakdown

### Sprint 1: Data Layer Foundation
- [ ] Add scoresTable to DataStack.java
- [ ] Add feedSourcesTable to DataStack.java
- [ ] Create dynamoDbScoreRepository.js
- [ ] Create dynamoDbFeedSourceRepository.js
- [ ] Unit tests for repositories
- [ ] Deploy and verify tables created

### Sprint 2: Scoring Service
- [ ] Create claudeClient.js with Anthropic SDK
- [ ] Create scoringService.js with scoring logic
- [ ] Create scorePost.js Lambda handler
- [ ] Add Claude API key to Secrets Manager
- [ ] Create FeedStack.java with scorePost Lambda
- [ ] Unit tests for scoring service
- [ ] Deploy and test scoring endpoint

### Sprint 3: Curated Feed (DEFAULT)
- [ ] Create rssFeedService.js for RSS parsing
- [ ] Create rssRefresh.js EventBridge Lambda
- [ ] Create feedGetAnon.js for anonymous feed
- [ ] Seed feedSourcesTable with initial sources
- [ ] Add routes to ApiStack.java
- [ ] Deploy and verify RSS refresh working

### Sprint 4: Frontend Feed UI
- [ ] Create feed/index.html page structure
- [ ] Create feed.js rendering logic
- [ ] Create feed.css with design system
- [ ] Implement SHIELD controls (no autoplay, pagination)
- [ ] Integrate with feedGetAnon endpoint
- [ ] Browser tests for feed display

### Sprint 5: LinkedIn OAuth + Polish
- [ ] Add LinkedIn provider to IdentityStack.java
- [ ] Create LinkedIn OAuth callback handling
- [ ] Connect authenticated feed to user profile
- [ ] Create feedGet.js for authenticated users
- [ ] End-to-end behaviour tests
- [ ] Performance optimization (<2s load time)

---

## Testing Strategy

### Unit Tests
```
app/unit-tests/
├── functions/feed/
│   ├── feedGet.unit.test.js
│   ├── feedGetAnon.unit.test.js
│   └── rssRefresh.unit.test.js
├── functions/score/
│   └── scorePost.unit.test.js
├── services/
│   ├── scoringService.unit.test.js
│   └── rssFeedService.unit.test.js
└── data/
    ├── dynamoDbScoreRepository.unit.test.js
    └── dynamoDbFeedSourceRepository.unit.test.js
```

### Behaviour Tests (Gherkin)
```gherkin
Feature: Anonymous Feed Access

  Scenario: View curated feed without login
    Given I am not logged in
    When I visit /feed
    Then I see a feed of curated items
    And each item displays a SCORE (0-100)
    And each item links to original source

  Scenario: SHIELD - No autoplay
    Given I am viewing the feed
    And there is a video item
    Then the video does not play automatically

  Scenario: SHIELD - Pagination
    Given I am viewing the feed
    And I scroll to the bottom
    Then I see a "Load more" button
    And more items do not load automatically
```

### Score Accuracy Validation
```bash
# Generate test set from curated sources
npm run test:score-accuracy

# Manual labeling (100 items, target 85% agreement)
# Compare model scores vs human labels
```

---

## Cost Breakdown (Phase 1)

| Component | Monthly Cost | % of Total |
|-----------|-------------|------------|
| Claude Haiku (scoring) | $8.40 | 44% |
| DynamoDB (on-demand) | $2.00 | 11% |
| Lambda (invocations) | $1.50 | 8% |
| CloudFront (CDN) | $3.00 | 16% |
| S3 (static + cache) | $1.00 | 5% |
| API Gateway | $2.00 | 11% |
| Secrets Manager | $1.00 | 5% |
| **Total** | **~$19** | 100% |

---

## Risk Mitigation

### LinkedIn API Risk
**Risk:** LinkedIn restricts API access for feed data
**Mitigation:**
- Start with curated LinkedIn public pages
- Plan browser extension for Phase 2
- Clear user communication about limitations

### Score Quality Risk
**Risk:** LLM scores don't match user expectations
**Mitigation:**
- Manual labeling validation (85% target)
- Expose scoring signals for transparency
- User feedback mechanism for score corrections

### Cold Start Risk
**Risk:** Lambda cold starts impact <2s load target
**Mitigation:**
- Keep Lambda packages small
- Consider provisioned concurrency for feedGetAnon
- CloudFront caching for static feed items

---

## Dependencies

### External Services
- Anthropic Claude API (scoring)
- LinkedIn Developer App (OAuth)
- RSS sources (curated list)

### AWS Services
- DynamoDB (tables)
- Lambda (functions)
- API Gateway v2 (routes)
- EventBridge (scheduling)
- Secrets Manager (API keys)
- CloudFront (CDN)

### Internal Dependencies
- Phase 0 infrastructure (complete)
- Google OAuth (existing, working)
- Bundle system (existing, template for patterns)

---

## Acceptance Checklist

Before declaring Phase 1 complete:

- [ ] `npm test` passes (all unit tests)
- [ ] `./mvnw clean verify` passes (CDK synthesis)
- [ ] `npm run test:behaviour-proxy` passes (E2E tests)
- [ ] Anonymous user can view /feed with scores
- [ ] Scores display 0-100 with signal breakdown
- [ ] SHIELD: No autoplay on videos
- [ ] SHIELD: Explicit pagination (not infinite scroll)
- [ ] Page load <2s for 20 items
- [ ] Score accuracy ≥85% vs manual labels
- [ ] LinkedIn OAuth initiates (even if feed limited)
- [ ] Cost tracking shows <$25/month at prototype scale

---

*Phase 1 complete when: Users can view a scored feed that respects their attention.*

*Next: AGENT_PLAN_PHASE2_DEDUP.md (DEDUP, MUTE, TRACE)*
