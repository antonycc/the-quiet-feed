# LLM Options for Content Scoring: Production & Testing

## Overview

For The Quiet Feed's content scoring pipeline, you need:
- **(a) Production**: Cloud API for scoring ~100K items/day at scale
- **(b) Testing**: Local/cheap option for development and CI

Both should expose an **OpenAI-compatible API** so your code can switch between them with minimal changes.

---

## Part 1: Production Options (Cloud APIs)

### Recommended: Claude Haiku 3 or Haiku 4.5

Based on your economics document (~$0.00026/item target), **Claude Haiku** is the sweet spot.

| Model | Input (per MTok) | Output (per MTok) | Speed | Use Case |
|-------|------------------|-------------------|-------|----------|
| **Claude Haiku 3** | $0.25 | $1.25 | Fastest | Budget scoring |
| **Claude Haiku 4.5** | $1.00 | $5.00 | Very Fast | Better quality |
| Claude Sonnet 4.5 | $3.00 | $15.00 | Fast | Complex analysis |
| Claude Opus 4.5 | $5.00 | $25.00 | Slower | Deep reasoning |

**Cost per scored item** (assuming ~500 input + ~100 output tokens):
- Haiku 3: `(500 × $0.25 + 100 × $1.25) / 1M = $0.00025` ✅ matches your target
- Haiku 4.5: `(500 × $1.00 + 100 × $5.00) / 1M = $0.001`
- Sonnet 4.5: `(500 × $3.00 + 100 × $15.00) / 1M = $0.003`

**Additional savings:**
- **Batch API**: 50% discount for non-urgent processing (24hr turnaround)
- **Prompt Caching**: 90% discount on cached prompts (cache reads = 0.1× base price)

### Alternative: OpenAI

| Model | Input (per MTok) | Output (per MTok) | Notes |
|-------|------------------|-------------------|-------|
| **GPT-4o mini** | $0.15 | $0.60 | Cheapest, good quality |
| GPT-4o | $2.50 | $10.00 | Balanced |
| GPT-4.1 | $5.00 | $15.00 | Frontier |

**Cost per scored item** (GPT-4o mini):
- `(500 × $0.15 + 100 × $0.60) / 1M = $0.000135` — even cheaper!

### Alternative: Google Gemini

| Model | Input (per MTok) | Output (per MTok) | Notes |
|-------|------------------|-------------------|-------|
| **Gemini Flash 2.0** | $0.075 | $0.30 | Extremely cheap |
| Gemini Pro | $1.25 | $5.00 | Balanced |

**Cost per scored item** (Gemini Flash):
- `(500 × $0.075 + 100 × $0.30) / 1M = $0.0000675` — cheapest option!

### Alternative: DeepSeek

| Model | Input (per MTok) | Output (per MTok) | Notes |
|-------|------------------|-------------------|-------|
| **DeepSeek V3** | $0.28 | $0.42 | Very cheap, China-based |
| DeepSeek (cache hit) | $0.028 | $0.42 | With caching |

**Cost per scored item**:
- `(500 × $0.28 + 100 × $0.42) / 1M = $0.000182`

### Production Recommendation

```
┌─────────────────────────────────────────────────────────────────────┐
│ PRIMARY: Claude Haiku 3 (or Haiku 4.5 for better quality)          │
│                                                                      │
│ Reasons:                                                            │
│ • Anthropic alignment with your project philosophy                  │
│ • Excellent at classification/scoring tasks                         │
│ • Batch API gives 50% discount for background processing           │
│ • Prompt caching for system prompts (90% savings)                  │
│ • $0.00025/item fits your economics model perfectly                │
│                                                                      │
│ FALLBACK: GPT-4o mini or Gemini Flash                              │
│ • If you need even lower costs                                     │
│ • OpenAI-compatible API (GPT-4o mini)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Local/Test Options

### Recommended: Ollama

**Ollama** is the most developer-friendly local LLM runner. It exposes an **OpenAI-compatible API** at `http://localhost:11434`, making it a drop-in replacement for cloud APIs in tests.

**Installation:**
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

**Pull a model:**
```bash
# Small, fast models for testing
ollama pull phi3:mini          # 3.8B, ~2GB, runs on CPU
ollama pull llama3.2:3b        # 3B, ~2GB, good quality
ollama pull mistral:7b-q4      # 7B quantized, ~4GB

# Better quality (needs more RAM/GPU)
ollama pull llama3.2:8b        # 8B, ~5GB
ollama pull mistral:7b         # 7B, ~4GB
```

**Run the server:**
```bash
ollama serve  # Starts on http://localhost:11434
```

**API Usage (OpenAI-compatible):**
```javascript
// Works identically to OpenAI/Claude with different base URL
const response = await fetch('http://localhost:11434/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'phi3:mini',
    messages: [
      { role: 'system', content: 'You are a content quality scorer...' },
      { role: 'user', content: 'Score this content: ...' }
    ],
    max_tokens: 100
  })
});
```

### Recommended Local Models

| Model | Size | RAM Needed | Speed | Quality | Best For |
|-------|------|------------|-------|---------|----------|
| **phi3:mini** | 3.8B | 4GB | ⚡⚡⚡ | ★★★ | CI/CD, fast tests |
| **llama3.2:3b** | 3B | 4GB | ⚡⚡⚡ | ★★★ | General testing |
| **mistral:7b-q4** | 7B (Q4) | 6GB | ⚡⚡ | ★★★★ | Better quality tests |
| **llama3.2:8b** | 8B | 8GB | ⚡⚡ | ★★★★ | Production-like tests |
| **qwen2.5:7b** | 7B | 6GB | ⚡⚡ | ★★★★ | Multilingual |

### Docker Setup for CI

```dockerfile
# Dockerfile.ollama-test
FROM ollama/ollama:latest

# Pre-pull the model during build
RUN ollama serve & sleep 5 && ollama pull phi3:mini

EXPOSE 11434
CMD ["serve"]
```

```yaml
# docker-compose.test.yml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  ollama-models:
```

### Alternative: Mock LLM Service

For unit tests where you don't need actual LLM responses, create a mock server:

```javascript
// app/test-utils/mock-llm-server.js
import { createServer } from 'http';

const MOCK_SCORE_RESPONSE = {
  choices: [{
    message: {
      content: JSON.stringify({
        score: 75,
        components: {
          originality: 80,
          aiConfidence: 0.2,
          engagementAuthenticity: 70,
          informationDensity: 75,
          sourceReputation: 75
        },
        topics: ['technology', 'software']
      })
    }
  }]
};

export function createMockLLMServer(port = 11434) {
  return createServer((req, res) => {
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(MOCK_SCORE_RESPONSE));
    } else if (req.url === '/api/tags') {
      // Health check endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'mock:latest' }] }));
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(port);
}
```

---

## Part 3: Unified Client Architecture

Create a client that works with both production and test backends:

```javascript
// app/lib/llm-client.js
import Anthropic from '@anthropic-ai/sdk';

export class LLMClient {
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || 'anthropic';
    this.model = config.model || process.env.LLM_MODEL || 'claude-3-haiku-20240307';
    this.baseUrl = config.baseUrl || process.env.LLM_BASE_URL;
    
    if (this.provider === 'anthropic') {
      this.client = new Anthropic({
        apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
      });
    } else if (this.provider === 'openai' || this.provider === 'ollama') {
      // OpenAI-compatible (works with Ollama too)
      this.baseUrl = this.baseUrl || 
        (this.provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1');
      this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || 'ollama'; // Ollama doesn't need key
    }
  }

  async chat(messages, options = {}) {
    if (this.provider === 'anthropic') {
      return this.chatAnthropic(messages, options);
    } else {
      return this.chatOpenAI(messages, options);
    }
  }

  async chatAnthropic(messages, options = {}) {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens || 1024,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });
    
    return {
      content: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }

  async chatOpenAI(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options.maxTokens || 1024
      })
    });
    
    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  }
}

// Factory function
export function createLLMClient(env = process.env.NODE_ENV) {
  if (env === 'test') {
    return new LLMClient({
      provider: 'ollama',
      model: 'phi3:mini',
      baseUrl: 'http://localhost:11434/v1'
    });
  } else if (env === 'production') {
    return new LLMClient({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307'
    });
  } else {
    // Development - use Ollama by default, override with env vars
    return new LLMClient({
      provider: process.env.LLM_PROVIDER || 'ollama',
      model: process.env.LLM_MODEL || 'mistral:7b',
      baseUrl: process.env.LLM_BASE_URL
    });
  }
}
```

### Environment Configuration

```bash
# .env.test
LLM_PROVIDER=ollama
LLM_MODEL=phi3:mini
LLM_BASE_URL=http://localhost:11434/v1

# .env.prod
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307
ANTHROPIC_API_KEY=sk-ant-...

# .env.proxy (local dev with real API)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Part 4: Scoring Service Implementation

```javascript
// app/services/contentScorer.js
import { createLLMClient } from '../lib/llm-client.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ source: 'contentScorer' });

const SCORING_SYSTEM_PROMPT = `You are a content quality scorer for a social media feed aggregator.

Analyze the provided content and return a JSON object with:
- score: Overall quality score 0-100
- components:
  - originality: 0-100 (is this original insight or rehashed?)
  - aiConfidence: 0-1 (probability content is AI-generated)
  - engagementAuthenticity: 0-100 (real engagement vs. bot/paid?)
  - informationDensity: 0-100 (signal vs. fluff ratio)
  - sourceReputation: 0-100 (credibility of source)
- topics: Array of topic slugs (e.g., ["uk-politics", "technology"])
- summary: One sentence summary of the content

Return ONLY valid JSON, no markdown or explanation.`;

export class ContentScorer {
  constructor(config = {}) {
    this.llm = config.llmClient || createLLMClient();
    this.cache = config.cache; // Optional cache layer
  }

  async score(content) {
    const contentHash = this.hashContent(content);
    
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get(contentHash);
      if (cached) {
        logger.info({ message: 'Score cache hit', contentHash });
        return cached;
      }
    }

    logger.info({ message: 'Scoring content', contentHash, contentLength: content.text?.length });
    
    const startTime = Date.now();
    
    try {
      const response = await this.llm.chat([
        { role: 'system', content: SCORING_SYSTEM_PROMPT },
        { role: 'user', content: this.formatContent(content) }
      ], { maxTokens: 500 });
      
      const score = JSON.parse(response.content);
      
      const result = {
        hash: contentHash,
        ...score,
        scoredAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        usage: response.usage
      };
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(contentHash, result, { ttl: 7 * 24 * 60 * 60 }); // 7 days
      }
      
      logger.info({ 
        message: 'Content scored', 
        contentHash, 
        score: score.score,
        latencyMs: result.latencyMs 
      });
      
      return result;
    } catch (err) {
      logger.error({ message: 'Scoring failed', contentHash, error: err.message });
      
      // Return a fallback score on error
      return {
        hash: contentHash,
        score: 50,
        components: {
          originality: 50,
          aiConfidence: 0.5,
          engagementAuthenticity: 50,
          informationDensity: 50,
          sourceReputation: 50
        },
        topics: [],
        summary: 'Unable to analyze content',
        error: err.message,
        scoredAt: new Date().toISOString()
      };
    }
  }

  formatContent(content) {
    return `Source: ${content.source}
Author: ${content.author?.name || 'Unknown'}
Published: ${content.publishedAt || 'Unknown'}

Content:
${content.text || content.content || ''}

Engagement:
- Likes: ${content.engagement?.likes || 0}
- Comments: ${content.engagement?.comments || 0}
- Shares: ${content.engagement?.shares || 0}`;
  }

  hashContent(content) {
    const crypto = require('crypto');
    const text = content.text || content.content || '';
    return `sha256:${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
  }
}
```

---

## Part 5: GitHub Actions CI Setup

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      ollama:
        image: ollama/ollama:latest
        ports:
          - 11434:11434
        options: >-
          --health-cmd "curl -f http://localhost:11434/api/tags || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Wait for Ollama
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:11434/api/tags; do sleep 2; done'
      
      - name: Pull test model
        run: |
          curl -X POST http://localhost:11434/api/pull \
            -d '{"name": "phi3:mini"}'
      
      - name: Run unit tests
        run: npm run test:unit
        env:
          LLM_PROVIDER: ollama
          LLM_MODEL: phi3:mini
          LLM_BASE_URL: http://localhost:11434/v1
      
      - name: Run system tests
        run: npm run test:system
        env:
          LLM_PROVIDER: ollama
          LLM_MODEL: phi3:mini
          LLM_BASE_URL: http://localhost:11434/v1
```

---

## Summary: Recommended Setup

```
┌─────────────────────────────────────────────────────────────────────┐
│ PRODUCTION                                                          │
│ ──────────                                                         │
│ Provider: Anthropic Claude API                                     │
│ Model: claude-3-haiku-20240307 (or claude-haiku-4-5 for better)   │
│ Cost: ~$0.00025/item (with Haiku 3)                                │
│ Features: Batch API (50% off), Prompt Caching (90% off reads)     │
│                                                                     │
│ TESTING (Local)                                                    │
│ ──────────────                                                     │
│ Tool: Ollama                                                       │
│ Model: phi3:mini (fast) or mistral:7b (better quality)            │
│ API: OpenAI-compatible at http://localhost:11434/v1               │
│ Cost: $0 (runs on your hardware)                                  │
│                                                                     │
│ CI/CD                                                              │
│ ─────                                                              │
│ Tool: Ollama in Docker                                             │
│ Model: phi3:mini (smallest, fastest)                               │
│ Setup: GitHub Actions service container                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Quick Start Commands

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama server
ollama serve &

# Pull a small test model
ollama pull phi3:mini

# Test the API
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "phi3:mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```
