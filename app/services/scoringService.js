// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Content Scoring Service for The Quiet Feed
 *
 * Provides quality scoring for feed items using:
 * - Rule-based heuristics (for testing, no external dependencies)
 * - LLM-based scoring (for production, uses Claude API)
 *
 * Scoring dimensions:
 * - factual: 0-25 - Factual substance vs opinion/reaction
 * - original: 0-25 - Original insight vs reshared content
 * - professional: 0-25 - Professional relevance vs personal update
 * - signal: 0-25 - Signal vs noise ratio
 *
 * Total score: 0-100
 */

import { createLogger } from "../lib/logger.js";

const logger = createLogger({ source: "scoringService" });

/**
 * Score content using rule-based heuristics.
 * This is used for testing and when LLM API is unavailable.
 *
 * @param {Object} item - Feed item to score
 * @param {string} [item.title] - Item title
 * @param {string} [item.content] - Item content/excerpt
 * @param {string} [item.url] - Item URL
 * @param {string} [item.source] - Source identifier
 * @returns {Object} Score result
 */
export const scoreWithRules = (item) => {
  const title = item.title || "";
  const content = item.content || item.excerpt || "";
  const fullText = `${title} ${content}`.toLowerCase();

  // Factual score: presence of data, numbers, citations
  const factualSignals = {
    hasNumbers: /\d+/.test(fullText),
    hasPercentages: /%/.test(fullText),
    hasYears: /\b20[0-9]{2}\b/.test(fullText),
    hasQuotes: /"[^"]+"|'[^']+'/.test(fullText),
    hasCitations: /according to|study|research|report|survey/i.test(fullText),
    hasData: /million|billion|thousand|\$|£|€/i.test(fullText),
  };
  const factualCount = Object.values(factualSignals).filter(Boolean).length;
  const factual = Math.min(25, Math.round((factualCount / 6) * 25));

  // Original score: not a reshare/retweet, has substance
  const originalSignals = {
    notRetweet: !/^rt\s|retweet|via @/i.test(fullText),
    hasLength: content.length > 100,
    notClickbait: !/you won't believe|shocking|amazing|must see/i.test(fullText),
    hasAnalysis: /because|therefore|however|analysis|explains/i.test(fullText),
    notJustLink: content.length > 50 || title.length > 30,
    hasContext: /context|background|previously|related/i.test(fullText),
  };
  const originalCount = Object.values(originalSignals).filter(Boolean).length;
  const original = Math.min(25, Math.round((originalCount / 6) * 25));

  // Professional score: industry/tech relevance vs personal
  const professionalSignals = {
    notPersonal: !/my day|feeling|mood|selfie|dinner/i.test(fullText),
    hasTechTerms: /api|software|engineering|system|platform|data/i.test(fullText),
    hasBusinessTerms: /market|industry|company|business|revenue/i.test(fullText),
    notEmoji: !/[\u{1F600}-\u{1F6FF}]/u.test(fullText),
    hasProperNouns: /[A-Z][a-z]+ (Inc|Ltd|Corp|LLC)/i.test(fullText),
    notCasual: !/lol|omg|wtf|gonna|wanna/i.test(fullText),
  };
  const professionalCount = Object.values(professionalSignals).filter(Boolean).length;
  const professional = Math.min(25, Math.round((professionalCount / 6) * 25));

  // Signal score: information density vs noise
  const signalSignals = {
    goodTitleLength: title.length >= 20 && title.length <= 120,
    hasSubstance: content.length >= 50,
    notAllCaps: title !== title.toUpperCase(),
    notSpammy: !/free|win|click|subscribe|follow/i.test(fullText),
    fromKnownSource: isKnownQualitySource(item.source || item.url || ""),
    notTooShort: fullText.length > 30,
  };
  const signalCount = Object.values(signalSignals).filter(Boolean).length;
  const signal = Math.min(25, Math.round((signalCount / 6) * 25));

  const score = factual + original + professional + signal;

  return {
    score,
    signals: {
      factual,
      original,
      professional,
      signal,
    },
    reasoning: generateReasoning(score, { factual, original, professional, signal }),
    scoredAt: new Date().toISOString(),
    modelId: "rule-based-v1",
  };
};

/**
 * Check if URL is from a known quality source.
 *
 * @param {string} urlOrSource - URL or source identifier
 * @returns {boolean}
 */
const isKnownQualitySource = (urlOrSource) => {
  const qualitySources = [
    "bbc.co.uk",
    "bbc.com",
    "reuters.com",
    "theguardian.com",
    "nytimes.com",
    "washingtonpost.com",
    "economist.com",
    "ft.com",
    "arstechnica.com",
    "theregister.com",
    "lobste.rs",
    "news.ycombinator.com",
    "hackernews",
    "arxiv.org",
    "nature.com",
    "science.org",
  ];

  const lower = urlOrSource.toLowerCase();
  return qualitySources.some((source) => lower.includes(source));
};

/**
 * Generate human-readable reasoning for score.
 *
 * @param {number} score - Total score
 * @param {Object} signals - Signal breakdown
 * @returns {string}
 */
const generateReasoning = (score, signals) => {
  const parts = [];

  if (signals.factual >= 15) {
    parts.push("contains factual data");
  } else if (signals.factual < 10) {
    parts.push("limited factual content");
  }

  if (signals.original >= 15) {
    parts.push("appears original");
  } else if (signals.original < 10) {
    parts.push("may be reshared content");
  }

  if (signals.professional >= 15) {
    parts.push("professionally relevant");
  } else if (signals.professional < 10) {
    parts.push("more personal/casual");
  }

  if (signals.signal >= 15) {
    parts.push("high information density");
  } else if (signals.signal < 10) {
    parts.push("lower signal-to-noise");
  }

  if (parts.length === 0) {
    return score >= 50 ? "Average quality content" : "Below average quality";
  }

  return parts.join("; ");
};

/**
 * Build the scoring prompt for LLM.
 *
 * @param {Object} item - Feed item to score
 * @returns {string} Formatted prompt
 */
const buildScoringPrompt = (item) => {
  const title = item.title || "";
  const content = item.content || item.excerpt || "";

  return `Rate this social media post for informational quality on a scale of 0-100.

Consider:
- Factual substance (not just opinion/reaction)
- Original insight vs reshared content
- Professional relevance vs personal update
- Signal vs noise ratio

Post Title: ${title}
Post Content: ${content.slice(0, 500)}
Source: ${item.source || item.url || "unknown"}

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
}`;
};

/**
 * Parse LLM response to extract score JSON.
 *
 * @param {string} text - LLM response text
 * @returns {Object|null} Parsed score or null
 */
const parseLLMScoreResponse = (text) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
};

/**
 * Score content using an LLM client (supports multiple providers).
 *
 * @param {Object} item - Feed item to score
 * @param {Object} [options] - Options
 * @param {Object} [options.llmClient] - LLM client instance
 * @returns {Promise<Object>} Score result
 */
export const scoreWithLLMClient = async (item, options = {}) => {
  const { createLLMClient } = await import("../lib/llmClient.js");
  const llm = options.llmClient || createLLMClient();

  const prompt = buildScoringPrompt(item);

  try {
    const response = await llm.chat(
      [
        {
          role: "system",
          content: "You are a content quality scorer. Respond with valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      { maxTokens: 256, temperature: 0.3 },
    );

    const result = parseLLMScoreResponse(response.content);
    if (!result) {
      logger.warn({ message: "Could not parse LLM response", text: response.content });
      return scoreWithRules(item);
    }

    return {
      ...result,
      scoredAt: new Date().toISOString(),
      modelId: response.model || llm.model,
      usage: response.usage,
    };
  } catch (error) {
    logger.error({ message: "LLM scoring failed", error: error.message });
    return scoreWithRules(item);
  }
};

/**
 * Score content using local LLM (Ollama).
 * Used for system tests and behaviour test data generation.
 *
 * @param {Object} item - Feed item to score
 * @param {Object} [options] - Options
 * @param {string} [options.model] - Ollama model (default: phi3:mini)
 * @returns {Promise<Object>} Score result
 */
export const scoreWithLocalLLM = async (item, options = {}) => {
  const { LLMClient, isOllamaAvailable } = await import("../lib/llmClient.js");

  const available = await isOllamaAvailable();
  if (!available) {
    logger.warn({ message: "Ollama not available, falling back to rule-based scoring" });
    return scoreWithRules(item);
  }

  const llm = new LLMClient({
    provider: "ollama",
    model: options.model || "phi3:mini",
    baseUrl: options.baseUrl || "http://localhost:11434/v1",
  });

  return scoreWithLLMClient(item, { llmClient: llm });
};

/**
 * Score content using Claude API (when available).
 *
 * @param {Object} item - Feed item to score
 * @param {Object} [options] - Options
 * @param {string} [options.apiKey] - Anthropic API key (defaults to env)
 * @param {string} [options.model] - Model to use (defaults to claude-3-haiku)
 * @returns {Promise<Object>} Score result
 */
export const scoreWithLLM = async (item, options = {}) => {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn({ message: "No ANTHROPIC_API_KEY, falling back to rule-based scoring" });
    return scoreWithRules(item);
  }

  const { LLMClient } = await import("../lib/llmClient.js");
  const llm = new LLMClient({
    provider: "anthropic",
    model: options.model || "claude-3-haiku-20240307",
    apiKey,
  });

  return scoreWithLLMClient(item, { llmClient: llm });
};

/**
 * Score content using the best available method.
 *
 * Priority:
 * 1. If preferRules is set, use rule-based scoring
 * 2. If provider is explicitly set, use that provider
 * 3. If useLocalLLM is set, use Ollama (for system tests)
 * 4. If ANTHROPIC_API_KEY is set, use Claude API
 * 5. Otherwise, fall back to rule-based scoring
 *
 * @param {Object} item - Feed item to score
 * @param {Object} [options] - Options
 * @param {boolean} [options.preferRules] - Force rule-based scoring
 * @param {string} [options.provider] - Explicit provider: 'ollama' or 'anthropic'
 * @param {boolean} [options.useLocalLLM] - Use Ollama for local LLM scoring
 * @param {Object} [options.llmClient] - Custom LLM client instance
 * @returns {Promise<Object>} Score result
 */
export const scoreContent = async (item, options = {}) => {
  // Priority 1: Explicit rule-based
  if (options.preferRules) {
    return scoreWithRules(item);
  }

  // Priority 2: Custom LLM client
  if (options.llmClient) {
    return scoreWithLLMClient(item, options);
  }

  // Priority 3: Explicit provider selection
  if (options.provider === "ollama") {
    return scoreWithLocalLLM(item, options);
  }

  if (options.provider === "anthropic") {
    return scoreWithLLM(item, options);
  }

  // Priority 4: Local LLM (Ollama) for system/behaviour tests
  if (options.useLocalLLM) {
    return scoreWithLocalLLM(item, options);
  }

  // Priority 5: Cloud LLM (Anthropic) for production
  if (process.env.ANTHROPIC_API_KEY) {
    return scoreWithLLM(item, options);
  }

  // Fallback: rule-based scoring
  return scoreWithRules(item);
};

/**
 * Batch score multiple items.
 *
 * @param {Array<Object>} items - Items to score
 * @param {Object} [options] - Options
 * @param {boolean} [options.preferRules] - Force rule-based scoring
 * @param {boolean} [options.useLocalLLM] - Use Ollama for local LLM scoring
 * @returns {Promise<Array<Object>>} Score results
 */
export const scoreBatch = async (items, options = {}) => {
  const results = [];
  const useRateLimit = !options.preferRules && (options.useLocalLLM || process.env.ANTHROPIC_API_KEY);

  for (const item of items) {
    const result = await scoreContent(item, options);
    results.push({
      item,
      ...result,
    });

    // Rate limiting for LLM APIs (local or cloud)
    if (useRateLimit) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
};

/**
 * Build the wire mode prompt for LLM.
 * Generates de-sensationalized titles and Reuters/telex-style summaries.
 *
 * @param {Object} item - Feed item to transform
 * @returns {string} Formatted prompt
 */
const buildWireModePrompt = (item) => {
  const title = item.title || "";
  const content = item.content || item.excerpt || "";

  return `Transform this specific headline into wire service style. CRITICAL: Preserve the original meaning and subject matter exactly.

Wire service style rules:
1. Keep the SAME TOPIC and SAME MEANING as the original
2. Remove only: sensationalism, clickbait phrases, emotional manipulation
3. If the headline is already neutral, make minimal or no changes
4. Never invent new information or change the subject

Examples of transformation patterns (DO NOT use these topics, only the pattern):
- "You won't BELIEVE what [X] did!" → "[X] takes action on [specific thing]"
- "BREAKING: Shocking development in [topic]" → "[topic]: [factual summary]"
- "This INSANE [thing] changes everything" → "[thing] released with [specific feature]"

---
CONTENT TO TRANSFORM:
Headline: ${title}
Content: ${content.slice(0, 800)}
Source: ${item.source || "unknown"}
---

IMPORTANT: Your response must be about "${title}" - the SAME subject as the input.

Respond with JSON only:
{
  "wireTitle": "<factual version of the SAME headline topic, max 100 chars>",
  "wireSummary": "<1-2 sentence summary of the SAME content, facts only>"
}`;
};

/**
 * Parse LLM response to extract wire mode JSON.
 *
 * @param {string} text - LLM response text
 * @returns {Object|null} Parsed wire mode content or null
 */
const parseWireModeResponse = (text) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // Validate required fields
    if (!parsed.wireTitle || !parsed.wireSummary) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Generate wire mode content using rule-based heuristics.
 * Used when LLM is unavailable.
 *
 * @param {Object} item - Feed item to transform
 * @returns {Object} Wire mode content
 */
export const generateWireWithRules = (item) => {
  let wireTitle = item.title || "";

  // Remove common clickbait patterns
  wireTitle = wireTitle.replace(/^(BREAKING|JUST IN|EXCLUSIVE|SHOCKING|MUST READ|HOT|ALERT)[\s:!-]*/gi, "");
  wireTitle = wireTitle.replace(/^(You won't believe|Here's why|This is why|Everyone is talking about)[\s:!]*/gi, "");
  wireTitle = wireTitle.replace(/[\u{1F600}-\u{1F6FF}]/gu, ""); // Remove emojis
  wireTitle = wireTitle.replace(/[!]{2,}/g, "!"); // Multiple exclamation marks
  wireTitle = wireTitle.replace(/\.{3,}/g, "..."); // Excessive ellipsis
  wireTitle = wireTitle.replace(/\?{2,}/g, "?"); // Multiple question marks

  // Remove sensational suffixes
  wireTitle = wireTitle.replace(/[—–-]\s*(and it's|and here's|and you won't).*/gi, "");
  wireTitle = wireTitle.replace(/\s+\[.*?\]$/g, ""); // Remove brackets at end

  // Clean up
  wireTitle = wireTitle.trim();
  if (wireTitle.length > 100) {
    wireTitle = wireTitle.slice(0, 97) + "...";
  }

  // Generate summary from excerpt/content
  const content = item.content || item.excerpt || "";
  let wireSummary = content.slice(0, 200);

  // Clean up summary
  wireSummary = wireSummary.replace(/[\u{1F600}-\u{1F6FF}]/gu, "");
  wireSummary = wireSummary.replace(/\s+/g, " ").trim();

  // Ensure it ends at a sentence boundary
  const lastSentence = wireSummary.match(/^.*[.!?]/);
  if (lastSentence) {
    wireSummary = lastSentence[0];
  }

  return {
    wireTitle: wireTitle || item.title,
    wireSummary: wireSummary || "No summary available.",
    modelId: "wire-rules-v1",
  };
};

/**
 * Generate wire mode content using an LLM client.
 *
 * @param {Object} item - Feed item to transform
 * @param {Object} [options] - Options
 * @param {Object} [options.llmClient] - LLM client instance
 * @returns {Promise<Object>} Wire mode content
 */
export const generateWireWithLLMClient = async (item, options = {}) => {
  const { createLLMClient } = await import("../lib/llmClient.js");
  const llm = options.llmClient || createLLMClient();

  const prompt = buildWireModePrompt(item);

  try {
    const response = await llm.chat(
      [
        {
          role: "system",
          content:
            "You are a Reuters/AP wire service editor. Your job is to remove sensationalism from headlines while PRESERVING THE EXACT SAME TOPIC AND MEANING. Never change what the article is about. If a headline is already neutral, return it with minimal changes. Respond with valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      { maxTokens: 256, temperature: 0.2 },
    );

    const result = parseWireModeResponse(response.content);
    if (!result) {
      logger.warn({ message: "Could not parse wire mode LLM response", text: response.content });
      return generateWireWithRules(item);
    }

    return {
      ...result,
      modelId: response.model || llm.model,
    };
  } catch (error) {
    logger.error({ message: "Wire mode LLM generation failed", error: error.message });
    return generateWireWithRules(item);
  }
};

/**
 * Generate wire mode content using local LLM (Ollama).
 *
 * @param {Object} item - Feed item to transform
 * @param {Object} [options] - Options
 * @returns {Promise<Object>} Wire mode content
 */
export const generateWireWithLocalLLM = async (item, options = {}) => {
  const { LLMClient, isOllamaAvailable } = await import("../lib/llmClient.js");

  const available = await isOllamaAvailable();
  if (!available) {
    logger.warn({ message: "Ollama not available, falling back to rule-based wire mode" });
    return generateWireWithRules(item);
  }

  const llm = new LLMClient({
    provider: "ollama",
    model: options.model || "phi3:mini",
    baseUrl: options.baseUrl || "http://localhost:11434/v1",
  });

  return generateWireWithLLMClient(item, { llmClient: llm });
};

/**
 * Generate wire mode content using the best available method.
 *
 * @param {Object} item - Feed item to transform
 * @param {Object} [options] - Options
 * @param {boolean} [options.preferRules] - Force rule-based transformation
 * @param {string} [options.provider] - Explicit provider: 'ollama' or 'anthropic'
 * @param {boolean} [options.useLocalLLM] - Use Ollama for local LLM
 * @returns {Promise<Object>} Wire mode content
 */
export const generateWireContent = async (item, options = {}) => {
  // Priority 1: Explicit rule-based
  if (options.preferRules) {
    return generateWireWithRules(item);
  }

  // Priority 2: Explicit provider selection
  if (options.provider === "ollama") {
    return generateWireWithLocalLLM(item, options);
  }

  if (options.provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.warn({ message: "No ANTHROPIC_API_KEY, falling back to rule-based wire mode" });
      return generateWireWithRules(item);
    }

    const { LLMClient } = await import("../lib/llmClient.js");
    const llm = new LLMClient({
      provider: "anthropic",
      model: options.model || "claude-3-haiku-20240307",
      apiKey,
    });

    return generateWireWithLLMClient(item, { llmClient: llm });
  }

  // Priority 3: Local LLM (Ollama)
  if (options.useLocalLLM) {
    return generateWireWithLocalLLM(item, options);
  }

  // Priority 4: Cloud LLM (Anthropic)
  if (process.env.ANTHROPIC_API_KEY) {
    const { LLMClient } = await import("../lib/llmClient.js");
    const llm = new LLMClient({
      provider: "anthropic",
      model: options.model || "claude-3-haiku-20240307",
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    return generateWireWithLLMClient(item, { llmClient: llm });
  }

  // Fallback: rule-based transformation
  return generateWireWithRules(item);
};

export default {
  scoreWithRules,
  scoreWithLLM,
  scoreWithLocalLLM,
  scoreWithLLMClient,
  scoreContent,
  scoreBatch,
  generateWireWithRules,
  generateWireContent,
};
