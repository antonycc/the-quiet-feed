// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Feed Setup Helper for Behaviour Tests
 *
 * Optionally processes fresh feeds before running behaviour tests.
 * Enable by setting TEST_REFRESH_FEEDS=true
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const projectRoot = process.cwd();

/**
 * Check if fresh feed processing is enabled
 */
export function shouldRefreshFeeds() {
  return process.env.TEST_REFRESH_FEEDS === "true";
}

/**
 * Process fresh feeds for behaviour tests
 *
 * @param {Object} options - Processing options
 * @param {number} options.feeds - Number of feeds to process (default: 3)
 * @param {number} options.depth - Items per feed (default: 5)
 * @param {boolean} options.verbose - Show detailed progress
 * @returns {Promise<Object>} Processing results
 */
export async function processFreshFeeds(options = {}) {
  const feeds = options.feeds || 3;
  const depth = options.depth || 5;
  const verbose = options.verbose || false;

  const log = verbose ? console.log.bind(console) : () => {};

  log("[Feed Setup] Loading feed catalogue...");

  try {
    const toml = await import("@iarna/toml");
    const cataloguePath = join(projectRoot, "web/public/feeds.catalogue.toml");
    const catalogueContent = readFileSync(cataloguePath, "utf-8");
    const catalogue = toml.parse(catalogueContent);

    // Prefer reliable feeds (non-RSSHub) for testing, then fall back to others
    const reliableSources = catalogue.sources.filter(
      (s) => s.enabled !== false && !s.url.includes("rsshub.app"),
    );
    const otherSources = catalogue.sources.filter(
      (s) => s.enabled !== false && s.url.includes("rsshub.app"),
    );
    const enabledSources = [...reliableSources, ...otherSources].slice(0, feeds);

    log(`[Feed Setup] Processing ${enabledSources.length} feeds...`);

    // Import services
    const { fetchAndParseFeed } = await import("../../app/services/rssFeedService.js");
    const { scoreContent } = await import("../../app/services/scoringService.js");
    const { computeContentHash } = await import("../../app/lib/contentHash.js");

    const allItems = [];
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const source of enabledSources) {
      try {
        log(`[Feed Setup] Fetching: ${source.name}`);
        const items = await fetchAndParseFeed(source.url, { timeout: 15000 });

        for (const item of items.slice(0, depth)) {
          // Filter by time
          if (item.publishedAt && new Date(item.publishedAt) < cutoff) {
            continue;
          }

          // Score the item
          const scoreResult = await scoreContent(item, { preferRules: true });

          allItems.push({
            id: computeContentHash(item),
            title: item.title,
            url: item.url,
            excerpt: item.excerpt,
            score: scoreResult.score,
            source: source.name,
            category: source.category,
            publishedAt: item.publishedAt,
          });
        }

        log(`[Feed Setup] Processed ${source.name}: ${items.length} items`);
      } catch (error) {
        log(`[Feed Setup] Error fetching ${source.name}: ${error.message}`);
      }
    }

    // Sort by score
    allItems.sort((a, b) => b.score - a.score);

    // Only write if we have items - don't overwrite existing content with empty file
    if (allItems.length === 0) {
      console.log("[Feed Setup] No items fetched, keeping existing sample-feeds intact");
      return {
        success: false,
        error: "No items fetched from any feed",
        itemCount: 0,
        feedCount: enabledSources.length,
      };
    }

    // Write to sample-feeds/default.json (now in test-data)
    const outputPath = join(projectRoot, "app/test-data/sample-feeds/default.json");
    const feedData = {
      name: "Curated Feed",
      description: "Fresh content from diverse sources",
      itemCount: allItems.length,
      generatedAt: new Date().toISOString(),
      items: allItems,
    };

    writeFileSync(outputPath, JSON.stringify(feedData, null, 2));
    log(`[Feed Setup] Wrote ${allItems.length} items to ${outputPath}`);

    return {
      success: true,
      itemCount: allItems.length,
      feedCount: enabledSources.length,
    };
  } catch (error) {
    console.error("[Feed Setup] Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Setup feeds for behaviour tests
 *
 * Call this in test.beforeAll() to optionally refresh feeds.
 */
export async function setupFeeds(options = {}) {
  if (!shouldRefreshFeeds()) {
    console.log("[Feed Setup] Using existing sample feeds (set TEST_REFRESH_FEEDS=true to refresh)");
    return { skipped: true };
  }

  console.log("[Feed Setup] Refreshing feeds for behaviour tests...");
  return processFreshFeeds(options);
}
