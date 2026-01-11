# The Quiet Feed: Static-First Architecture Design

**Version:** 1.0  
**Date:** January 2026  
**Status:** Design Proposal

---

## Executive Summary

This document describes a **static-first architecture** for The Quiet Feed where:

1. **Derived content** (scores, clusters, feed indexes) is pre-computed and stored as static JSON files in S3
2. **User state** (preferences, mutes, subscriptions, tokens) is stored in DynamoDB with user-triggered sync to static files
3. **Actual content** is fetched by the browser directly from source platforms using the user's OAuth tokens
4. **APIs exist only for writes** - all reads are static file fetches from CloudFront

This architecture achieves near-zero marginal cost per user while preserving privacy (we never proxy content) and legal defensibility (we store only our derivative analysis).

---

## Part 1: Data Model

### 1.1 Content Layer (Public, Cached Forever)

These are **our derivative works** - scores and analysis we've computed. They're public, cacheable, and immutable once written.

```
s3://quietfeed-{env}-content/
├── scores/
│   └── {content-hash}.json          # Score for a specific content item
├── clusters/
│   ├── {cluster-id}/
│   │   └── manifest.json            # Dedup cluster membership
│   └── topics/
│       └── {topic-slug}.json        # Topic cluster (uk-politics, ml, etc.)
└── sources/
    └── {source}/{source-id}.json    # Source metadata (not content)
```

**Score Document** (`scores/{content-hash}.json`):
```json
{
  "hash": "sha256:abc123...",
  "score": 87,
  "components": {
    "originality": 92,
    "aiConfidence": 0.15,
    "engagementAuthenticity": 78,
    "informationDensity": 85,
    "sourceReputation": 90
  },
  "clusters": ["uk-politics", "elections"],
  "canonical": true,
  "duplicateOf": null,
  "scoredAt": "2026-01-11T10:30:00Z",
  "model": "haiku-3",
  "version": "1.0"
}
```

**Cluster Manifest** (`clusters/{cluster-id}/manifest.json`):
```json
{
  "clusterId": "elections-2026-uk",
  "topic": "uk-politics",
  "canonicalHash": "sha256:abc123...",
  "members": [
    { "hash": "sha256:abc123...", "score": 87, "source": "linkedin" },
    { "hash": "sha256:def456...", "score": 72, "source": "twitter" },
    { "hash": "sha256:ghi789...", "score": 65, "source": "reddit" }
  ],
  "updatedAt": "2026-01-11T10:35:00Z"
}
```

### 1.2 User Layer (Private, Per-User)

User-specific data that requires authentication to write but is published as static files for reading.

```
s3://quietfeed-{env}-users/
└── {user-hash}/
    ├── feed.json                    # Pre-computed feed index
    ├── settings.json                # User preferences (exported from DynamoDB)
    ├── mutes.json                   # Mute rules
    ├── subscriptions.json           # Feed subscriptions
    └── tokens/                      # OAuth tokens (encrypted, short TTL)
        └── {provider}.enc.json
```

**Feed Index** (`{user-hash}/feed.json`):
```json
{
  "userId": "hash:xyz789...",
  "generatedAt": "2026-01-11T11:00:00Z",
  "expiresAt": "2026-01-11T12:00:00Z",
  "items": [
    {
      "hash": "sha256:abc123...",
      "source": "linkedin",
      "sourceId": "urn:li:share:7123456789",
      "score": 87,
      "cluster": "elections-2026-uk",
      "isCanonical": true,
      "publishedAt": "2026-01-11T09:00:00Z"
    },
    {
      "hash": "sha256:def456...",
      "source": "twitter",
      "sourceId": "1876543210987654321",
      "score": 72,
      "cluster": "elections-2026-uk",
      "isCanonical": false,
      "canonicalHash": "sha256:abc123...",
      "publishedAt": "2026-01-11T09:15:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "2026-01-11T09:00:00Z",
    "hasMore": true
  }
}
```

**User Settings** (`{user-hash}/settings.json`):
```json
{
  "userId": "hash:xyz789...",
  "tier": "enhance",
  "bundles": ["enhance", "linkedin-oauth"],
  "preferences": {
    "scoreThreshold": 60,
    "showDuplicates": false,
    "wireMode": true,
    "chronological": false,
    "itemsPerPage": 50
  },
  "features": {
    "score": true,
    "trace": true,
    "dedup": true,
    "mute": true,
    "wireMode": true,
    "shield": true,
    "demote": true,
    "cluster": true
  },
  "updatedAt": "2026-01-11T10:00:00Z",
  "version": 3
}
```

**Mutes** (`{user-hash}/mutes.json`):
```json
{
  "userId": "hash:xyz789...",
  "rules": [
    {
      "id": "mute-001",
      "type": "keyword",
      "value": "crypto",
      "scope": "all",
      "createdAt": "2026-01-10T15:00:00Z"
    },
    {
      "id": "mute-002",
      "type": "account",
      "value": "linkedin:urn:li:person:ABC123",
      "scope": "all",
      "createdAt": "2026-01-09T12:00:00Z"
    },
    {
      "id": "mute-003",
      "type": "topic",
      "value": "nft",
      "scope": "all",
      "createdAt": "2026-01-08T09:00:00Z"
    }
  ],
  "updatedAt": "2026-01-10T15:00:00Z"
}
```

**Subscriptions** (`{user-hash}/subscriptions.json`):
```json
{
  "userId": "hash:xyz789...",
  "feeds": [
    {
      "id": "sub-001",
      "type": "oauth",
      "provider": "linkedin",
      "scope": "connections",
      "status": "active",
      "lastSync": "2026-01-11T10:00:00Z",
      "addedAt": "2026-01-01T00:00:00Z"
    },
    {
      "id": "sub-002",
      "type": "oauth",
      "provider": "twitter",
      "scope": "following",
      "status": "active",
      "lastSync": "2026-01-11T10:05:00Z",
      "addedAt": "2026-01-02T00:00:00Z"
    },
    {
      "id": "sub-003",
      "type": "public",
      "provider": "rss",
      "url": "https://example.com/feed.xml",
      "status": "active",
      "lastSync": "2026-01-11T09:30:00Z",
      "addedAt": "2026-01-05T00:00:00Z"
    }
  ],
  "publicFeeds": [
    {
      "id": "pub-001",
      "slug": "curated-tech",
      "name": "Curated Tech",
      "enabled": true
    }
  ],
  "updatedAt": "2026-01-11T10:05:00Z"
}
```

### 1.3 Public Feeds Layer

Pre-curated public feeds that don't require authentication.

```
s3://quietfeed-{env}-public/
├── feeds/
│   ├── curated/
│   │   └── feed.json                # Main curated public feed
│   ├── tech/
│   │   └── feed.json                # Tech-focused public feed
│   └── uk-news/
│       └── feed.json                # UK news public feed
└── catalog.json                     # Available public feeds
```

**Public Feed Catalog** (`catalog.json`):
```json
{
  "feeds": [
    {
      "slug": "curated",
      "name": "The Quiet Feed",
      "description": "Our flagship curated feed",
      "tier": "anonymous",
      "itemCount": 100,
      "updatedAt": "2026-01-11T11:00:00Z"
    },
    {
      "slug": "tech",
      "name": "Tech Signal",
      "description": "Technology and software engineering",
      "tier": "anonymous",
      "itemCount": 50,
      "updatedAt": "2026-01-11T11:00:00Z"
    }
  ],
  "generatedAt": "2026-01-11T11:00:00Z"
}
```

### 1.4 DynamoDB Tables (Source of Truth for User State)

DynamoDB remains the authoritative store for user state. Static files are projections that get regenerated on change.

**Table: `quietfeed-{env}-users`**
| Attribute | Type | Description |
|-----------|------|-------------|
| `hashedSub` | String (PK) | HMAC-SHA256 of user's Cognito sub |
| `sk` | String (SK) | Sort key: `PROFILE`, `MUTE#{id}`, `SUB#{id}`, `TOKEN#{provider}` |
| `data` | Map | Entity-specific data |
| `updatedAt` | String | ISO timestamp |
| `ttl` | Number | TTL for expiring records (tokens) |
| `version` | Number | Optimistic locking |

**Access Patterns:**
- `hashedSub = X, sk = PROFILE` → User settings
- `hashedSub = X, sk begins_with MUTE#` → All mutes
- `hashedSub = X, sk begins_with SUB#` → All subscriptions  
- `hashedSub = X, sk begins_with TOKEN#` → OAuth tokens (encrypted)

**Table: `quietfeed-{env}-bundles`** (existing)
| Attribute | Type | Description |
|-----------|------|-------------|
| `hashedSub` | String (PK) | HMAC-SHA256 of user's Cognito sub |
| `bundleId` | String (SK) | Bundle identifier |
| `data` | Map | Bundle metadata |
| `ttl` | Number | For time-limited bundles |

**Table: `quietfeed-{env}-content-index`** (new)
| Attribute | Type | Description |
|-----------|------|-------------|
| `contentHash` | String (PK) | SHA-256 of content |
| `sk` | String (SK) | `SCORE`, `CLUSTER#{id}`, `SOURCE#{provider}#{id}` |
| `data` | Map | Score data, cluster membership, source reference |
| `scoredAt` | String | When scored |
| `ttl` | Number | Score expiry (7 days default) |

**Table: `quietfeed-{env}-processing-queue`** (new)
| Attribute | Type | Description |
|-----------|------|-------------|
| `pk` | String (PK) | `CONTENT#{hash}` or `USER#{hashedSub}` |
| `sk` | String (SK) | `PENDING`, `PROCESSING#{timestamp}`, `COMPLETE` |
| `data` | Map | Processing job details |
| `ttl` | Number | Auto-cleanup |

---

## Part 2: Token Exchange and OAuth Flow

### 2.1 OAuth Token Storage

Tokens are sensitive and require special handling:

1. **Storage**: Encrypted at rest in DynamoDB with short TTL
2. **Access**: Never exposed to browser; used server-side only for background sync
3. **Refresh**: Background Lambda refreshes tokens before expiry
4. **Revocation**: User can revoke via UI; triggers immediate deletion

**Token Document** (DynamoDB):
```json
{
  "hashedSub": "hash:xyz789...",
  "sk": "TOKEN#linkedin",
  "data": {
    "provider": "linkedin",
    "accessToken": "AES256:encrypted...",
    "refreshToken": "AES256:encrypted...",
    "expiresAt": "2026-01-11T22:00:00Z",
    "scopes": ["r_liteprofile", "r_emailaddress", "w_member_social"],
    "linkedAt": "2026-01-01T00:00:00Z"
  },
  "ttl": 1736640000,
  "version": 5
}
```

### 2.2 OAuth Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER INITIATES OAUTH                                              │
│    Browser → /auth/link/{provider}                                  │
│    → Redirect to provider's OAuth consent screen                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. PROVIDER CALLBACK                                                 │
│    Provider → /auth/callback/{provider}?code=XXX                    │
│    → Lambda exchanges code for tokens                               │
│    → Tokens encrypted and stored in DynamoDB                        │
│    → Redirect to /account/connections?status=linked                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SUBSCRIPTION CREATED                                              │
│    → DynamoDB: SUB#{id} record created                              │
│    → SQS: Message to trigger initial sync                           │
│    → User static files regenerated                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. BACKGROUND SYNC (every 15 minutes)                                │
│    → Lambda reads tokens from DynamoDB                              │
│    → Fetches user's feed from provider                              │
│    → Extracts content hashes, queues for scoring                    │
│    → Updates user's feed.json in S3                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Token Refresh Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCHEDULED: Token Refresh Lambda (every 5 minutes)                    │
│                                                                      │
│ 1. Query DynamoDB: tokens expiring in next 10 minutes               │
│ 2. For each token:                                                   │
│    a. Call provider's refresh endpoint                              │
│    b. Encrypt new tokens                                            │
│    c. Update DynamoDB with optimistic locking                       │
│    d. If refresh fails 3x, mark subscription as "needs_reauth"      │
│ 3. Notify users with "needs_reauth" subscriptions                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Static File Generation Pipeline

### 3.1 Content Scoring Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: New content hash discovered                                 │
│          (from user feed sync or public feed crawl)                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CHECK: Does score exist?                                          │
│    → S3 HEAD s3://content/scores/{hash}.json                        │
│    → If exists and fresh (< 7 days), skip                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. FETCH: Get content (ephemeral)                                    │
│    → Use system token or first user's token                         │
│    → Content held in memory only, never persisted                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SCORE: Call Claude API (Haiku 3)                                  │
│    → ~500 input tokens, ~100 output tokens                          │
│    → Cost: ~$0.00025 per item                                       │
│    → Returns: score components, topic classification                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. EMBED: Generate semantic embedding                                │
│    → all-MiniLM-L6-v2 (self-hosted on Lambda)                       │
│    → 384-dimensional vector                                         │
│    → Used for deduplication clustering                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. CLUSTER: Assign to dedup cluster                                  │
│    → Compare embedding to existing cluster centroids                │
│    → If similarity > 0.85, add to existing cluster                  │
│    → Otherwise, create new cluster                                  │
│    → Update canonical if this score is higher                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. WRITE: Publish to S3                                              │
│    → s3://content/scores/{hash}.json                                │
│    → s3://content/clusters/{cluster-id}/manifest.json               │
│    → DynamoDB: content-index table                                  │
│    → CloudFront invalidation (if cluster manifest changed)          │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 User Feed Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: User state changed OR scheduled (every 15 min)              │
│          SQS message: { userId, reason: "settings_changed" }        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. LOAD: User configuration from DynamoDB                            │
│    → Settings, mutes, subscriptions                                 │
│    → Active OAuth tokens                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. FETCH: Content from each subscription                             │
│    For each OAuth subscription:                                      │
│    → Decrypt token                                                  │
│    → Call provider API                                              │
│    → Extract content hashes                                         │
│    → Queue unknown hashes for scoring                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SCORE LOOKUP: Get scores for all content                          │
│    → Batch read from S3/DynamoDB                                    │
│    → Wait for any pending scores (with timeout)                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. FILTER: Apply user preferences                                    │
│    → Apply mutes (keywords, accounts, topics)                       │
│    → Apply score threshold                                          │
│    → Apply dedup (show canonical only if preference set)            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. SORT: Order by user preference                                    │
│    → Score (default) or chronological                               │
│    → Take top N items                                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. WRITE: Publish user's static files                                │
│    → s3://users/{user-hash}/feed.json                               │
│    → s3://users/{user-hash}/settings.json                           │
│    → s3://users/{user-hash}/mutes.json                              │
│    → s3://users/{user-hash}/subscriptions.json                      │
│    → CloudFront invalidation for user's path                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Public Feed Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: Scheduled (every 15 minutes)                                │
│          GitHub Actions cron or EventBridge                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CRAWL: Public sources                                             │
│    → RSS feeds                                                      │
│    → Public APIs (no auth required)                                 │
│    → Extract content hashes                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. SCORE: Same pipeline as user content                              │
│    → Check if already scored                                        │
│    → Score new items                                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. CURATE: Apply editorial rules                                     │
│    → Topic diversity requirements                                   │
│    → Minimum score threshold (70 for public feeds)                  │
│    → Recency weighting                                              │
│    → Dedup to canonical only                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. WRITE: Publish public feeds                                       │
│    → s3://public/feeds/{slug}/feed.json                             │
│    → s3://public/catalog.json                                       │
│    → CloudFront invalidation                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: API Surface (Writes Only)

The API exists only for operations that modify state. All reads are static file fetches.

### 4.1 Authentication APIs

```
POST /api/v1/auth/token
  Body: { code, provider, redirectUri }
  → Exchange OAuth code for Cognito JWT
  → Existing implementation

POST /api/v1/auth/link/{provider}
  Headers: Authorization: Bearer {jwt}
  → Initiate OAuth flow for provider
  → Returns: { redirectUrl }

POST /api/v1/auth/callback/{provider}
  Query: code, state
  → Complete OAuth flow
  → Store encrypted tokens
  → Trigger subscription creation
  → Returns: redirect to /account/connections

DELETE /api/v1/auth/link/{provider}
  Headers: Authorization: Bearer {jwt}
  → Revoke OAuth tokens
  → Delete subscription
  → Trigger feed regeneration
```

### 4.2 User Settings APIs

```
PUT /api/v1/settings
  Headers: Authorization: Bearer {jwt}
  Body: { preferences, features }
  → Update DynamoDB
  → Trigger static file regeneration
  → Returns: 202 Accepted

POST /api/v1/mutes
  Headers: Authorization: Bearer {jwt}
  Body: { type, value, scope }
  → Add mute rule to DynamoDB
  → Trigger feed regeneration
  → Returns: 202 Accepted, { muteId }

DELETE /api/v1/mutes/{muteId}
  Headers: Authorization: Bearer {jwt}
  → Remove mute rule
  → Trigger feed regeneration
  → Returns: 202 Accepted
```

### 4.3 Subscription APIs

```
POST /api/v1/subscriptions
  Headers: Authorization: Bearer {jwt}
  Body: { type, provider, url? }
  → Create subscription record
  → For OAuth: initiate OAuth flow
  → For RSS: validate and store URL
  → Trigger initial sync
  → Returns: 202 Accepted, { subscriptionId }

DELETE /api/v1/subscriptions/{subscriptionId}
  Headers: Authorization: Bearer {jwt}
  → Remove subscription
  → Revoke tokens if OAuth
  → Trigger feed regeneration
  → Returns: 202 Accepted

POST /api/v1/subscriptions/{subscriptionId}/sync
  Headers: Authorization: Bearer {jwt}
  → Force immediate sync
  → Returns: 202 Accepted
```

### 4.4 Bundle APIs (Existing)

```
GET /api/v1/bundle
  → Returns user's bundles (for entitlement checks)
  Note: This is a read, but bundles are small and 
        needed for authorization decisions

POST /api/v1/bundle
  → Add bundle (async)

DELETE /api/v1/bundle/{bundleId}
  → Remove bundle (async)
```

---

## Part 5: Browser-Side Architecture

### 5.1 Static File URLs

```
https://cdn.thequietfeed.com/
├── web/                              # Static site assets
│   ├── index.html
│   ├── feed/
│   ├── account/
│   └── widgets/
├── public/                           # Anonymous public feeds
│   ├── feeds/{slug}/feed.json
│   └── catalog.json
├── users/{user-hash}/                # Authenticated user data
│   ├── feed.json
│   ├── settings.json
│   ├── mutes.json
│   └── subscriptions.json
├── content/                          # Shared content metadata
│   ├── scores/{hash}.json
│   └── clusters/{id}/manifest.json
└── api/v1/                           # API Gateway (writes only)
```

### 5.2 Feed Loading Flow (Browser)

```javascript
// web/public/feed/feed-loader.js
export class FeedLoader {
  constructor(config) {
    this.cdnBase = config.cdnBase || 'https://cdn.thequietfeed.com';
    this.userHash = config.userHash;
    this.tokens = new TokenManager();
  }

  /**
   * Load user's feed - entirely from static files + source APIs
   */
  async loadFeed() {
    // 1. Fetch pre-computed feed index (static JSON)
    const feedIndex = await this.fetchFeedIndex();
    
    // 2. For each item, fetch actual content from source
    const items = await Promise.all(
      feedIndex.items.map(item => this.hydrateItem(item))
    );
    
    return {
      items: items.filter(Boolean), // Remove failed fetches
      generatedAt: feedIndex.generatedAt,
      pagination: feedIndex.pagination
    };
  }

  async fetchFeedIndex() {
    const url = this.userHash 
      ? `${this.cdnBase}/users/${this.userHash}/feed.json`
      : `${this.cdnBase}/public/feeds/curated/feed.json`;
    
    const res = await fetch(url, {
      headers: this.userHash ? this.getAuthHeaders() : {}
    });
    
    if (!res.ok) throw new FeedError('Failed to load feed index', res.status);
    return res.json();
  }

  async hydrateItem(indexItem) {
    try {
      // Fetch score metadata (static, highly cached)
      const score = await this.fetchScore(indexItem.hash);
      
      // Fetch actual content from source (user's token, live)
      const content = await this.fetchFromSource(
        indexItem.source,
        indexItem.sourceId
      );
      
      return {
        ...content,
        score: score.score,
        scoreComponents: score.components,
        cluster: indexItem.cluster,
        isCanonical: indexItem.isCanonical
      };
    } catch (err) {
      console.warn(`Failed to hydrate item ${indexItem.hash}:`, err);
      return null; // Skip failed items gracefully
    }
  }

  async fetchScore(hash) {
    const url = `${this.cdnBase}/content/scores/${hash}.json`;
    const res = await fetch(url);
    if (!res.ok) return { score: 0, components: {} }; // Fallback for missing scores
    return res.json();
  }

  async fetchFromSource(source, sourceId) {
    const token = await this.tokens.getToken(source);
    
    const endpoints = {
      linkedin: `https://api.linkedin.com/v2/posts/${encodeURIComponent(sourceId)}`,
      twitter: `https://api.twitter.com/2/tweets/${sourceId}`,
      // Add more sources as supported
    };
    
    const url = endpoints[source];
    if (!url) throw new Error(`Unknown source: ${source}`);
    
    const res = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) throw new SourceError(source, res.status);
    return this.normalizeContent(source, await res.json());
  }

  normalizeContent(source, raw) {
    // Transform source-specific format to common schema
    const normalizers = {
      linkedin: this.normalizeLinkedIn,
      twitter: this.normalizeTwitter,
    };
    return normalizers[source]?.(raw) || raw;
  }

  normalizeLinkedIn(data) {
    return {
      id: data.id,
      source: 'linkedin',
      author: {
        name: data.author?.name,
        profileUrl: data.author?.profileUrl,
        avatar: data.author?.profilePicture
      },
      content: {
        text: data.commentary,
        media: data.content?.media || []
      },
      engagement: {
        likes: data.likesSummary?.totalLikes || 0,
        comments: data.commentsSummary?.totalComments || 0,
        shares: data.sharesSummary?.totalShares || 0
      },
      publishedAt: data.created?.time,
      sourceUrl: `https://linkedin.com/feed/update/${data.id}`
    };
  }

  normalizeTwitter(data) {
    return {
      id: data.data.id,
      source: 'twitter',
      author: {
        name: data.includes?.users?.[0]?.name,
        handle: data.includes?.users?.[0]?.username,
        avatar: data.includes?.users?.[0]?.profile_image_url
      },
      content: {
        text: data.data.text,
        media: data.includes?.media || []
      },
      engagement: {
        likes: data.data.public_metrics?.like_count || 0,
        comments: data.data.public_metrics?.reply_count || 0,
        shares: data.data.public_metrics?.retweet_count || 0
      },
      publishedAt: data.data.created_at,
      sourceUrl: `https://twitter.com/i/web/status/${data.data.id}`
    };
  }

  getAuthHeaders() {
    const idToken = localStorage.getItem('cognitoIdToken');
    return idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
  }
}
```

### 5.3 Token Management (Browser)

```javascript
// web/public/widgets/token-manager.js
export class TokenManager {
  constructor() {
    this.tokens = {};
    this.refreshPromises = {};
  }

  async getToken(provider) {
    // Check memory cache
    const cached = this.tokens[provider];
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    // Check localStorage
    const stored = this.loadFromStorage(provider);
    if (stored && stored.expiresAt > Date.now() + 60000) {
      this.tokens[provider] = stored;
      return stored.accessToken;
    }

    // Need to refresh - but only one refresh at a time
    if (!this.refreshPromises[provider]) {
      this.refreshPromises[provider] = this.refreshToken(provider)
        .finally(() => delete this.refreshPromises[provider]);
    }

    const refreshed = await this.refreshPromises[provider];
    return refreshed.accessToken;
  }

  async refreshToken(provider) {
    // Call our API to refresh (which handles the actual refresh with provider)
    const idToken = localStorage.getItem('cognitoIdToken');
    const res = await fetch(`/api/v1/auth/refresh/${provider}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    if (!res.ok) {
      // Token refresh failed - need re-auth
      this.clearToken(provider);
      throw new AuthError(provider, 'Token refresh failed');
    }

    const data = await res.json();
    const tokenData = {
      accessToken: data.accessToken,
      expiresAt: Date.now() + (data.expiresIn * 1000)
    };

    this.tokens[provider] = tokenData;
    this.saveToStorage(provider, tokenData);
    return tokenData;
  }

  loadFromStorage(provider) {
    try {
      const key = `quietfeed_token_${provider}`;
      const json = localStorage.getItem(key);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  }

  saveToStorage(provider, tokenData) {
    try {
      const key = `quietfeed_token_${provider}`;
      localStorage.setItem(key, JSON.stringify(tokenData));
    } catch {
      // Storage full or disabled - continue without persistence
    }
  }

  clearToken(provider) {
    delete this.tokens[provider];
    localStorage.removeItem(`quietfeed_token_${provider}`);
  }
}
```

### 5.4 Settings Sync (Browser → API → S3)

```javascript
// web/public/account/settings-manager.js
export class SettingsManager {
  constructor(config) {
    this.cdnBase = config.cdnBase;
    this.userHash = config.userHash;
    this.version = 0;
    this.pendingChanges = null;
    this.syncDebounce = null;
  }

  async loadSettings() {
    const url = `${this.cdnBase}/users/${this.userHash}/settings.json`;
    const res = await fetch(url, { headers: this.getAuthHeaders() });
    
    if (!res.ok) {
      // New user - return defaults
      return this.getDefaults();
    }
    
    const settings = await res.json();
    this.version = settings.version;
    return settings;
  }

  async updateSettings(changes) {
    // Merge changes with pending
    this.pendingChanges = { ...this.pendingChanges, ...changes };
    
    // Debounce API calls
    if (this.syncDebounce) clearTimeout(this.syncDebounce);
    this.syncDebounce = setTimeout(() => this.syncToServer(), 500);
    
    // Return optimistic update
    return this.pendingChanges;
  }

  async syncToServer() {
    if (!this.pendingChanges) return;
    
    const changes = this.pendingChanges;
    this.pendingChanges = null;
    
    const idToken = localStorage.getItem('cognitoIdToken');
    const res = await fetch('/api/v1/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'If-Match': String(this.version) // Optimistic locking
      },
      body: JSON.stringify(changes)
    });
    
    if (res.status === 409) {
      // Conflict - reload and retry
      await this.loadSettings();
      return this.updateSettings(changes);
    }
    
    if (!res.ok) {
      throw new Error('Failed to save settings');
    }
    
    // Settings will be regenerated to S3 async
    // Poll for updated version
    this.pollForUpdate(this.version + 1);
  }

  async pollForUpdate(expectedVersion, attempts = 0) {
    if (attempts > 10) return; // Give up after ~10 seconds
    
    await new Promise(r => setTimeout(r, 1000));
    
    const settings = await this.loadSettings();
    if (settings.version >= expectedVersion) {
      // Dispatch event for UI update
      window.dispatchEvent(new CustomEvent('settings-updated', { 
        detail: settings 
      }));
      return;
    }
    
    // Keep polling
    this.pollForUpdate(expectedVersion, attempts + 1);
  }

  getDefaults() {
    return {
      preferences: {
        scoreThreshold: 60,
        showDuplicates: false,
        wireMode: false,
        chronological: false,
        itemsPerPage: 50
      },
      features: {
        score: true,
        trace: true,
        dedup: true,
        mute: true,
        wireMode: true,
        shield: true,
        demote: true,
        cluster: true
      },
      version: 0
    };
  }

  getAuthHeaders() {
    const idToken = localStorage.getItem('cognitoIdToken');
    return idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
  }
}
```

---

## Part 6: CDK Infrastructure Changes

### 6.1 New S3 Buckets

```java
// infra/main/java/com/thequietfeed/stacks/StorageStack.java

public class StorageStack extends Stack {
    public IBucket contentBucket;
    public IBucket usersBucket;
    public IBucket publicBucket;

    public StorageStack(Construct scope, String id, StorageStackProps props) {
        super(scope, id);

        // Content bucket - scores, clusters (public read, write via Lambda)
        this.contentBucket = Bucket.Builder.create(this, "ContentBucket")
            .bucketName(props.sharedNames().contentBucketName)
            .blockPublicAccess(BlockPublicAccess.BLOCK_ACLS)
            .publicReadAccess(true) // CloudFront origin
            .encryption(BucketEncryption.S3_MANAGED)
            .lifecycleRules(List.of(
                LifecycleRule.builder()
                    .expiration(Duration.days(30)) // Scores refresh
                    .prefix("scores/")
                    .build()
            ))
            .cors(List.of(CorsRule.builder()
                .allowedMethods(List.of(HttpMethods.GET))
                .allowedOrigins(List.of("*"))
                .allowedHeaders(List.of("*"))
                .build()))
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();

        // Users bucket - per-user static files (private, CloudFront signed URLs)
        this.usersBucket = Bucket.Builder.create(this, "UsersBucket")
            .bucketName(props.sharedNames().usersBucketName)
            .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
            .encryption(BucketEncryption.S3_MANAGED)
            .lifecycleRules(List.of(
                LifecycleRule.builder()
                    .expiration(Duration.days(1))
                    .prefix("*/tokens/") // Encrypted tokens auto-expire
                    .build()
            ))
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();

        // Public bucket - curated feeds (public read)
        this.publicBucket = Bucket.Builder.create(this, "PublicBucket")
            .bucketName(props.sharedNames().publicBucketName)
            .blockPublicAccess(BlockPublicAccess.BLOCK_ACLS)
            .publicReadAccess(true)
            .encryption(BucketEncryption.S3_MANAGED)
            .cors(List.of(CorsRule.builder()
                .allowedMethods(List.of(HttpMethods.GET))
                .allowedOrigins(List.of("*"))
                .allowedHeaders(List.of("*"))
                .build()))
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();
    }
}
```

### 6.2 New DynamoDB Tables

```java
// Addition to DataStack.java

// Content index table
this.contentIndexTable = Table.Builder.create(this, "ContentIndexTable")
    .tableName(props.sharedNames().contentIndexTableName)
    .partitionKey(Attribute.builder()
        .name("contentHash")
        .type(AttributeType.STRING)
        .build())
    .sortKey(Attribute.builder()
        .name("sk")
        .type(AttributeType.STRING)
        .build())
    .billingMode(BillingMode.PAY_PER_REQUEST)
    .timeToLiveAttribute("ttl")
    .removalPolicy(RemovalPolicy.DESTROY)
    .build();

// Users table (enhanced single-table design)
this.usersTable = Table.Builder.create(this, "UsersTable")
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
    .pointInTimeRecoverySpecification(PointInTimeRecoverySpecification.builder()
        .pointInTimeRecoveryEnabled(true)
        .build())
    .removalPolicy(criticalTableRemovalPolicy)
    .build();

// GSI for token refresh queries
this.usersTable.addGlobalSecondaryIndex(GlobalSecondaryIndexProps.builder()
    .indexName("token-expiry-index")
    .partitionKey(Attribute.builder()
        .name("tokenProvider")
        .type(AttributeType.STRING)
        .build())
    .sortKey(Attribute.builder()
        .name("tokenExpiresAt")
        .type(AttributeType.STRING)
        .build())
    .projectionType(ProjectionType.KEYS_ONLY)
    .build());

// Processing queue table
this.processingQueueTable = Table.Builder.create(this, "ProcessingQueueTable")
    .tableName(props.sharedNames().processingQueueTableName)
    .partitionKey(Attribute.builder()
        .name("pk")
        .type(AttributeType.STRING)
        .build())
    .sortKey(Attribute.builder()
        .name("sk")
        .type(AttributeType.STRING)
        .build())
    .billingMode(BillingMode.PAY_PER_REQUEST)
    .timeToLiveAttribute("ttl")
    .removalPolicy(RemovalPolicy.DESTROY)
    .build();
```

### 6.3 CloudFront Multi-Origin Setup

```java
// infra/main/java/com/thequietfeed/stacks/EdgeStack.java

// Origin for static web assets
S3Origin webOrigin = S3Origin.Builder.create(webBucket)
    .originAccessIdentity(oai)
    .build();

// Origin for public content (scores, public feeds)
S3Origin publicContentOrigin = S3Origin.Builder.create(contentBucket)
    .originAccessIdentity(oai)
    .build();

// Origin for user-specific content (requires signed URLs)
S3Origin userContentOrigin = S3Origin.Builder.create(usersBucket)
    .originAccessIdentity(oai)
    .build();

// Origin for API (writes only)
HttpOrigin apiOrigin = HttpOrigin.Builder.create(apiGatewayDomain)
    .protocolPolicy(OriginProtocolPolicy.HTTPS_ONLY)
    .build();

Distribution.Builder.create(this, "Distribution")
    .defaultBehavior(BehaviorOptions.builder()
        .origin(webOrigin)
        .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
        .cachePolicy(CachePolicy.CACHING_OPTIMIZED)
        .build())
    .additionalBehaviors(Map.of(
        "/content/*", BehaviorOptions.builder()
            .origin(publicContentOrigin)
            .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
            .cachePolicy(CachePolicy.CACHING_OPTIMIZED)
            .responseHeadersPolicy(corsPolicy)
            .build(),
        "/public/*", BehaviorOptions.builder()
            .origin(publicContentOrigin)
            .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
            .cachePolicy(CachePolicy.CACHING_OPTIMIZED)
            .responseHeadersPolicy(corsPolicy)
            .build(),
        "/users/*", BehaviorOptions.builder()
            .origin(userContentOrigin)
            .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
            .cachePolicy(CachePolicy.CACHING_DISABLED) // User content not cached at edge
            .trustedKeyGroups(List.of(keyGroup)) // For signed URLs
            .build(),
        "/api/*", BehaviorOptions.builder()
            .origin(apiOrigin)
            .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
            .cachePolicy(CachePolicy.CACHING_DISABLED)
            .allowedMethods(AllowedMethods.ALLOW_ALL)
            .originRequestPolicy(OriginRequestPolicy.ALL_VIEWER)
            .build()
    ))
    .build();
```

---

## Part 7: Lambda Functions

### 7.1 New Lambda Functions Required

| Function | Trigger | Purpose |
|----------|---------|---------|
| `oauthLink` | API POST | Initiate OAuth flow |
| `oauthCallback` | API GET | Complete OAuth flow |
| `oauthRefresh` | API POST | Refresh user's token for browser |
| `tokenRefreshScheduled` | EventBridge (5m) | Background token refresh |
| `settingsPut` | API PUT | Update user settings |
| `mutePost` | API POST | Add mute rule |
| `muteDelete` | API DELETE | Remove mute rule |
| `subscriptionPost` | API POST | Add subscription |
| `subscriptionDelete` | API DELETE | Remove subscription |
| `subscriptionSync` | API POST | Force sync |
| `userFeedGenerate` | SQS | Generate user's static files |
| `publicFeedGenerate` | EventBridge (15m) | Generate public feeds |
| `contentScore` | SQS | Score content items |
| `contentCluster` | SQS | Update dedup clusters |

### 7.2 Example: User Feed Generation Lambda

```javascript
// app/functions/feed/userFeedGenerate.js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { createLogger } from '../../lib/logger.js';
import { getUserData } from '../../data/userRepository.js';
import { getScores } from '../../data/contentRepository.js';
import { decryptToken, fetchFromProvider } from '../../services/oauthService.js';
import { applyFilters, sortItems } from '../../services/feedService.js';

const logger = createLogger({ source: 'userFeedGenerate' });

export async function handler(event) {
  for (const record of event.Records) {
    const { userId, reason } = JSON.parse(record.body);
    logger.info({ message: 'Generating feed', userId, reason });
    
    try {
      await generateUserFeed(userId);
    } catch (err) {
      logger.error({ message: 'Feed generation failed', userId, error: err.message });
      throw err; // Let SQS retry
    }
  }
}

async function generateUserFeed(userId) {
  // 1. Load user configuration
  const userData = await getUserData(userId);
  const { settings, mutes, subscriptions } = userData;
  
  // 2. Fetch content from each subscription
  const allItems = [];
  for (const sub of subscriptions.filter(s => s.status === 'active')) {
    const items = await fetchSubscriptionContent(userId, sub);
    allItems.push(...items);
  }
  
  // 3. Get scores for all items
  const hashes = allItems.map(item => item.hash);
  const scores = await getScores(hashes);
  
  // 4. Merge scores with items
  const scoredItems = allItems.map(item => ({
    ...item,
    ...scores[item.hash]
  }));
  
  // 5. Apply filters (mutes, score threshold, dedup)
  const filteredItems = applyFilters(scoredItems, {
    mutes: mutes.rules,
    scoreThreshold: settings.preferences.scoreThreshold,
    showDuplicates: settings.preferences.showDuplicates
  });
  
  // 6. Sort
  const sortedItems = sortItems(filteredItems, {
    chronological: settings.preferences.chronological
  });
  
  // 7. Build feed index
  const feedIndex = {
    userId,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    items: sortedItems.slice(0, settings.preferences.itemsPerPage).map(item => ({
      hash: item.hash,
      source: item.source,
      sourceId: item.sourceId,
      score: item.score,
      cluster: item.cluster,
      isCanonical: item.isCanonical,
      publishedAt: item.publishedAt
    })),
    pagination: {
      hasMore: sortedItems.length > settings.preferences.itemsPerPage,
      nextCursor: sortedItems[settings.preferences.itemsPerPage]?.publishedAt
    }
  };
  
  // 8. Write all static files
  await Promise.all([
    writeS3Json(`users/${userId}/feed.json`, feedIndex),
    writeS3Json(`users/${userId}/settings.json`, { ...settings, version: settings.version + 1 }),
    writeS3Json(`users/${userId}/mutes.json`, mutes),
    writeS3Json(`users/${userId}/subscriptions.json`, { feeds: subscriptions })
  ]);
  
  // 9. Invalidate CloudFront cache
  await invalidateCache([`/users/${userId}/*`]);
  
  logger.info({ message: 'Feed generated', userId, itemCount: feedIndex.items.length });
}

async function fetchSubscriptionContent(userId, subscription) {
  if (subscription.type === 'oauth') {
    const token = await decryptToken(userId, subscription.provider);
    return fetchFromProvider(subscription.provider, token, subscription.scope);
  } else if (subscription.type === 'rss') {
    return fetchRss(subscription.url);
  }
  return [];
}

async function writeS3Json(key, data) {
  const s3 = new S3Client({});
  await s3.send(new PutObjectCommand({
    Bucket: process.env.USERS_BUCKET,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
    CacheControl: 'max-age=60' // Short cache for user content
  }));
}

async function invalidateCache(paths) {
  const cf = new CloudFrontClient({});
  await cf.send(new CreateInvalidationCommand({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: { Quantity: paths.length, Items: paths }
    }
  }));
}
```

---

## Part 8: GitHub Actions Workflows

### 8.1 Content Processing Workflow

```yaml
# .github/workflows/process-content.yml
name: Process Content

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:
    inputs:
      full_rebuild:
        description: 'Rebuild all content'
        type: boolean
        default: false

jobs:
  process-content:
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: eu-west-2
      
      - name: Process new content
        run: |
          node scripts/process-content.js \
            --env prod \
            --full-rebuild ${{ inputs.full_rebuild || 'false' }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          CONTENT_BUCKET: ${{ vars.CONTENT_BUCKET }}
          CONTENT_INDEX_TABLE: ${{ vars.CONTENT_INDEX_TABLE }}
      
      - name: Generate public feeds
        run: |
          node scripts/generate-public-feeds.js --env prod
        env:
          CONTENT_BUCKET: ${{ vars.CONTENT_BUCKET }}
          PUBLIC_BUCKET: ${{ vars.PUBLIC_BUCKET }}
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/content/scores/*" "/public/feeds/*"
```

### 8.2 User Feed Generation (Event-Driven)

User feeds are generated via SQS + Lambda, but we can also trigger batch regeneration:

```yaml
# .github/workflows/regenerate-user-feeds.yml
name: Regenerate User Feeds

on:
  workflow_dispatch:
    inputs:
      user_hash:
        description: 'Specific user hash (leave empty for all)'
        type: string
        required: false

jobs:
  regenerate:
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: eu-west-2
      
      - name: Queue feed regeneration
        run: |
          if [ -n "${{ inputs.user_hash }}" ]; then
            # Single user
            node scripts/queue-feed-generation.js \
              --user-hash "${{ inputs.user_hash }}"
          else
            # All active users
            node scripts/queue-feed-generation.js --all-active
          fi
        env:
          FEED_GENERATION_QUEUE_URL: ${{ vars.FEED_GENERATION_QUEUE_URL }}
```

---

## Part 9: Migration Path

### Phase 1: Infrastructure (Week 1)
1. Deploy new S3 buckets (StorageStack)
2. Deploy new DynamoDB tables
3. Update CloudFront with multi-origin
4. Deploy placeholder static files

### Phase 2: Content Pipeline (Week 2)
1. Implement content scoring Lambda
2. Implement clustering Lambda
3. Set up GitHub Actions workflow
4. Backfill initial scores for test data

### Phase 3: User State (Week 3)
1. Implement settings/mutes/subscriptions APIs
2. Implement user feed generation Lambda
3. Migrate existing bundle data to new schema
4. Implement static file publishing

### Phase 4: OAuth Integration (Week 4)
1. Implement OAuth link/callback/refresh APIs
2. Implement token encryption
3. Implement background token refresh
4. Add LinkedIn OAuth (first provider)

### Phase 5: Browser Integration (Week 5)
1. Implement FeedLoader
2. Implement TokenManager
3. Implement SettingsManager
4. Update existing web components

### Phase 6: Public Feeds (Week 6)
1. Implement RSS feed crawler
2. Implement public feed generation
3. Create curated feed editorial rules
4. Deploy anonymous access

---

## Part 10: Cost Projections (Static-First)

Based on the economics document, with static-first optimizations:

| Scale | Monthly Cost | Notes |
|-------|-------------|-------|
| 100 users | ~$15 | Mostly S3 + minimal scoring |
| 1,000 users | ~$180 | Scoring dominates |
| 10,000 users | ~$600 | CDN costs start to matter |
| 100,000 users | ~$1,800 | 70%+ cache hit rate |
| 1,000,000 users | ~$8,000 | 85%+ cache hit rate |

**Key cost drivers:**
- LLM scoring: ~$0.00026/item (one-time)
- S3 storage: ~$0.023/GB/month
- CloudFront: ~$0.0085/10K requests
- DynamoDB: ~$1.25/1M writes, $0.25/1M reads
- Lambda: ~$0.20/1M invocations

**Static-first savings vs API-first:**
- No Lambda invocation for feed reads
- Maximum CDN cache hit rate
- Batch processing reduces invocation overhead
- No API Gateway costs for reads

---

## Appendix A: Security Considerations

### Token Security
- OAuth tokens encrypted with AES-256 before storage
- Encryption key stored in AWS Secrets Manager
- Tokens never exposed to browser (only access tokens, short-lived)
- Refresh tokens never leave server-side

### User Content Security
- User static files protected by CloudFront signed URLs
- Signed URLs generated by Lambda with 1-hour expiry
- User hash derived from Cognito sub (cannot be reversed)

### CORS Policy
- Content bucket: Allow GET from any origin
- Users bucket: Allow GET only from thequietfeed.com
- API: Allow methods based on route

### Rate Limiting
- API Gateway: 1000 requests/minute per user
- CloudFront: WAF rate limiting (2000 requests/5 minutes per IP)
- Source API calls: Respect provider rate limits

---

## Appendix B: Error Handling

### Feed Loading Failures
1. **Feed index missing**: Return empty feed with "setup required" message
2. **Score missing**: Use score=0, mark as "unscored"
3. **Source fetch fails**: Skip item, log for debugging
4. **Token expired**: Trigger refresh flow, retry once

### Background Processing Failures
1. **Scoring fails**: Retry 3x with exponential backoff
2. **S3 write fails**: Retry 3x, alert on persistent failure
3. **Token refresh fails**: Mark subscription as "needs_reauth"
4. **DynamoDB throttled**: Use exponential backoff

### User-Facing Errors
- Clear, actionable error messages
- Graceful degradation (show cached content if refresh fails)
- Link to status page for known issues
