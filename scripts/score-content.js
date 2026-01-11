#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Score content items using the scoring service.
 *
 * Usage:
 *   node scripts/score-content.js [options]
 *
 * Options:
 *   --input <file>    Score items from JSON file
 *   --feed <dir>      Score all feeds in directory
 *   --output <dir>    Output directory (default: ./web/public/sample-content/scores)
 *   --rules           Force rule-based scoring (no LLM)
 *   --dry-run         Show what would be scored without scoring
 *   --help            Show this help
 *
 * Environment:
 *   ANTHROPIC_API_KEY - Use Claude API for scoring (optional)
 */

import fs from "fs/promises";
import path from "path";
import { scoreWithRules, scoreWithLLM } from "../app/services/scoringService.js";
import { computeContentHash } from "../app/lib/contentHash.js";

const DEFAULT_OUTPUT_DIR = "./web/public/sample-content/scores";
const DEFAULT_FEED_DIR = "./web/public/sample-content/feeds";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
Score content items using the scoring service.

Usage:
  node scripts/score-content.js [options]

Options:
  --input <file>    Score items from JSON file
  --feed <dir>      Score all feeds in directory (default: ${DEFAULT_FEED_DIR})
  --output <dir>    Output directory (default: ${DEFAULT_OUTPUT_DIR})
  --rules           Force rule-based scoring (no LLM)
  --dry-run         Show what would be scored without scoring
  --help            Show this help

Environment:
  ANTHROPIC_API_KEY - Use Claude API for scoring (optional)

Examples:
  # Score all fetched feeds with rule-based scoring
  node scripts/score-content.js --rules

  # Score specific file with LLM
  ANTHROPIC_API_KEY=sk-ant-... node scripts/score-content.js --input ./feeds/hackernews.json
`);
    process.exit(0);
  }

  const inputFile = getArg(args, "--input");
  const feedDir = getArg(args, "--feed") || DEFAULT_FEED_DIR;
  const outputDir = getArg(args, "--output") || DEFAULT_OUTPUT_DIR;
  const useRules = args.includes("--rules") || !process.env.ANTHROPIC_API_KEY;
  const dryRun = args.includes("--dry-run");

  console.log(`Scoring mode: ${useRules ? "rule-based" : "LLM (Claude)"}`);

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Collect items to score
  let items = [];

  if (inputFile) {
    console.log(`Loading items from ${inputFile}...`);
    const content = await fs.readFile(inputFile, "utf-8");
    const data = JSON.parse(content);
    items = data.items || [data];
  } else {
    console.log(`Loading feeds from ${feedDir}...`);
    try {
      const files = await fs.readdir(feedDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json") && f !== "manifest.json");

      for (const file of jsonFiles) {
        const content = await fs.readFile(path.join(feedDir, file), "utf-8");
        const data = JSON.parse(content);
        if (data.items) {
          items.push(...data.items);
        }
      }
    } catch (error) {
      console.error(`Error loading feeds: ${error.message}`);
      console.log("Run scripts/fetch-rss-feeds.js first to fetch feeds");
      process.exit(1);
    }
  }

  console.log(`Found ${items.length} items to score`);

  if (dryRun) {
    console.log("\nDry run - would score:");
    items.slice(0, 10).forEach((item) => {
      console.log(`  ${item.title?.slice(0, 60)}...`);
    });
    if (items.length > 10) {
      console.log(`  ... and ${items.length - 10} more`);
    }
    process.exit(0);
  }

  // Score items
  const scores = {};
  let scored = 0;
  let skipped = 0;

  for (const item of items) {
    const hash = item.hash || computeContentHash(item);

    // Check if already scored
    const scorePath = path.join(outputDir, `${hash}.json`);
    try {
      await fs.access(scorePath);
      skipped++;
      continue;
    } catch {
      // File doesn't exist, score it
    }

    console.log(`Scoring: ${item.title?.slice(0, 50)}...`);

    try {
      const result = useRules ? scoreWithRules(item) : await scoreWithLLM(item);

      const scoreData = {
        hash,
        url: item.url,
        title: item.title,
        source: item.source,
        ...result,
      };

      // Save score
      await fs.writeFile(scorePath, JSON.stringify(scoreData, null, 2));
      scores[hash] = scoreData;
      scored++;

      console.log(`  Score: ${result.score} (${result.reasoning?.slice(0, 40)}...)`);

      // Rate limit for LLM API
      if (!useRules && process.env.ANTHROPIC_API_KEY) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (error) {
      console.error(`  Error scoring: ${error.message}`);
    }
  }

  // Save manifest
  const manifest = {
    scoredAt: new Date().toISOString(),
    mode: useRules ? "rule-based" : "llm",
    totalItems: items.length,
    scored,
    skipped,
    scores: Object.keys(scores),
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nSummary: ${scored} scored, ${skipped} skipped (already scored)`);
  console.log(`Scores saved to ${outputDir}`);
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
