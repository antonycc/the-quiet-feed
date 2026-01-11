// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

import { describe, it, expect } from "vitest";
import {
  computeContentHash,
  computeFullContentHash,
  normalizeUrl,
  normalizeTitle,
  normalizeContent,
  isDuplicate,
} from "../../lib/contentHash.js";

describe("contentHash", () => {
  describe("computeContentHash", () => {
    it("produces consistent hash for same item", () => {
      const item = { url: "https://example.com/article", title: "Test Article" };
      const hash1 = computeContentHash(item);
      const hash2 = computeContentHash(item);
      expect(hash1).toBe(hash2);
    });

    it("produces same hash regardless of title case", () => {
      const item1 = { url: "https://example.com/article", title: "Test Article" };
      const item2 = { url: "https://example.com/article", title: "TEST ARTICLE" };
      expect(computeContentHash(item1)).toBe(computeContentHash(item2));
    });

    it("produces same hash with tracking parameters removed", () => {
      const item1 = { url: "https://example.com/article", title: "Test" };
      const item2 = { url: "https://example.com/article?utm_source=twitter", title: "Test" };
      expect(computeContentHash(item1)).toBe(computeContentHash(item2));
    });

    it("produces different hash for different URLs", () => {
      const item1 = { url: "https://example.com/article1", title: "Test" };
      const item2 = { url: "https://example.com/article2", title: "Test" };
      expect(computeContentHash(item1)).not.toBe(computeContentHash(item2));
    });

    it("returns 16-character hex string", () => {
      const hash = computeContentHash({ url: "https://example.com", title: "Test" });
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("throws error for item without url", () => {
      expect(() => computeContentHash({ title: "No URL" })).toThrow("Item must have a url property");
    });

    it("throws error for null item", () => {
      expect(() => computeContentHash(null)).toThrow("Item must have a url property");
    });

    it("handles item without title", () => {
      const hash = computeContentHash({ url: "https://example.com" });
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe("computeFullContentHash", () => {
    it("includes content in hash", () => {
      const item1 = { url: "https://example.com", title: "Test", content: "Content A" };
      const item2 = { url: "https://example.com", title: "Test", content: "Content B" };
      expect(computeFullContentHash(item1)).not.toBe(computeFullContentHash(item2));
    });

    it("returns 32-character hex string", () => {
      const hash = computeFullContentHash({ url: "https://example.com", title: "Test", content: "Body" });
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe("normalizeUrl", () => {
    it("removes utm parameters", () => {
      const url = "https://example.com/page?utm_source=twitter&utm_medium=social";
      expect(normalizeUrl(url)).toBe("https://example.com/page");
    });

    it("removes fbclid and gclid", () => {
      const url = "https://example.com/page?fbclid=123&gclid=456";
      expect(normalizeUrl(url)).toBe("https://example.com/page");
    });

    it("normalizes http to https", () => {
      const url = "http://example.com/page";
      expect(normalizeUrl(url)).toBe("https://example.com/page");
    });

    it("removes www prefix", () => {
      const url = "https://www.example.com/page";
      expect(normalizeUrl(url)).toBe("https://example.com/page");
    });

    it("removes trailing slash", () => {
      const url = "https://example.com/page/";
      expect(normalizeUrl(url)).toBe("https://example.com/page");
    });

    it("lowercases the URL", () => {
      const url = "https://Example.COM/Page";
      expect(normalizeUrl(url)).toBe("https://example.com/Page".toLowerCase());
    });

    it("handles empty string", () => {
      expect(normalizeUrl("")).toBe("");
    });

    it("handles null", () => {
      expect(normalizeUrl(null)).toBe("");
    });

    it("handles malformed URLs gracefully", () => {
      const url = "not a valid url";
      expect(normalizeUrl(url)).toBe("not a valid url");
    });
  });

  describe("normalizeTitle", () => {
    it("lowercases title", () => {
      expect(normalizeTitle("Test Article")).toBe("test article");
    });

    it("trims whitespace", () => {
      expect(normalizeTitle("  Test  ")).toBe("test");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeTitle("Test   Article   Title")).toBe("test article title");
    });

    it("removes BREAKING prefix", () => {
      expect(normalizeTitle("BREAKING: News Item")).toBe("news item");
    });

    it("removes UPDATE prefix", () => {
      expect(normalizeTitle("Update: More information")).toBe("more information");
    });

    it("removes EXCLUSIVE prefix", () => {
      expect(normalizeTitle("Exclusive: Interview")).toBe("interview");
    });

    it("handles empty string", () => {
      expect(normalizeTitle("")).toBe("");
    });

    it("handles null", () => {
      expect(normalizeTitle(null)).toBe("");
    });
  });

  describe("normalizeContent", () => {
    it("lowercases content", () => {
      expect(normalizeContent("Test Content")).toBe("test content");
    });

    it("removes HTML tags", () => {
      expect(normalizeContent("<p>Test <b>content</b></p>")).toBe("test content");
    });

    it("collapses whitespace and newlines", () => {
      expect(normalizeContent("Test\n\ncontent\t\there")).toBe("test content here");
    });

    it("truncates to 500 characters", () => {
      const longContent = "a".repeat(1000);
      expect(normalizeContent(longContent).length).toBe(500);
    });

    it("handles empty string", () => {
      expect(normalizeContent("")).toBe("");
    });

    it("handles null", () => {
      expect(normalizeContent(null)).toBe("");
    });
  });

  describe("isDuplicate", () => {
    it("returns true for matching items", () => {
      const item1 = { url: "https://example.com", title: "Test" };
      const item2 = { url: "https://example.com", title: "TEST" };
      expect(isDuplicate(item1, item2)).toBe(true);
    });

    it("returns false for different items", () => {
      const item1 = { url: "https://example.com/1", title: "Test" };
      const item2 = { url: "https://example.com/2", title: "Test" };
      expect(isDuplicate(item1, item2)).toBe(false);
    });

    it("detects duplicates across reshares with tracking params", () => {
      const original = { url: "https://example.com/article", title: "News Story" };
      const reshare = { url: "https://example.com/article?utm_source=twitter", title: "News Story" };
      expect(isDuplicate(original, reshare)).toBe(true);
    });
  });
});
