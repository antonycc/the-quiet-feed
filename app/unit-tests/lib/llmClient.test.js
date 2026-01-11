// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LLMClient, createLLMClient, isOllamaAvailable, getOllamaModels } from "../../lib/llmClient.js";

describe("llmClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment before each test
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(process.env, originalEnv);
  });

  describe("LLMClient constructor", () => {
    it("defaults to ollama provider when no API keys set", () => {
      const client = new LLMClient();
      expect(client.provider).toBe("ollama");
    });

    it("defaults to anthropic when ANTHROPIC_API_KEY is set", () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      const client = new LLMClient();
      expect(client.provider).toBe("anthropic");
    });

    it("respects explicit provider config", () => {
      const client = new LLMClient({ provider: "openai" });
      expect(client.provider).toBe("openai");
    });

    it("sets default model based on provider", () => {
      const ollamaClient = new LLMClient({ provider: "ollama" });
      expect(ollamaClient.model).toBe("phi3:mini");

      process.env.ANTHROPIC_API_KEY = "test-key";
      const anthropicClient = new LLMClient({ provider: "anthropic" });
      expect(anthropicClient.model).toBe("claude-3-haiku-20240307");
    });

    it("sets default base URL based on provider", () => {
      const ollamaClient = new LLMClient({ provider: "ollama" });
      expect(ollamaClient.baseUrl).toBe("http://localhost:11434/v1");

      const anthropicClient = new LLMClient({ provider: "anthropic" });
      expect(anthropicClient.baseUrl).toBe("https://api.anthropic.com");
    });

    it("respects environment variable overrides", () => {
      process.env.LLM_PROVIDER = "openai";
      process.env.LLM_MODEL = "gpt-4";
      process.env.LLM_BASE_URL = "https://custom.api.com/v1";

      const client = new LLMClient();
      expect(client.provider).toBe("openai");
      expect(client.model).toBe("gpt-4");
      expect(client.baseUrl).toBe("https://custom.api.com/v1");
    });
  });

  describe("createLLMClient factory", () => {
    it("creates ollama client for test environment", () => {
      const client = createLLMClient("test");
      expect(client.provider).toBe("ollama");
      expect(client.model).toBe("phi3:mini");
    });

    it("creates ollama client for system-test environment", () => {
      const client = createLLMClient("system-test");
      expect(client.provider).toBe("ollama");
    });

    it("creates anthropic client for production environment", () => {
      const client = createLLMClient("production");
      expect(client.provider).toBe("anthropic");
      expect(client.model).toBe("claude-3-haiku-20240307");
    });

    it("respects env vars in production", () => {
      process.env.LLM_MODEL = "claude-3-sonnet-20240229";
      const client = createLLMClient("production");
      expect(client.model).toBe("claude-3-sonnet-20240229");
    });
  });

  describe("isOllamaAvailable", () => {
    it("returns false when Ollama is not running", async () => {
      // Mock fetch to simulate Ollama not available
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const available = await isOllamaAvailable();
      expect(available).toBe(false);

      global.fetch = originalFetch;
    });

    it("returns true when Ollama is running", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const available = await isOllamaAvailable();
      expect(available).toBe(true);

      global.fetch = originalFetch;
    });
  });

  describe("getOllamaModels", () => {
    it("returns empty array when Ollama is not running", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const models = await getOllamaModels();
      expect(models).toEqual([]);

      global.fetch = originalFetch;
    });

    it("returns model names when Ollama is running", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: "phi3:mini" }, { name: "mistral:7b" }],
        }),
      });

      const models = await getOllamaModels();
      expect(models).toEqual(["phi3:mini", "mistral:7b"]);

      global.fetch = originalFetch;
    });
  });

  describe("LLMClient.isAvailable", () => {
    it("checks Ollama health endpoint for ollama provider", async () => {
      const client = new LLMClient({ provider: "ollama" });
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const available = await client.isAvailable();
      expect(available).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tags"),
        expect.any(Object),
      );

      global.fetch = originalFetch;
    });

    it("returns true for anthropic when API key exists", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      const client = new LLMClient({ provider: "anthropic" });

      const available = await client.isAvailable();
      expect(available).toBe(true);
    });

    it("returns false for anthropic when no API key", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const client = new LLMClient({ provider: "anthropic", apiKey: null });

      const available = await client.isAvailable();
      expect(available).toBe(false);
    });
  });
});
