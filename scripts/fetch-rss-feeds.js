#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Fetch RSS/Atom feeds from the feeds catalog.
 *
 * Usage:
 *   node scripts/fetch-rss-feeds.js [options]
 *
 * Options:
 *   --source <id>     Fetch specific source only
 *   --category <cat>  Fetch sources in category
 *   --output <dir>    Output directory (default: ./web/public/sample-content/feeds)
 *   --dry-run         Show what would be fetched without fetching
 *   --help            Show this help
 */

import fs from "fs/promises";
import path from "path";
import TOML from "@iarna/toml";
import { fetchAndParseFeed } from "../app/services/rssFeedService.js";

const CATALOG_PATH = "./web/public/feeds.catalogue.toml";
const DEFAULT_OUTPUT_DIR = "./web/public/sample-content/feeds";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
Fetch RSS/Atom feeds from the feeds catalog.

Usage:
  node scripts/fetch-rss-feeds.js [options]

Options:
  --source <id>     Fetch specific source only
  --category <cat>  Fetch sources in category
  --output <dir>    Output directory (default: ${DEFAULT_OUTPUT_DIR})
  --dry-run         Show what would be fetched without fetching
  --help            Show this help
`);
    process.exit(0);
  }

  const sourceFilter = getArg(args, "--source");
  const categoryFilter = getArg(args, "--category");
  const outputDir = getArg(args, "--output") || DEFAULT_OUTPUT_DIR;
  const dryRun = args.includes("--dry-run");

  // Load catalog
  console.log("Loading feeds catalog...");
  const catalogContent = await fs.readFile(CATALOG_PATH, "utf-8");
  const catalog = TOML.parse(catalogContent);

  // Filter sources
  let sources = catalog.sources || [];

  if (sourceFilter) {
    sources = sources.filter((s) => s.id === sourceFilter);
    if (sources.length === 0) {
      console.error(`Source not found: ${sourceFilter}`);
      process.exit(1);
    }
  }

  if (categoryFilter) {
    sources = sources.filter((s) => s.category === categoryFilter);
    if (sources.length === 0) {
      console.error(`No sources in category: ${categoryFilter}`);
      process.exit(1);
    }
  }

  // Only fetch enabled sources
  sources = sources.filter((s) => s.enabled !== false);

  console.log(`Found ${sources.length} enabled sources to fetch`);

  if (dryRun) {
    console.log("\nDry run - would fetch:");
    sources.forEach((s) => {
      console.log(`  ${s.id} (${s.category}): ${s.url}`);
    });
    process.exit(0);
  }

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Fetch each source
  const results = {
    fetchedAt: new Date().toISOString(),
    sources: {},
  };

  for (const source of sources) {
    console.log(`\nFetching ${source.id}...`);
    try {
      const items = await fetchAndParseFeed(source.url);
      console.log(`  Got ${items.length} items`);

      // Save items to file
      const outputPath = path.join(outputDir, `${source.id}.json`);
      await fs.writeFile(
        outputPath,
        JSON.stringify(
          {
            source: source.id,
            url: source.url,
            category: source.category,
            fetchedAt: new Date().toISOString(),
            itemCount: items.length,
            items,
          },
          null,
          2,
        ),
      );
      console.log(`  Saved to ${outputPath}`);

      results.sources[source.id] = {
        success: true,
        itemCount: items.length,
        outputPath,
      };
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      results.sources[source.id] = {
        success: false,
        error: error.message,
      };
    }
  }

  // Save manifest
  const manifestPath = path.join(outputDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(results, null, 2));
  console.log(`\nManifest saved to ${manifestPath}`);

  // Summary
  const successful = Object.values(results.sources).filter((s) => s.success).length;
  const failed = Object.values(results.sources).filter((s) => !s.success).length;
  console.log(`\nSummary: ${successful} succeeded, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx < args.length - 1) {
    return args[idx + 1];
  }
  return null;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
