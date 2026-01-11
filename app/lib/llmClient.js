// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Unified LLM Client for The Quiet Feed
 *
 * Supports multiple providers with OpenAI-compatible API:
 * - Production: Anthropic Claude API
 * - Testing: Ollama (local LLM)
 * - Unit tests: Mock/rule-based fallback
 *
 * Environment variables:
 * - LLM_PROVIDER: 'anthropic' | 'ollama' | 'openai' (default: based on NODE_ENV)
 * - LLM_MODEL: Model name (default: provider-specific)
 * - LLM_BASE_URL: Base URL for OpenAI-compatible APIs
 * - ANTHROPIC_API_KEY: API key for Anthropic
 * - OPENAI_API_KEY: API key for OpenAI
 */

import { createLogger } from "./logger.js";

const logger = createLogger({ source: "llmClient" });

/**
 * LLM Client class that supports multiple providers.
 */
export class LLMClient {
  /**
   * @param {Object} config - Configuration options
   * @param {string} [config.provider] - Provider: 'anthropic', 'ollama', 'openai'
   * @param {string} [config.model] - Model name
   * @param {string} [config.baseUrl] - Base URL for OpenAI-compatible APIs
   * @param {string} [config.apiKey] - API key
   */
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || this._defaultProvider();
    this.model = config.model || process.env.LLM_MODEL || this._defaultModel();
    this.baseUrl = config.baseUrl || process.env.LLM_BASE_URL || this._defaultBaseUrl();
    this.apiKey = config.apiKey || this._defaultApiKey();

    logger.info({
      message: "LLM client initialized",
      provider: this.provider,
      model: this.model,
      baseUrl: this.baseUrl ? this.baseUrl.replace(/\/v1$/, "") : "N/A",
    });
  }

  /**
   * Determine default provider based on environment.
   */
  _defaultProvider() {
    const env = process.env.NODE_ENV || "development";

    if (env === "test" || env === "system-test") {
      // For system tests, prefer Ollama if available
      return "ollama";
    } else if (env === "production") {
      return "anthropic";
    } else {
      // Development: use Ollama by default, override with env vars
      return process.env.ANTHROPIC_API_KEY ? "anthropic" : "ollama";
    }
  }

  /**
   * Determine default model based on provider.
   */
  _defaultModel() {
    switch (this.provider) {
      case "anthropic":
        return "claude-3-haiku-20240307";
      case "ollama":
        return "phi3:mini";
      case "openai":
        return "gpt-4o-mini";
      default:
        return "phi3:mini";
    }
  }

  /**
   * Determine default base URL based on provider.
   */
  _defaultBaseUrl() {
    switch (this.provider) {
      case "anthropic":
        return "https://api.anthropic.com";
      case "ollama":
        return "http://localhost:11434/v1";
      case "openai":
        return "https://api.openai.com/v1";
      default:
        return "http://localhost:11434/v1";
    }
  }

  /**
   * Determine default API key based on provider.
   */
  _defaultApiKey() {
    switch (this.provider) {
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY;
      case "openai":
        return process.env.OPENAI_API_KEY;
      case "ollama":
        return "ollama"; // Ollama doesn't require a key
      default:
        return null;
    }
  }

  /**
   * Check if the LLM service is available.
   *
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      if (this.provider === "ollama") {
        const response = await fetch(`${this.baseUrl.replace(/\/v1$/, "")}/api/tags`, {
          signal: AbortSignal.timeout(2000),
        });
        return response.ok;
      } else if (this.provider === "anthropic") {
        // Anthropic doesn't have a simple health check, assume available if key exists
        return !!this.apiKey;
      } else {
        // OpenAI-compatible: try models endpoint
        const response = await fetch(`${this.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: AbortSignal.timeout(2000),
        });
        return response.ok;
      }
    } catch {
      return false;
    }
  }

  /**
   * Send a chat completion request.
   *
   * @param {Array<Object>} messages - Chat messages
   * @param {Object} [options] - Options
   * @param {number} [options.maxTokens=1024] - Max tokens
   * @param {number} [options.temperature=0.7] - Temperature
   * @returns {Promise<Object>} Response with content and usage
   */
  async chat(messages, options = {}) {
    const maxTokens = options.maxTokens || 1024;
    const temperature = options.temperature ?? 0.7;

    if (this.provider === "anthropic") {
      return this._chatAnthropic(messages, { maxTokens, temperature });
    } else {
      return this._chatOpenAICompatible(messages, { maxTokens, temperature });
    }
  }

  /**
   * Chat with Anthropic API.
   */
  async _chatAnthropic(messages, options) {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const body = {
      model: this.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: userMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.content?.[0]?.text || "",
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
      model: data.model,
    };
  }

  /**
   * Chat with OpenAI-compatible API (Ollama, OpenAI, etc.).
   */
  async _chatOpenAICompatible(messages, options) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
      model: data.model,
    };
  }
}

/**
 * Factory function to create an LLM client based on environment.
 *
 * @param {string} [env] - Environment override
 * @returns {LLMClient}
 */
export function createLLMClient(env = process.env.NODE_ENV) {
  if (env === "test") {
    // Unit tests: Ollama if available, but tests should handle unavailability
    return new LLMClient({
      provider: "ollama",
      model: "phi3:mini",
      baseUrl: "http://localhost:11434/v1",
    });
  } else if (env === "system-test" || env === "behaviour-test") {
    // System/behaviour tests: Ollama for local data generation
    return new LLMClient({
      provider: process.env.LLM_PROVIDER || "ollama",
      model: process.env.LLM_MODEL || "phi3:mini",
      baseUrl: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
    });
  } else if (env === "production") {
    // Production: Anthropic Claude
    return new LLMClient({
      provider: "anthropic",
      model: process.env.LLM_MODEL || "claude-3-haiku-20240307",
    });
  } else {
    // Development: use what's configured or available
    return new LLMClient();
  }
}

/**
 * Check if Ollama is running and available.
 *
 * @returns {Promise<boolean>}
 */
export async function isOllamaAvailable() {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of models available in Ollama.
 *
 * @returns {Promise<Array<string>>}
 */
export async function getOllamaModels() {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

export default {
  LLMClient,
  createLLMClient,
  isOllamaAvailable,
  getOllamaModels,
};
