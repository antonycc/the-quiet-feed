# The Quiet Feed - Work In Progress: Local-First Prototype

**Document:** AGENT_WIP_PROTOTYPE.md
**Version:** 1.0
**Date:** 2026-01-11
**Status:** Active Development
**Parent:** AGENT_PLAN_PROTOTYPE.md

---

## Current Focus

Building the Phase 1 prototype using a **local-first development approach**. All components should be testable from a local workstation before deployment to AWS.

---

## Guiding Principles

### Local-First Development

Every feature should work in this order:
1. **Local scripts** (Node.js, Bash) for development and testing
2. **Docker containers** for Lambda-compatible execution
3. **AWS deployment** only after local validation

### What We Favor

| Pattern | Example | Why |
|---------|---------|-----|
| Node.js scripts | `scripts/score-content.js` | Runs anywhere, easy to debug |
| Bash orchestration | `scripts/refresh-feeds.sh` | Simple, composable |
| Docker Lambdas | `Dockerfile` | Same runtime locally and in AWS |
| Dynalite | `npm run data` | Local DynamoDB compatible |
| Mock OAuth2 | `npm run auth` | Test auth flows without Cognito |
| LLM API from workstation | `ANTHROPIC_API_KEY` in shell | Real scoring during development |

### What We Avoid

| Anti-Pattern | Alternative | Why |
|--------------|-------------|-----|
| Step Functions | SQS + Lambda queues | Can't run locally |
| AWS Glue | Node.js ETL scripts | Complex setup, hard to debug |
| Complex GH Actions | Simple deploy workflow | Minimize CI-only code paths |
| Hardcoded AWS resources | Environment variables | Works across environments |

---

## Current Implementation State

### Completed

- [x] Anonymous feed display (`/index.html`)
- [x] Feed-based navigation (`?feed=about`, `?feed=settings`, `?feed=tech`, `?feed=news`)
- [x] Sample JSON feeds in `app/test-data/sample-feeds/` (served via express at `/sample-feeds`)
- [x] SCORE display on feed items (0-100 badge)
- [x] SHIELD principles (no autoplay, explicit "Load more" pagination)
- [x] Auth flow (Google OAuth via Cognito, mock OAuth2 locally)
- [x] Bundle CRUD (placeholder for feed configurations)
- [x] Anonymous behaviour test (`test:anonymousBehaviour-proxy`)
- [x] Test report generation with screenshots

### In Progress

- [x] LLM scoring from local workstation
- [x] Content hash computation
- [x] RSS feed ingestion
- [ ] Score caching system
- [ ] Local LLM (Ollama) integration for system tests

### Planned (Not Started)

- [ ] FeedStack CDK infrastructure
- [ ] scorePost Lambda
- [ ] feedGet Lambda (authenticated)
- [ ] feedGetAnon Lambda (curated public)
- [ ] LinkedIn OAuth integration

---

## Local Development Setup

### Prerequisites

```bash
# Required
node --version  # 20.x or later
docker --version  # For mock OAuth2 and DynamoDB

# For LLM scoring
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Starting Local Environment

```bash
# Start all services
npm start

# Or individually:
npm run data    # Local DynamoDB (dynalite)
npm run auth    # Mock OAuth2 server (Docker)
npm run proxy   # ngrok tunnel (for OAuth callbacks)
npm run server  # Express server on localhost:3000
```

### Running Tests

```bash
# Unit + system tests
npm test

# CDK synthesis
./mvnw clean verify

# Anonymous feed behaviour test
npm run test:anonymousBehaviour-proxy

# Generate test report
npm run test:anonymousBehaviour-proxy-report
```

---

## LLM Testing Strategy

### Three-Tier Approach

| Tier | Context | LLM Method | Purpose |
|------|---------|------------|---------|
| **Unit Tests** | `npm run test:unit` | Rule-based (mock) | Fast, deterministic, no external deps |
| **System Tests** | `npm run test:system` | Ollama (local) | Real LLM scoring, test data generation |
| **Behaviour Tests** | `npm run test:*Behaviour-*` | Ollama (local) | E2E flows with realistic scored content |
| **Production** | AWS Lambda | Anthropic Claude | Real-world scoring at scale |

### Unit Tests (Mocked)

Unit tests use the rule-based scorer (`scoreWithRules`) which requires no external dependencies:

```javascript
// In unit tests, use preferRules: true
const result = await scoreContent(item, { preferRules: true });
expect(result.modelId).toBe('rule-based-v1');
```

### System & Behaviour Tests (Local LLM)

For system tests and behaviour test data generation, use Ollama with the `useLocalLLM` option:

```javascript
// In system tests, use local LLM if available
const result = await scoreContent(item, { useLocalLLM: true });
// Falls back to rule-based if Ollama unavailable
```

**Setup Ollama:**

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama server
ollama serve &

# Pull a small, fast model
ollama pull phi3:mini

# Verify it's running
curl http://localhost:11434/api/tags
```

### Production (Cloud API)

Production uses Anthropic Claude via environment variable:

```bash
# Set in .env.prod or AWS Secrets Manager
ANTHROPIC_API_KEY=sk-ant-...
```

### Environment Variables

```bash
# .env.test - Unit tests (no LLM needed)
# (no LLM variables required, uses rule-based)

# .env.proxy - Local development with Ollama
LLM_PROVIDER=ollama
LLM_MODEL=phi3:mini
LLM_BASE_URL=http://localhost:11434/v1

# .env.prod - Production with Claude
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307
ANTHROPIC_API_KEY=sk-ant-...
```

### Scoring Service API

```javascript
import { scoreContent, scoreBatch } from './services/scoringService.js';

// Rule-based (unit tests)
await scoreContent(item, { preferRules: true });

// Local LLM via Ollama (system tests)
await scoreContent(item, { useLocalLLM: true });

// Cloud LLM via Anthropic (production)
await scoreContent(item); // Uses ANTHROPIC_API_KEY

// Custom LLM client
const { LLMClient } = await import('./lib/llmClient.js');
const llm = new LLMClient({ provider: 'ollama', model: 'mistral:7b' });
await scoreContent(item, { llmClient: llm });
```

### LLM Client (`app/lib/llmClient.js`)

Unified client supporting multiple providers:

```javascript
import { LLMClient, createLLMClient, isOllamaAvailable } from './lib/llmClient.js';

// Factory function - auto-selects based on NODE_ENV
const llm = createLLMClient();

// Check if Ollama is available
if (await isOllamaAvailable()) {
  const result = await llm.chat([
    { role: 'system', content: 'You are a content scorer...' },
    { role: 'user', content: 'Score this content...' }
  ], { maxTokens: 256 });
}
```

### CI/CD with Ollama

For GitHub Actions, Ollama runs as a service container:

```yaml
# In .github/workflows/test.yml
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

  - name: Run system tests with Ollama
    run: npm run test:system
    env:
      LLM_PROVIDER: ollama
      LLM_MODEL: phi3:mini
```

---

## Implementation Tasks

### Task 1: LLM Scoring from Local Workstation

**Goal:** Score content using Claude API from local machine, store results.

**Files to create:**
```
scripts/
├── score-content.js       # Score a single content item
├── score-batch.js         # Batch score multiple items
└── refresh-scores.js      # Refresh stale scores
```

**Usage:**
```bash
# Score a single item
node scripts/score-content.js --url "https://example.com/article"

# Batch score from a feed
node scripts/score-batch.js --feed ./app/test-data/sample-feeds/tech.json

# Refresh scores older than 7 days
node scripts/refresh-scores.js --max-age 7d
```

**Output:** JSON files in `app/test-data/sample-content/scores/`

```json
{
  "hash": "abc123...",
  "score": 85,
  "signals": {
    "factual": 22,
    "original": 20,
    "professional": 23,
    "signal": 20
  },
  "reasoning": "Original analysis with substantive claims...",
  "scoredAt": "2026-01-11T10:00:00Z",
  "modelId": "claude-haiku-3"
}
```

### Task 2: Content Hash Computation

**Goal:** Consistent content hashing for deduplication and caching.

**File:** `app/lib/contentHash.js`

```javascript
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

**Unit tests:** `app/unit-tests/lib/contentHash.test.js`

### Task 3: Score Caching System

**Goal:** Cache scores locally and in S3, with TTL.

**Local storage:** `app/test-data/sample-content/scores/{hash}.json`
**Production:** S3 bucket with CloudFront caching

**Script:** `scripts/check-score-cache.js`
```bash
# Check if score exists and is fresh
node scripts/check-score-cache.js --hash abc123

# Purge stale scores
node scripts/purge-stale-scores.js --older-than 7d
```

### Task 4: RSS Feed Ingestion

**Goal:** Fetch curated RSS feeds, extract items, prepare for scoring.

**Script:** `scripts/fetch-rss-feeds.js`

```bash
# Fetch all curated feeds
node scripts/fetch-rss-feeds.js

# Fetch specific feed
node scripts/fetch-rss-feeds.js --source hackernews

# Output to sample-content
node scripts/fetch-rss-feeds.js --output ./app/test-data/sample-content/
```

**Curated sources:**
```javascript
const CURATED_SOURCES = [
  { id: 'bbc-news', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'news' },
  { id: 'hackernews', url: 'https://hnrss.org/frontpage', category: 'tech' },
  { id: 'reuters', url: 'https://www.reutersagency.com/feed/', category: 'news' },
];
```

---

## System Tests for Data Processing

### Score Computation Tests

Location: `app/system-tests/scoring.system.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { computeContentHash } from '../lib/contentHash.js';
import { scoreContent } from '../services/scoringService.js';

describe('Content Scoring System', () => {
  it('computes consistent hash for same content', () => {
    const item1 = { url: 'https://example.com/a', title: 'Test' };
    const item2 = { url: 'https://example.com/a', title: 'TEST' };
    expect(computeContentHash(item1)).toBe(computeContentHash(item2));
  });

  it('scores content with Claude API', async () => {
    // Skip if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return;
    }

    const result = await scoreContent({
      title: 'New Study Shows Benefits of Regular Exercise',
      content: 'Researchers found that 30 minutes of daily exercise...',
      url: 'https://example.com/health-study'
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.signals).toHaveProperty('factual');
  });
});
```

### RSS Ingestion Tests

Location: `app/system-tests/rssIngestion.system.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { fetchRssFeed, parseRssItems } from '../services/rssFeedService.js';

describe('RSS Feed Ingestion', () => {
  it('fetches and parses Hacker News feed', async () => {
    const feed = await fetchRssFeed('https://hnrss.org/frontpage');
    const items = parseRssItems(feed);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('title');
    expect(items[0]).toHaveProperty('url');
    expect(items[0]).toHaveProperty('publishedAt');
  });
});
```

---

## Generated Test Content

Test content is generated by system tests and scripts, then checked into the repository. This content is used by:
- Behaviour tests (verify UI renders correctly)
- Static site (sample feeds for development)
- Test reports (screenshots and traces)

### Content Structure

```
app/test-data/
├── sample-feeds/         # Served via express at /sample-feeds
│   ├── default.json      # Main curated feed
│   ├── tech.json         # Tech-focused feed
│   ├── news.json         # News feed
│   ├── about.json        # About content as feed
│   └── settings.json     # Settings/tiers as feed
├── sample-content/       # Served via express at /sample-content
│   ├── scores/           # LLM scoring results
│   │   ├── abc123.json
│   │   └── def456.json
│   └── items/            # Detailed item data
│       └── item-001.json
└── test-feeds/           # Generated by scripts/process-feeds.js
    ├── all-feeds.json
    ├── default.json
    └── {source-id}.json

web/public/tests/
├── test-reports-index.txt
└── test-reports/         # Playwright reports
```

### Regeneration Policy

- **sample-feeds/**: Manually curated, updated infrequently
- **test-feeds/**: Regenerated by `npm run feeds:process-full` intermittently (committed to git)
- **sample-content/scores/**: Regenerated by `scripts/score-batch.js` when needed
- **tests/**: Regenerated on each behaviour test run with `--report` flag
- **NOT** regenerated on every `npm test` run

---

## Next Steps

1. **Implement scoring scripts** (Task 1)
   - Create `scripts/score-content.js`
   - Add system test for scoring
   - Generate sample scores

2. **Wire scoring to frontend**
   - Update feed display to load scores from `app/test-data/sample-content/scores/`
   - Display score breakdown on hover/click

3. **Add RSS ingestion** (Task 4)
   - Create `scripts/fetch-rss-feeds.js`
   - Populate sample feeds with real content
   - Score fetched items

4. **Create FeedStack CDK** (when local validation complete)
   - scorePost Lambda
   - feedGetAnon Lambda
   - API Gateway routes

---

## Environment Variables

### Required for LLM Scoring
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Optional for Local Development
```bash
export ENVIRONMENT_NAME="proxy"
export LOG_LEVEL="debug"
```

### AWS Deployment (set in .env.ci, .env.prod)
```bash
ANTHROPIC_API_KEY_ARN="arn:aws:secretsmanager:..."
SCORES_BUCKET_NAME="quietfeed-prod-scores"
```

---

## Success Criteria

Before moving a feature from local to AWS:

- [ ] Works with `npm start` (local stack)
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] System tests pass (`npm run test:system`)
- [ ] Behaviour tests pass (`npm run test:anonymousBehaviour-proxy`)
- [ ] No hardcoded AWS resources
- [ ] Environment variables documented
- [ ] Sample content generated and checked in

---

*Local-first: If it doesn't work on your laptop, it doesn't go to AWS.*
