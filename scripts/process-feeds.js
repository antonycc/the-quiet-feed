#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Content Processing Script for The Quiet Feed
 *
 * Fetches RSS/Atom feeds from the catalogue, scores content using LLM,
 * and writes processed feeds to the test-feeds directory.
 *
 * Usage:
 *   node scripts/process-feeds.js [options]
 *
 * Options:
 *   --feeds <n>       Number of feeds to process (default: 5)
 *   --depth <n>       Max items per feed (default: 10)
 *   --hours <n>       Time window in hours (default: 24)
 *   --category <cat>  Filter by category (e.g., tech, news)
 *   --score           Enable LLM scoring (requires Ollama or ANTHROPIC_API_KEY)
 *   --provider <p>    LLM provider: 'ollama' or 'anthropic' (auto-detected if not set)
 *   --clear           Clear all processed content before starting
 *   --output <dir>    Output directory (default: app/test-data/test-feeds)
 *   --dry-run         Show what would be processed without writing
 *   --verbose         Show detailed progress
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import toml from "@iarna/toml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    feeds: 5,
    depth: 10,
    hours: 24,
    category: null,
    mixedCategories: false, // Include feeds from multiple categories (tech, news)
    score: false,
    wire: false, // Generate wire mode content (de-sensationalized titles/summaries)
    provider: null, // auto-detect
    clear: false,
    timeout: null, // Timeout in seconds for incremental mode
    output: "app/test-data/test-feeds",
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--feeds":
        options.feeds = parseInt(args[++i], 10);
        break;
      case "--depth":
        options.depth = parseInt(args[++i], 10);
        break;
      case "--hours":
        options.hours = parseFloat(args[++i]);
        break;
      case "--category":
        options.category = args[++i];
        break;
      case "--score":
        options.score = true;
        break;
      case "--wire":
        options.wire = true;
        break;
      case "--provider":
        options.provider = args[++i];
        break;
      case "--clear":
        options.clear = true;
        break;
      case "--output":
        options.output = args[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--timeout":
        options.timeout = parseInt(args[++i], 10);
        break;
      case "--mixed-categories":
        options.mixedCategories = true;
        break;
      case "--clear-only":
        options.clearOnly = true;
        options.clear = true;
        break;
      case "--help":
        console.log(`
Content Processing Script for The Quiet Feed

Usage: node scripts/process-feeds.js [options]

Options:
  --feeds <n>         Number of feeds to process (default: 5)
  --depth <n>         Max items per feed (default: 10)
  --hours <n>         Time window in hours (default: 24)
  --category <cat>    Filter by single category (e.g., tech, news, research)
  --mixed-categories  Include feeds from tech AND news categories
  --score             Enable LLM scoring (REQUIRED for meaningful content)
  --wire              Generate wire mode content (de-sensationalized titles/summaries)
  --provider <p>      LLM provider: 'ollama' or 'anthropic' (auto-detected)
  --clear             Clear all processed content before starting (fresh start)
  --clear-only        Clear output directory and exit (no processing)
  --timeout <secs>    Stop processing after N seconds (for incremental mode)
  --output <dir>      Output directory (default: app/test-data/test-feeds)
  --dry-run           Show what would be processed without writing
  --verbose           Show detailed progress
  --help              Show this help message

LLM Provider Setup:
  Ollama (recommended for local development):
    brew install ollama
    ollama serve &
    ollama pull phi3:mini

  Anthropic (for production-quality scoring):
    export ANTHROPIC_API_KEY="sk-ant-..."

Timing variants (via npm scripts):
  feeds:process-quick       ~30s  (4 items from 3 feeds with LLM scoring)
  feeds:process-balanced    ~2m   (9 items from 3 feeds with LLM scoring)
  feeds:process-incremental runs for --timeout seconds, skips duplicates

Examples:
  # Process with LLM scoring (auto-detect provider)
  node scripts/process-feeds.js --feeds 10 --score

  # Process with mixed tech and news categories
  node scripts/process-feeds.js --mixed-categories --feeds 6 --score

  # Incremental processing with 10-minute timeout
  node scripts/process-feeds.js --score --timeout 600 --verbose

  # Fresh start with LLM scoring
  node scripts/process-feeds.js --clear --feeds 10 --score --verbose
`);
        process.exit(0);
    }
  }

  return options;
}

// Load feed catalogue from TOML
function loadCatalogue() {
  const cataloguePath = join(projectRoot, "web/public/feeds.catalogue.toml");
  const content = readFileSync(cataloguePath, "utf-8");
  return toml.parse(content);
}

// Files to preserve during clear (house content)
const PRESERVE_FILES = ["about.json", "settings.json"];

// Clear output directory (preserving house content)
function clearOutputDirectory(outputDir, log) {
  if (!existsSync(outputDir)) {
    log(`Output directory doesn't exist, nothing to clear: ${outputDir}`);
    return;
  }

  log(`Clearing output directory: ${outputDir}`);
  log(`Preserving house content: ${PRESERVE_FILES.join(", ")}`);
  const files = readdirSync(outputDir);
  let cleared = 0;
  let preserved = 0;

  for (const file of files) {
    if (PRESERVE_FILES.includes(file)) {
      log(`  Preserving: ${file}`);
      preserved++;
      continue;
    }
    const filePath = join(outputDir, file);
    rmSync(filePath, { recursive: true, force: true });
    cleared++;
  }

  log(`Cleared ${cleared} files, preserved ${preserved} house content files`);
}

// Load existing processed hashes for deduplication
function loadProcessedHashes(outputDir) {
  const hashesPath = join(outputDir, ".processed-hashes.json");
  if (existsSync(hashesPath)) {
    try {
      const data = JSON.parse(readFileSync(hashesPath, "utf-8"));
      // Clean up old hashes (older than 7 days)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cleaned = {};
      for (const [hash, timestamp] of Object.entries(data)) {
        if (timestamp > sevenDaysAgo) {
          cleaned[hash] = timestamp;
        }
      }
      return cleaned;
    } catch {
      return {};
    }
  }
  return {};
}

// Save processed hashes
function saveProcessedHashes(outputDir, hashes) {
  const hashesPath = join(outputDir, ".processed-hashes.json");
  writeFileSync(hashesPath, JSON.stringify(hashes, null, 2));
}

// Filter sources by criteria
function filterSources(sources, options) {
  let filtered = sources.filter((s) => s.enabled !== false);

  if (options.mixedCategories) {
    // Include feeds from both tech and news categories, distributed evenly
    const techSources = filtered.filter((s) => s.category === "tech");
    const newsSources = filtered.filter((s) => s.category === "news");
    const halfFeeds = Math.ceil(options.feeds / 2);

    // Take half from tech, half from news (or as many as available)
    const selectedTech = techSources.slice(0, halfFeeds);
    const selectedNews = newsSources.slice(0, options.feeds - selectedTech.length);

    // If we don't have enough from one category, fill from the other
    const remaining = options.feeds - selectedTech.length - selectedNews.length;
    if (remaining > 0) {
      const moreTech = techSources.slice(halfFeeds, halfFeeds + remaining);
      const moreNews = newsSources.slice(options.feeds - selectedTech.length, options.feeds);
      filtered = [...selectedTech, ...selectedNews, ...moreTech, ...moreNews];
    } else {
      filtered = [...selectedTech, ...selectedNews];
    }

    return filtered.slice(0, options.feeds);
  }

  if (options.category) {
    filtered = filtered.filter((s) => s.category === options.category);
  }

  // Limit to requested number
  return filtered.slice(0, options.feeds);
}

// Check if item is within time window
function isWithinTimeWindow(item, hoursAgo) {
  if (!item.publishedAt) return true; // Include items without dates

  const publishedDate = new Date(item.publishedAt);
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return publishedDate >= cutoff;
}

// Check LLM availability and determine best provider
async function checkLLMAvailability(requestedProvider, log) {
  const { isOllamaAvailable } = await import("../app/lib/llmClient.js");

  // Check Ollama
  let ollamaAvailable = false;
  try {
    ollamaAvailable = await isOllamaAvailable();
    if (ollamaAvailable) {
      log("Ollama is running and available");
    }
  } catch (error) {
    log(`Ollama check failed: ${error.message}`);
  }

  // Check Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropicAvailable = !!anthropicKey;
  if (anthropicAvailable) {
    log("Anthropic API key is configured");
  }

  // Determine which provider to use
  if (requestedProvider) {
    // User explicitly requested a provider
    if (requestedProvider === "ollama") {
      if (ollamaAvailable) {
        return { provider: "ollama", available: true };
      } else {
        return {
          provider: null,
          available: false,
          error: `Ollama requested but not available.

To install Ollama:
  brew install ollama
  ollama serve &
  ollama pull phi3:mini

Then re-run this command.`,
        };
      }
    } else if (requestedProvider === "anthropic") {
      if (anthropicAvailable) {
        return { provider: "anthropic", available: true };
      } else {
        return {
          provider: null,
          available: false,
          error: `Anthropic requested but ANTHROPIC_API_KEY not set.

To use Anthropic:
  export ANTHROPIC_API_KEY="sk-ant-..."

Then re-run this command.`,
        };
      }
    } else {
      return {
        provider: null,
        available: false,
        error: `Unknown provider: ${requestedProvider}. Use 'ollama' or 'anthropic'.`,
      };
    }
  }

  // Auto-detect: prefer Ollama (free/local), fallback to Anthropic
  if (ollamaAvailable) {
    return { provider: "ollama", available: true };
  } else if (anthropicAvailable) {
    log("Using Anthropic API (Ollama not available)");
    return { provider: "anthropic", available: true };
  } else {
    return {
      provider: null,
      available: false,
      error: `No LLM provider available. LLM scoring is REQUIRED for meaningful content.

Option 1 - Install Ollama (recommended for local development):
  brew install ollama
  ollama serve &
  ollama pull phi3:mini

Option 2 - Use Anthropic API:
  export ANTHROPIC_API_KEY="sk-ant-..."

Then re-run: npm run feeds:process-full-refresh`,
    };
  }
}

// Main processing function
async function processFeeds(options) {
  const log = options.verbose ? console.log.bind(console) : () => {};
  const startTime = Date.now();

  log("Loading feed catalogue...");
  const catalogue = loadCatalogue();
  const sources = filterSources(catalogue.sources || [], options);

  if (sources.length === 0) {
    console.error("No feeds match the criteria");
    process.exit(1);
  }

  console.log(`Processing ${sources.length} feeds...`);

  // Ensure output directory exists
  const outputDir = join(projectRoot, options.output);

  // Clear output directory if requested
  if (options.clear && !options.dryRun) {
    clearOutputDirectory(outputDir, log);

    // If --clear-only, exit after clearing
    if (options.clearOnly) {
      console.log("\nCleared output directory (--clear-only mode)");
      return { processed: 0, skipped: 0, errors: 0, feeds: {} };
    }
  }

  if (!options.dryRun && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Check LLM availability if --score is enabled
  let llmProvider = null;
  if (options.score) {
    const llmStatus = await checkLLMAvailability(options.provider, log);

    if (!llmStatus.available) {
      console.error("\n" + "=".repeat(60));
      console.error("ERROR: LLM scoring requested but no provider available.");
      console.error("=".repeat(60));
      console.error(llmStatus.error);
      console.error("=".repeat(60) + "\n");
      process.exit(1);
    }

    llmProvider = llmStatus.provider;
    console.log(`\nUsing LLM provider: ${llmProvider}\n`);
  }

  // Load existing processed hashes (empty if cleared)
  const processedHashes = options.dryRun || options.clear ? {} : loadProcessedHashes(outputDir);
  const newHashes = { ...processedHashes };

  // Import services
  const { fetchAndParseFeed } = await import("../app/services/rssFeedService.js");
  const { scoreContent, generateWireContent } = await import("../app/services/scoringService.js");
  const { computeContentHash } = await import("../app/lib/contentHash.js");

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    feeds: {},
  };

  const allItems = [];

  // Timeout handling for incremental mode
  const timeoutMs = options.timeout ? options.timeout * 1000 : null;
  let timedOut = false;

  const checkTimeout = () => {
    if (timeoutMs && Date.now() - startTime > timeoutMs) {
      log(`\nTimeout reached (${options.timeout}s), stopping processing...`);
      timedOut = true;
      return true;
    }
    return false;
  };

  // Process each feed
  for (const source of sources) {
    if (checkTimeout()) break;

    log(`\nFetching: ${source.name} (${source.url})`);

    try {
      const items = await fetchAndParseFeed(source.url, { timeout: 15000 });
      log(`  Found ${items.length} items`);

      const feedItems = [];

      for (const item of items.slice(0, options.depth)) {
        if (checkTimeout()) break;

        // Check time window
        if (!isWithinTimeWindow(item, options.hours)) {
          log(`  Skipping (too old): ${item.title?.slice(0, 50)}...`);
          results.skipped++;
          continue;
        }

        // Check for duplicate (skip if not doing fresh start)
        const hash = computeContentHash(item);
        if (!options.clear && processedHashes[hash]) {
          log(`  Skipping (duplicate): ${item.title?.slice(0, 50)}...`);
          results.skipped++;
          continue;
        }

        // Score the item
        let scoreResult;
        if (options.score && llmProvider) {
          log(`  Scoring with ${llmProvider}: ${item.title?.slice(0, 50)}...`);
          scoreResult = await scoreContent(item, {
            useLocalLLM: llmProvider === "ollama",
            provider: llmProvider,
          });
        } else {
          log(`  Scoring with rules: ${item.title?.slice(0, 50)}...`);
          scoreResult = await scoreContent(item, { preferRules: true });
        }

        // Generate wire mode content (de-sensationalized titles/summaries)
        let wireResult = null;
        if (options.wire) {
          log(`  Generating wire content: ${item.title?.slice(0, 50)}...`);
          if (llmProvider) {
            wireResult = await generateWireContent(item, {
              useLocalLLM: llmProvider === "ollama",
              provider: llmProvider,
            });
          } else {
            wireResult = await generateWireContent(item, { preferRules: true });
          }
        }

        const processedItem = {
          ...item,
          hash,
          score: scoreResult.score,
          signals: scoreResult.signals,
          reasoning: scoreResult.reasoning,
          modelId: scoreResult.modelId,
          source: source.name,
          sourceId: source.id,
          category: source.category,
          processedAt: new Date().toISOString(),
          // Wire mode content (if generated)
          ...(wireResult && {
            wireTitle: wireResult.wireTitle,
            wireSummary: wireResult.wireSummary,
            wireModelId: wireResult.modelId,
          }),
        };

        feedItems.push(processedItem);
        allItems.push(processedItem);
        newHashes[hash] = Date.now();
        results.processed++;

        log(`  Processed: ${item.title?.slice(0, 50)}... (score: ${scoreResult.score})`);
      }

      results.feeds[source.id] = {
        name: source.name,
        category: source.category,
        itemCount: feedItems.length,
        items: feedItems,
      };
    } catch (error) {
      console.error(`  Error fetching ${source.name}: ${error.message}`);
      results.errors++;
      results.feeds[source.id] = {
        name: source.name,
        category: source.category,
        error: error.message,
        itemCount: 0,
        items: [],
      };
    }
  }

  // Write output files
  if (!options.dryRun) {
    // Write individual feed files
    for (const [sourceId, feedData] of Object.entries(results.feeds)) {
      if (feedData.items && feedData.items.length > 0) {
        const feedPath = join(outputDir, `${sourceId}.json`);
        writeFileSync(
          feedPath,
          JSON.stringify(
            {
              id: sourceId,
              name: feedData.name,
              category: feedData.category,
              generatedAt: new Date().toISOString(),
              itemCount: feedData.items.length,
              items: feedData.items,
            },
            null,
            2,
          ),
        );
        log(`Wrote: ${feedPath}`);
      }
    }

    // Write combined feed file
    const combinedPath = join(outputDir, "all-feeds.json");
    const sortedItems = allItems.sort((a, b) => {
      // Sort by score descending, then by date descending
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
    });

    writeFileSync(
      combinedPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourceCount: sources.length,
          itemCount: allItems.length,
          items: sortedItems,
        },
        null,
        2,
      ),
    );
    log(`Wrote: ${combinedPath}`);

    // Write default.json for use by the web app (matches sample-feeds format)
    const defaultPath = join(outputDir, "default.json");
    const defaultItems = sortedItems.slice(0, 50).map((item, index) => ({
      id: item.hash || `item-${index + 1}`,
      title: item.title,
      url: item.url,
      excerpt: item.excerpt,
      score: item.score,
      source: item.source,
      category: item.category,
      publishedAt: item.publishedAt,
      // Wire mode content (if available)
      ...(item.wireTitle && { wireTitle: item.wireTitle }),
      ...(item.wireSummary && { wireSummary: item.wireSummary }),
    }));
    writeFileSync(
      defaultPath,
      JSON.stringify(
        {
          name: "Curated Feed",
          description: "Fresh content from diverse sources",
          itemCount: defaultItems.length,
          generatedAt: new Date().toISOString(),
          items: defaultItems,
        },
        null,
        2,
      ),
    );
    log(`Wrote: ${defaultPath}`);

    // Write category-specific files (tech.json, news.json)
    const writeCategoryFeed = (categoryName, categoryFilter) => {
      const categoryItems = sortedItems
        .filter((item) => item.category === categoryFilter)
        .slice(0, 50)
        .map((item, index) => ({
          id: item.hash || `item-${index + 1}`,
          title: item.title,
          url: item.url,
          excerpt: item.excerpt,
          score: item.score,
          source: item.source,
          category: item.category,
          publishedAt: item.publishedAt,
          // Wire mode content (if available)
          ...(item.wireTitle && { wireTitle: item.wireTitle }),
          ...(item.wireSummary && { wireSummary: item.wireSummary }),
        }));

      if (categoryItems.length > 0) {
        const categoryPath = join(outputDir, `${categoryFilter}.json`);
        writeFileSync(
          categoryPath,
          JSON.stringify(
            {
              name: `${categoryName} Feed`,
              description: `Fresh ${categoryFilter} content`,
              itemCount: categoryItems.length,
              generatedAt: new Date().toISOString(),
              items: categoryItems,
            },
            null,
            2,
          ),
        );
        log(`Wrote: ${categoryPath}`);
      } else {
        log(`No items for category: ${categoryFilter}`);
      }
    };

    writeCategoryFeed("Tech", "tech");
    writeCategoryFeed("News", "news");

    // Save processed hashes
    saveProcessedHashes(outputDir, newHashes);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print summary
  console.log("\n=== Processing Summary ===");
  console.log(`Duration:        ${elapsed}s`);
  if (timedOut) {
    console.log(`Status:          Stopped (timeout reached)`);
  }
  console.log(`Feeds processed: ${sources.length}`);
  console.log(`Items processed: ${results.processed}`);
  console.log(`Items skipped:   ${results.skipped}`);
  console.log(`Errors:          ${results.errors}`);
  console.log(`Scoring method:  ${llmProvider ? `LLM (${llmProvider})` : "Rule-based"}`);
  if (!options.dryRun) {
    console.log(`Output:          ${outputDir}`);
  }

  return results;
}

// Run if called directly
processFeeds(parseArgs()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
