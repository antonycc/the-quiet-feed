// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * System tests for the data processing pipeline.
 *
 * Tests the integration of:
 * - RSS/Atom feed parsing
 * - Content hash computation
 * - Rule-based content scoring
 * - Deduplication detection
 */

import { describe, it, expect } from "vitest";
import { parseRssItems, parseAtomItems, parseFeed } from "../services/rssFeedService.js";
import { computeContentHash, isDuplicate, normalizeUrl } from "../lib/contentHash.js";
import { scoreWithRules, scoreBatch } from "../services/scoringService.js";

// Sample RSS 2.0 feed
const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech News Daily</title>
    <link>https://technews.example.com</link>
    <description>Latest technology news</description>
    <item>
      <title>New API Platform Launches With Advanced Features</title>
      <link>https://technews.example.com/api-platform-2024</link>
      <description>A comprehensive study by the research team found that the new software platform increased revenue by 25%. According to the report, $50 million was invested in the development.</description>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
      <author>reporter@technews.example.com</author>
      <category>Technology</category>
    </item>
    <item>
      <title>Breaking: Market Update Shows Growth</title>
      <link>https://technews.example.com/market-update</link>
      <description>Markets showed strong growth today with major indices up 2%.</description>
      <pubDate>Mon, 01 Jan 2024 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[Special Characters: <Test> & "Quotes"]]></title>
      <link>https://technews.example.com/special-chars</link>
      <description><![CDATA[Content with <b>HTML</b> and &amp; entities]]></description>
      <pubDate>Mon, 01 Jan 2024 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

// Sample Atom feed
const sampleAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Science Research</title>
  <link href="https://science.example.com" rel="alternate"/>
  <updated>2024-01-01T12:00:00Z</updated>
  <entry>
    <title>Machine Learning Breakthrough in 2024</title>
    <link href="https://science.example.com/ml-breakthrough" rel="alternate"/>
    <id>urn:uuid:12345-67890</id>
    <updated>2024-01-01T12:00:00Z</updated>
    <summary>Researchers achieved 45% improvement in neural network efficiency. The study analyzed data from 1000 participants.</summary>
    <author>
      <name>Dr. Smith</name>
    </author>
    <category term="AI"/>
  </entry>
  <entry>
    <title>Climate Report Published</title>
    <link href="https://science.example.com/climate-2024" rel="alternate"/>
    <id>urn:uuid:12345-67891</id>
    <updated>2024-01-01T11:00:00Z</updated>
    <content>According to the IPCC, global temperatures have increased by 1.2 degrees Celsius.</content>
    <author>
      <name>Climate Team</name>
    </author>
  </entry>
</feed>`;

describe("System: Data Processing Pipeline", () => {
  describe("RSS feed parsing", () => {
    it("parses RSS 2.0 feed into items", () => {
      const items = parseRssItems(sampleRss);

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe("New API Platform Launches With Advanced Features");
      expect(items[0].url).toBe("https://technews.example.com/api-platform-2024");
      expect(items[0].source).toBe("Tech News Daily");
    });

    it("extracts author and category from RSS items", () => {
      const items = parseRssItems(sampleRss);

      expect(items[0].author).toBe("reporter@technews.example.com");
      expect(items[0].category).toBe("Technology");
    });

    it("handles CDATA sections in RSS", () => {
      const items = parseRssItems(sampleRss);
      const specialItem = items.find((i) => i.url.includes("special-chars"));

      expect(specialItem.title).toBe('Special Characters: <Test> & "Quotes"');
    });

    it("parses publication dates", () => {
      const items = parseRssItems(sampleRss);

      expect(items[0].publishedAt).toBeDefined();
      expect(new Date(items[0].publishedAt).getTime()).not.toBeNaN();
    });
  });

  describe("Atom feed parsing", () => {
    it("parses Atom feed into items", () => {
      const items = parseAtomItems(sampleAtom);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("Machine Learning Breakthrough in 2024");
      expect(items[0].url).toBe("https://science.example.com/ml-breakthrough");
    });

    it("extracts author from Atom entries", () => {
      const items = parseAtomItems(sampleAtom);

      expect(items[0].author).toBe("Dr. Smith");
      expect(items[1].author).toBe("Climate Team");
    });

    it("extracts category from Atom entries", () => {
      const items = parseAtomItems(sampleAtom);

      expect(items[0].category).toBe("AI");
    });

    it("uses content or summary for excerpt", () => {
      const items = parseAtomItems(sampleAtom);

      expect(items[0].excerpt).toContain("neural network efficiency");
      expect(items[1].excerpt).toContain("IPCC");
    });
  });

  describe("Auto-detect feed format", () => {
    it("detects and parses RSS feed", () => {
      const items = parseFeed(sampleRss);

      expect(items).toHaveLength(3);
      expect(items[0].source).toBe("Tech News Daily");
    });

    it("detects and parses Atom feed", () => {
      const items = parseFeed(sampleAtom);

      expect(items).toHaveLength(2);
      expect(items[0].source).toBe("Science Research");
    });
  });

  describe("Content hashing integration", () => {
    it("computes consistent hashes for parsed items", () => {
      const items = parseRssItems(sampleRss);
      const hash1 = computeContentHash(items[0]);
      const hash2 = computeContentHash(items[0]);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{16}$/);
    });

    it("detects duplicate content across different feeds", () => {
      const item1 = {
        url: "https://example.com/article",
        title: "Breaking News: Major Event",
      };
      const item2 = {
        url: "https://example.com/article?utm_source=twitter",
        title: "BREAKING NEWS: Major Event",
      };

      expect(isDuplicate(item1, item2)).toBe(true);
    });

    it("distinguishes different articles", () => {
      const items = parseRssItems(sampleRss);

      const hash1 = computeContentHash(items[0]);
      const hash2 = computeContentHash(items[1]);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Content scoring integration", () => {
    it("scores parsed RSS items", () => {
      const items = parseRssItems(sampleRss);
      const item = items[0];

      const result = scoreWithRules({
        title: item.title,
        content: item.excerpt,
        source: item.source,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.signals).toBeDefined();
    });

    it("gives higher scores to factual content", () => {
      const items = parseRssItems(sampleRss);

      // First item has numbers, percentages, citations
      const factualResult = scoreWithRules({
        title: items[0].title,
        content: items[0].excerpt,
      });

      // Second item is shorter, less data
      const lessFactualResult = scoreWithRules({
        title: items[1].title,
        content: items[1].excerpt,
      });

      expect(factualResult.signals.factual).toBeGreaterThanOrEqual(lessFactualResult.signals.factual);
    });

    it("batch scores all feed items", async () => {
      const rssItems = parseRssItems(sampleRss);
      const atomItems = parseAtomItems(sampleAtom);
      const allItems = [...rssItems, ...atomItems];

      const scoredItems = await scoreBatch(
        allItems.map((item) => ({
          title: item.title,
          content: item.excerpt,
          source: item.source,
          url: item.url,
        })),
        { preferRules: true },
      );

      expect(scoredItems).toHaveLength(5);
      scoredItems.forEach((result) => {
        expect(result.score).toBeDefined();
        expect(result.signals).toBeDefined();
        expect(result.modelId).toBe("rule-based-v1");
      });
    });
  });

  describe("End-to-end pipeline", () => {
    it("processes feed from parsing to scoring with hashes", async () => {
      // 1. Parse feed
      const items = parseFeed(sampleRss);
      expect(items.length).toBeGreaterThan(0);

      // 2. Compute hashes for deduplication
      const itemsWithHashes = items.map((item) => ({
        ...item,
        hash: computeContentHash(item),
      }));

      expect(itemsWithHashes[0].hash).toMatch(/^[a-f0-9]{16}$/);

      // 3. Score content
      const scoredItems = await scoreBatch(
        itemsWithHashes.map((item) => ({
          title: item.title,
          content: item.excerpt,
          source: item.source,
          url: item.url,
        })),
        { preferRules: true },
      );

      // 4. Combine results
      const processedItems = itemsWithHashes.map((item, index) => ({
        ...item,
        score: scoredItems[index].score,
        signals: scoredItems[index].signals,
        reasoning: scoredItems[index].reasoning,
      }));

      // Verify final output
      processedItems.forEach((item) => {
        expect(item.url).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.hash).toBeDefined();
        expect(item.score).toBeDefined();
        expect(item.signals).toBeDefined();
      });

      // Should be able to filter by score
      const highScoreItems = processedItems.filter((item) => item.score >= 50);
      expect(highScoreItems.length).toBeGreaterThanOrEqual(0);
    });

    it("handles empty feeds gracefully", () => {
      const emptyRss = `<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>`;
      const items = parseFeed(emptyRss);

      expect(items).toEqual([]);
    });

    it("handles malformed content gracefully", () => {
      const malformed = "not valid xml at all";
      const items = parseFeed(malformed);

      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe("URL normalization for deduplication", () => {
    it("normalizes URLs with different tracking parameters", () => {
      const urls = [
        "https://example.com/article?utm_source=twitter&utm_medium=social",
        "https://example.com/article?fbclid=123456",
        "https://example.com/article?ref=reddit",
        "https://example.com/article",
      ];

      const normalized = urls.map(normalizeUrl);
      const unique = new Set(normalized);

      expect(unique.size).toBe(1);
    });

    it("normalizes http to https", () => {
      expect(normalizeUrl("http://example.com/page")).toBe("https://example.com/page");
    });

    it("removes www prefix", () => {
      expect(normalizeUrl("https://www.example.com/page")).toBe("https://example.com/page");
    });
  });
});
