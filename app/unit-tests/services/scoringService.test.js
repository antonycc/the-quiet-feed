// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scoreWithRules, scoreContent, scoreBatch } from "../../services/scoringService.js";

describe("scoringService", () => {
  describe("scoreWithRules", () => {
    it("returns score between 0 and 100", () => {
      const result = scoreWithRules({
        title: "Test Article",
        content: "Some content here",
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("returns all signal components", () => {
      const result = scoreWithRules({
        title: "Test",
        content: "Content",
      });

      expect(result.signals).toHaveProperty("factual");
      expect(result.signals).toHaveProperty("original");
      expect(result.signals).toHaveProperty("professional");
      expect(result.signals).toHaveProperty("signal");
    });

    it("signals are each between 0 and 25", () => {
      const result = scoreWithRules({
        title: "Test",
        content: "Content",
      });

      Object.values(result.signals).forEach((signal) => {
        expect(signal).toBeGreaterThanOrEqual(0);
        expect(signal).toBeLessThanOrEqual(25);
      });
    });

    it("includes scoredAt timestamp", () => {
      const result = scoreWithRules({
        title: "Test",
        content: "Content",
      });

      expect(result.scoredAt).toBeDefined();
      expect(new Date(result.scoredAt).getTime()).not.toBeNaN();
    });

    it("includes modelId", () => {
      const result = scoreWithRules({
        title: "Test",
        content: "Content",
      });

      expect(result.modelId).toBe("rule-based-v1");
    });

    it("includes reasoning", () => {
      const result = scoreWithRules({
        title: "Test",
        content: "Content",
      });

      expect(typeof result.reasoning).toBe("string");
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it("gives higher factual score for content with numbers and data", () => {
      const withData = scoreWithRules({
        title: "Revenue increased 25% in 2024",
        content: "According to the study, 45% of participants reported improvements. The $50 million investment...",
      });

      const withoutData = scoreWithRules({
        title: "Things are getting better",
        content: "I think this is going well for everyone involved",
      });

      expect(withData.signals.factual).toBeGreaterThan(withoutData.signals.factual);
    });

    it("gives higher original score for content without retweet markers", () => {
      const original = scoreWithRules({
        title: "Analysis: Why markets moved today",
        content: "The explanation is complex because of several factors. Therefore, we must consider...",
      });

      const retweet = scoreWithRules({
        title: "RT @someone: Cool link",
        content: "via @someoneelse",
      });

      expect(original.signals.original).toBeGreaterThan(retweet.signals.original);
    });

    it("gives higher professional score for tech/business content", () => {
      const professional = scoreWithRules({
        title: "New API Platform Released by Tech Corp Inc",
        content: "The software engineering team at the company announced a new data platform for the industry",
      });

      const personal = scoreWithRules({
        title: "My day was amazing lol",
        content: "Feeling great after dinner! 😊 gonna post more selfies",
      });

      expect(professional.signals.professional).toBeGreaterThan(personal.signals.professional);
    });

    it("gives lower signal score for spammy content", () => {
      const quality = scoreWithRules({
        title: "Research Findings on Machine Learning Applications",
        content: "A comprehensive study examined the effects of neural network architectures on classification tasks.",
      });

      const spammy = scoreWithRules({
        title: "FREE!! WIN A PRIZE!! CLICK NOW!!!",
        content: "Subscribe and follow for more! You won't believe this amazing offer!",
      });

      expect(quality.signals.signal).toBeGreaterThan(spammy.signals.signal);
    });

    it("handles empty content gracefully", () => {
      const result = scoreWithRules({
        title: "",
        content: "",
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("handles missing fields gracefully", () => {
      const result = scoreWithRules({});

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("recognizes content from known quality sources", () => {
      const fromBBC = scoreWithRules({
        title: "News Article",
        content: "Some content",
        source: "bbc.co.uk",
      });

      const fromUnknown = scoreWithRules({
        title: "News Article",
        content: "Some content",
        source: "random-unknown-site.xyz",
      });

      expect(fromBBC.signals.signal).toBeGreaterThanOrEqual(fromUnknown.signals.signal);
    });
  });

  describe("scoreContent", () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("uses rule-based scoring when no API key", async () => {
      const result = await scoreContent({
        title: "Test Article",
        content: "Some content",
      });

      expect(result.modelId).toBe("rule-based-v1");
    });

    it("uses rule-based scoring when preferRules option is true", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";

      const result = await scoreContent(
        {
          title: "Test Article",
          content: "Some content",
        },
        { preferRules: true },
      );

      expect(result.modelId).toBe("rule-based-v1");

      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe("scoreBatch", () => {
    it("scores multiple items", async () => {
      const items = [
        { title: "Article 1", content: "Content 1" },
        { title: "Article 2", content: "Content 2" },
        { title: "Article 3", content: "Content 3" },
      ];

      const results = await scoreBatch(items, { preferRules: true });

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.score).toBeDefined();
        expect(result.item).toBeDefined();
      });
    });

    it("preserves item reference in results", async () => {
      const items = [{ title: "Unique Article", content: "Unique Content", id: "test-123" }];

      const results = await scoreBatch(items, { preferRules: true });

      expect(results[0].item.id).toBe("test-123");
    });
  });
});
