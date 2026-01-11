# The Quiet Feed: POC1 Branch Progress Review

**Date:** January 2026  
**Branch:** `poc1`  
**Reference:** `_developers/the-quiet-feed-brief.pdf` (v1.2)

---

## Executive Summary

The `poc1` branch has made significant progress on the prototype foundation, implementing approximately **40% of the Phase 1 requirements** from the brief. The core infrastructure is solid, with authentication, bundle management, and the basic feed display working. The scoring service architecture is in place with both rule-based and LLM-based paths, and RSS feed ingestion is functional.

**Key gaps:** No AWS-deployed scoring infrastructure yet, no score caching in DynamoDB, limited OAuth (Google only, no LinkedIn), and the CLI (TERM) is not started.

---

## Progress Assessment

### ✅ COMPLETED Features

| Feature | Status | Notes |
|---------|--------|-------|
| **ANONYMOUS feed display** | ✅ Complete | `/index.html` with feed selector |
| **SCORE display** | ✅ Complete | 0-100 badge on each item |
| **SHIELD (no autoplay)** | ✅ Complete | Explicit "Load more" pagination |
| **Feed-based navigation** | ✅ Complete | `?feed=about`, `?feed=tech`, etc. |
| **Sample JSON feeds** | ✅ Complete | In `app/test-data/sample-feeds/` |
| **RSS feed ingestion** | ✅ Complete | `rssFeedService.js`, `fetch-rss-feeds.js` |
| **Content hash computation** | ✅ Complete | `contentHash.js` with SHA-256 |
| **LLM client abstraction** | ✅ Complete | `llmClient.js` with Ollama/Claude |
| **Rule-based scoring** | ✅ Complete | `scoringService.js` with heuristics |
| **LLM-based scoring** | ✅ Complete | `scoringService.js` with Claude prompt |
| **Google OAuth** | ✅ Complete | Via Cognito |
| **Bundle CRUD** | ✅ Complete | Placeholder for feed configs |
| **Mock OAuth2 (local)** | ✅ Complete | Docker container |
| **Dynalite (local DynamoDB)** | ✅ Complete | For development |
| **Behaviour tests** | ✅ Complete | `test:anonymousBehaviour-proxy` |
| **Feeds catalog (TOML)** | ✅ Complete | `feeds.catalogue.toml` with health checks |

### 🔄 IN PROGRESS Features

| Feature | Status | Remaining Work |
|---------|--------|----------------|
| **Score caching** | 🔄 50% | Scripts exist, DynamoDB table needed |
| **Local Ollama integration** | 🔄 80% | Working but not in CI yet |
| **Feed processing pipeline** | 🔄 60% | Scripts exist, Lambda wrapper needed |

### ❌ NOT STARTED Features

| Feature | Priority | Notes |
|---------|----------|-------|
| **FeedStack CDK** | HIGH | No Lambda functions for scoring/feed |
| **scoresTable DynamoDB** | HIGH | No score persistence to AWS |
| **feedSourcesTable DynamoDB** | MEDIUM | Sources in TOML, could move to DDB |
| **scorePost Lambda** | HIGH | Needed for production scoring |
| **feedGetAnon Lambda** | HIGH | Public feed API |
| **feedGet Lambda** | MEDIUM | Authenticated personal feed |
| **LinkedIn OAuth** | MEDIUM | Planned in brief, not implemented |
| **TERM CLI** | MEDIUM | No terminal client exists |
| **DEDUP** | LOW | Phase 2 feature |
| **TRACE** | LOW | Phase 2 feature |
| **MUTE (server-side)** | LOW | localStorage only currently |
| **WIRE MODE** | LOW | UI checkbox exists, no backend |

---

## Architecture Analysis

### Current State (poc1)

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (web/public/)                                          │
│  ├─ index.html - Feed display with SCORE badges                 │
│  ├─ Static sample feeds (JSON)                                  │
│  └─ No server-side feed generation                              │
└─────────────────────────────────────────────────────────────────┘
         │
         │ (Currently: static files only)
         │ (Missing: /api/v1/feed, /api/v1/score endpoints)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (app/)                                                  │
│  ├─ functions/auth/ - cognitoTokenPost, customAuthorizer ✅     │
│  ├─ functions/account/ - bundleGet/Post/Delete ✅               │
│  ├─ functions/feed/ - NOT EXISTS ❌                             │
│  ├─ functions/score/ - NOT EXISTS ❌                            │
│  └─ services/ - scoringService ✅, rssFeedService ✅            │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER (DynamoDB)                                           │
│  ├─ bundlesTable ✅ (user preferences)                          │
│  ├─ bundlePostAsyncRequestsTable ✅                             │
│  ├─ bundleDeleteAsyncRequestsTable ✅                           │
│  ├─ scoresTable ❌ (NOT DEPLOYED)                               │
│  ├─ feedSourcesTable ❌ (NOT DEPLOYED)                          │
│  └─ usersTable ❌ (NOT DEPLOYED - for enhanced user state)      │
└─────────────────────────────────────────────────────────────────┘
```

### Gap: Feed/Score Pipeline

The brief specifies a feed pipeline where content is:
1. Fetched from RSS sources
2. Scored via Claude API
3. Cached in DynamoDB
4. Served to users

**Current state:** Steps 1-2 work in local scripts, but there's no Lambda infrastructure to run this in AWS.

---

## Outstanding Tasks

### Phase 1: Core Infrastructure (Priority: HIGH)

#### Task 1: Add scoresTable to DataStack.java

```java
// Add to DataStack.java after bundlesTable

// Content scores cache
this.scoresTable = Table.Builder.create(this, props.resourceNamePrefix() + "-ScoresTable")
    .tableName(props.sharedNames().scoresTableName)
    .partitionKey(Attribute.builder()
        .name("contentHash")
        .type(AttributeType.STRING)
        .build())
    .billingMode(BillingMode.PAY_PER_REQUEST)
    .timeToLiveAttribute("expiresAt")
    .removalPolicy(RemovalPolicy.DESTROY)
    .build();
```

**Files to modify:**
- `infra/main/java/com/thequietfeed/stacks/DataStack.java`
- `infra/main/java/com/thequietfeed/QuietFeedSharedNames.java`

#### Task 2: Create FeedStack.java

New CDK stack for feed and scoring infrastructure:

```java
// infra/main/java/com/thequietfeed/stacks/FeedStack.java

public class FeedStack extends Stack {
    public IFunction feedGetAnonFunction;
    public IFunction feedGetFunction;
    public IFunction scorePostFunction;
    public IFunction scoreBatchFunction;
    public IFunction rssRefreshFunction;
    
    // Lambda functions:
    // 1. feedGetAnon - GET /api/v1/feed/default (no auth)
    // 2. feedGet - GET /api/v1/feed (JWT auth)
    // 3. scorePost - POST /api/v1/score (internal/auth)
    // 4. scoreBatch - SQS worker for batch scoring
    // 5. rssRefresh - EventBridge scheduled (every 15 min)
}
```

**Files to create:**
- `infra/main/java/com/thequietfeed/stacks/FeedStack.java`
- `infra/main/java/com/thequietfeed/stacks/ImmutableFeedStackProps.java`

#### Task 3: Create Lambda Handlers

```
app/functions/feed/
├── feedGetAnon.js       # GET /api/v1/feed/default
├── feedGet.js           # GET /api/v1/feed (authenticated)
├── rssRefresh.js        # EventBridge scheduled
└── feedGetWorker.js     # Async feed processing (if needed)

app/functions/score/
├── scorePost.js         # POST /api/v1/score
└── scoreBatch.js        # SQS batch worker
```

#### Task 4: Add Score Repository

```javascript
// app/data/dynamoDbScoreRepository.js

export const getScore = async (contentHash) => { ... };
export const putScore = async (contentHash, scoreData) => { ... };
export const batchGetScores = async (contentHashes) => { ... };
```

**Files to create:**
- `app/data/dynamoDbScoreRepository.js`
- `app/unit-tests/data/dynamoDbScoreRepository.unit.test.js`

#### Task 5: Add API Routes to ApiStack

```java
// Add to ApiStack.java

// Public feed endpoint (no auth)
HttpRoute.Builder.create(this, "FeedGetAnonRoute")
    .routeKey(HttpRouteKey.with("/api/v1/feed/default", HttpMethod.GET))
    .integration(feedGetAnonIntegration)
    .build();

// Authenticated feed endpoint
HttpRoute.Builder.create(this, "FeedGetRoute")
    .routeKey(HttpRouteKey.with("/api/v1/feed", HttpMethod.GET))
    .integration(feedGetIntegration)
    .authorizer(jwtAuthorizer)
    .build();

// Score endpoint (authenticated)
HttpRoute.Builder.create(this, "ScorePostRoute")
    .routeKey(HttpRouteKey.with("/api/v1/score", HttpMethod.POST))
    .integration(scorePostIntegration)
    .authorizer(jwtAuthorizer)
    .build();
```

### Phase 2: Storage Infrastructure (Priority: HIGH)

#### Task 6: Add S3 Buckets for Content Cache

```java
// infra/main/java/com/thequietfeed/stacks/StorageStack.java (NEW)

public class StorageStack extends Stack {
    public IBucket scoresBucket;      // Cached score JSON files
    public IBucket feedsBucket;       // Generated feed JSON
    public IBucket publicFeedsBucket; // Public/anonymous feeds
}
```

#### Task 7: Add usersTable for ENHANCE State

```java
// Add to DataStack.java

// Users table (single-table design)
this.usersTable = Table.Builder.create(this, props.resourceNamePrefix() + "-UsersTable")
    .tableName(props.sharedNames().usersTableName)
    .partitionKey(Attribute.builder()
        .name("hashedSub")
        .type(AttributeType.STRING)
        .build())
    .sortKey(Attribute.builder()
        .name("sk")
        .type(AttributeType.STRING)
        .build())
    .billingMode(BillingMode.PAY_PER_REQUEST)
    .timeToLiveAttribute("ttl")
    .pointInTimeRecoverySpecification(...)
    .build();

// GSI for token expiry queries
this.usersTable.addGlobalSecondaryIndex(...);
```

### Phase 3: OAuth & Limits (Priority: MEDIUM)

#### Task 8: Add ENHANCE Daily Limit

```javascript
// app/services/scoreLimitService.js

export const checkDailyLimit = async (userId) => {
  const today = new Date().toISOString().split('T')[0];
  const key = `LIMIT#${today}`;
  const current = await getUserState(userId, key);
  return {
    remaining: ENHANCE_DAILY_LIMIT - (current?.count || 0),
    limit: ENHANCE_DAILY_LIMIT,
    resetsAt: getNextMidnightUTC()
  };
};

export const incrementDailyCount = async (userId, count = 1) => { ... };
```

#### Task 9: LinkedIn OAuth Setup

**Files to create:**
- `app/functions/auth/linkedinTokenPost.js`
- `web/public/auth/loginWithLinkedIn.html`

**CDK changes:**
- Add LinkedIn as identity provider in IdentityStack.java
- Store LinkedIn client secret in Secrets Manager

### Phase 4: CLI / TERM (Priority: MEDIUM)

#### Task 10: Create CLI Package

```
packages/term/
├── package.json
├── bin/
│   └── qf.js           # Entry point
├── src/
│   ├── index.js        # Main app
│   ├── commands/
│   │   ├── feed.js     # qf feed
│   │   ├── auth.js     # qf auth
│   │   └── config.js   # qf config
│   ├── ui/
│   │   ├── FeedList.js # Ink component
│   │   └── ScoreBadge.js
│   └── api/
│       └── client.js   # HTTP client
└── README.md
```

**Dependencies:**
- `ink` - React for CLI
- `ink-select-input` - Selection UI
- `open` - Open URLs in browser

### Phase 5: Testing & CI (Priority: MEDIUM)

#### Task 11: Add Ollama to GitHub Actions

```yaml
# .github/workflows/test.yml

services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - 11434:11434

steps:
  - name: Pull test model
    run: |
      curl -X POST http://localhost:11434/api/pull \
        -d '{"name": "phi3:mini"}'
```

#### Task 12: Score Accuracy Validation

```javascript
// app/system-tests/scoreAccuracy.system.test.js

// Compare LLM scores to manually labeled test set
// Target: 85% agreement
```

---

## CDK Changes Summary

### Files to Create

| File | Purpose |
|------|---------|
| `stacks/FeedStack.java` | Feed/score Lambda infrastructure |
| `stacks/StorageStack.java` | S3 buckets for caching |
| `stacks/ImmutableFeedStackProps.java` | Props for FeedStack |
| `stacks/ImmutableStorageStackProps.java` | Props for StorageStack |

### Files to Modify

| File | Changes |
|------|---------|
| `DataStack.java` | Add scoresTable, usersTable |
| `ApiStack.java` | Add /feed, /score routes |
| `IdentityStack.java` | Add LinkedIn provider |
| `QuietFeedSharedNames.java` | Add new table/bucket names |
| `QuietFeedApplication.java` | Instantiate new stacks |

### New Environment Variables

```bash
# Lambda environment
SCORES_TABLE_NAME=quietfeed-{env}-scores
USERS_TABLE_NAME=quietfeed-{env}-users
SCORES_BUCKET_NAME=quietfeed-{env}-scores
FEEDS_BUCKET_NAME=quietfeed-{env}-feeds

# Feature flags
ENHANCE_DAILY_LIMIT=50
ENABLE_LINKEDIN_OAUTH=false

# LLM (from Secrets Manager)
ANTHROPIC_API_KEY_ARN=arn:aws:secretsmanager:...
```

---

## Recommended Implementation Order

```
Week 1: Data Layer
├─ Task 1: scoresTable in DataStack
├─ Task 4: dynamoDbScoreRepository.js
├─ Task 6: StorageStack with S3 buckets
└─ Deploy and verify

Week 2: Lambda Functions
├─ Task 3: feedGetAnon.js, scorePost.js
├─ Task 2: FeedStack.java
├─ Task 5: API routes in ApiStack
└─ Deploy and test scoring endpoint

Week 3: Integration
├─ Task 7: usersTable for user state
├─ Task 8: Daily limit service
├─ Wire frontend to live API
└─ End-to-end behaviour tests

Week 4: Polish
├─ Task 9: LinkedIn OAuth (if time)
├─ Task 10: CLI prototype
├─ Task 11: Ollama in CI
└─ Documentation updates
```

---

## Success Metrics (from Brief)

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| Anonymous feed works | ✓ | ✓ (static) | Need API |
| SCORE on items | ✓ | ✓ (mocked) | Need live scoring |
| SHIELD (no autoplay) | ✓ | ✓ | Complete |
| Page load <2s | <2s | ~1s | On track |
| Score accuracy | 85% | N/A | Need validation |
| LinkedIn OAuth | ✓ | ❌ | Not started |
| Monthly cost | <$25 | $0 | Not deployed |

---

## Conclusion

The `poc1` branch has strong foundations but needs the AWS infrastructure to become a real product. The immediate priorities are:

1. **scoresTable** - Without this, scores are ephemeral
2. **FeedStack** - Lambdas for feed/score endpoints
3. **API routes** - Connect frontend to live backend
4. **Daily limits** - Enforce ENHANCE tier caps

Once these are deployed, the prototype will match the brief's Phase 1 requirements. The CLI and LinkedIn OAuth can follow as secondary priorities.
