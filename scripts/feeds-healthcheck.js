#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Feed Catalog Healthcheck
 *
 * Checks all enabled feeds in the catalog for responsiveness and updates
 * the catalog with status information.
 *
 * Usage:
 *   node scripts/feeds-healthcheck.js [options]
 *
 * Options:
 *   --all             Check all feeds (including disabled)
 *   --category <cat>  Check only feeds in category
 *   --retries <n>     Number of retries (default: 2)
 *   --timeout <ms>    Initial timeout in ms (default: 10000)
 *   --dry-run         Show results without updating catalog
 *   --verbose         Show detailed progress
 *   --help            Show this help
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import toml from "@iarna/toml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const CATALOG_PATH = join(projectRoot, "web/public/feeds.catalogue.toml");

// Status constants
const STATUS = {
  HEALTHY: "healthy",
  UNRELIABLE: "unreliable",
  AUTH_REQUIRED: "auth_required",
  TIMEOUT: "timeout",
  ERROR: "error",
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    all: false,
    category: null,
    retries: 2,
    timeout: 10000,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--all":
        options.all = true;
        break;
      case "--category":
        options.category = args[++i];
        break;
      case "--retries":
        options.retries = parseInt(args[++i], 10);
        break;
      case "--timeout":
        options.timeout = parseInt(args[++i], 10);
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--help":
        console.log(`
Feed Catalog Healthcheck

Checks all enabled feeds in the catalog for responsiveness and updates
the catalog with status information.

Usage: node scripts/feeds-healthcheck.js [options]

Options:
  --all             Check all feeds (including disabled)
  --category <cat>  Check only feeds in category
  --retries <n>     Number of retries (default: 2)
  --timeout <ms>    Initial timeout in ms (default: 10000)
  --dry-run         Show results without updating catalog
  --verbose         Show detailed progress
  --help            Show this help

Examples:
  # Check all enabled feeds
  node scripts/feeds-healthcheck.js

  # Check all feeds including disabled, verbose output
  node scripts/feeds-healthcheck.js --all --verbose

  # Check only tech feeds with dry-run
  node scripts/feeds-healthcheck.js --category tech --dry-run
`);
        process.exit(0);
    }
  }

  return options;
}

// Check a single feed with retries
async function checkFeed(source, options) {
  const log = options.verbose ? console.log.bind(console) : () => {};
  const maxRetries = options.retries;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Increasing timeout for each retry: base, base*2, base*3
    const timeout = options.timeout * (attempt + 1);

    if (attempt > 0) {
      log(`  Retry ${attempt}/${maxRetries} with timeout ${timeout}ms...`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "TheQuietFeed/1.0 (healthcheck; +https://thequietfeed.com)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
      });

      clearTimeout(timeoutId);

      // Check response status
      if (response.ok) {
        // Verify it's actually a feed by checking content type or first bytes
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();
        const isXml =
          contentType.includes("xml") ||
          contentType.includes("rss") ||
          contentType.includes("atom") ||
          text.trim().startsWith("<?xml") ||
          text.trim().startsWith("<rss") ||
          text.trim().startsWith("<feed");

        if (isXml) {
          return {
            status: STATUS.HEALTHY,
            httpStatus: response.status,
            responseTime: Date.now(),
            error: null,
          };
        } else {
          return {
            status: STATUS.ERROR,
            httpStatus: response.status,
            error: `Invalid feed format (content-type: ${contentType})`,
          };
        }
      } else if (response.status === 401 || response.status === 403) {
        return {
          status: STATUS.AUTH_REQUIRED,
          httpStatus: response.status,
          error: `HTTP ${response.status}: Authentication required`,
        };
      } else if (response.status === 429) {
        // Rate limited - might be unreliable
        lastError = `HTTP ${response.status}: Rate limited`;
        continue; // Retry
      } else {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        continue; // Retry
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        lastError = `Timeout after ${timeout}ms`;
      } else if (error.code === "ENOTFOUND") {
        return {
          status: STATUS.ERROR,
          error: `DNS lookup failed: ${source.url}`,
        };
      } else if (error.code === "ECONNREFUSED") {
        return {
          status: STATUS.ERROR,
          error: `Connection refused: ${source.url}`,
        };
      } else {
        lastError = error.message;
      }
    }
  }

  // All retries exhausted
  return {
    status: STATUS.UNRELIABLE,
    error: lastError || "Unknown error after retries",
  };
}

// Main healthcheck function
async function runHealthcheck(options) {
  const log = options.verbose ? console.log.bind(console) : () => {};

  console.log("Loading feed catalog...");
  const catalogContent = readFileSync(CATALOG_PATH, "utf-8");
  const catalog = toml.parse(catalogContent);

  // Filter sources
  let sources = catalog.sources || [];
  if (!options.all) {
    sources = sources.filter((s) => s.enabled !== false);
  }
  if (options.category) {
    sources = sources.filter((s) => s.category === options.category);
  }

  console.log(`Checking ${sources.length} feeds...`);

  const results = {
    healthy: [],
    unreliable: [],
    authRequired: [],
    error: [],
    timeout: [],
  };

  const startTime = Date.now();

  for (const source of sources) {
    log(`\nChecking: ${source.name} (${source.id})`);
    log(`  URL: ${source.url}`);

    const result = await checkFeed(source, options);

    // Update source with status
    source.last_checked = new Date().toISOString();
    source.last_status = result.status;
    if (result.error) {
      source.last_error = result.error;
    } else {
      delete source.last_error;
    }

    // Track consecutive failures
    if (result.status === STATUS.HEALTHY) {
      source.consecutive_failures = 0;
      results.healthy.push(source.id);
      console.log(`  [OK] ${source.name}`);
    } else {
      source.consecutive_failures = (source.consecutive_failures || 0) + 1;

      if (result.status === STATUS.UNRELIABLE) {
        results.unreliable.push(source.id);
        console.log(`  [UNRELIABLE] ${source.name}: ${result.error}`);
      } else if (result.status === STATUS.AUTH_REQUIRED) {
        results.authRequired.push(source.id);
        console.log(`  [AUTH REQUIRED] ${source.name}: ${result.error}`);
      } else if (result.status === STATUS.TIMEOUT) {
        results.timeout.push(source.id);
        console.log(`  [TIMEOUT] ${source.name}: ${result.error}`);
      } else {
        results.error.push(source.id);
        console.log(`  [ERROR] ${source.name}: ${result.error}`);
      }

      // Auto-disable if too many consecutive failures
      if (source.consecutive_failures >= 5 && source.enabled !== false) {
        log(`  Auto-disabling ${source.name} after ${source.consecutive_failures} consecutive failures`);
        source.enabled = false;
        source.auto_disabled = true;
        source.auto_disabled_reason = `${source.consecutive_failures} consecutive failures: ${result.error}`;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print summary
  console.log("\n=== Healthcheck Summary ===");
  console.log(`Duration: ${elapsed}s`);
  console.log(`Healthy:       ${results.healthy.length}`);
  console.log(`Unreliable:    ${results.unreliable.length}`);
  console.log(`Auth Required: ${results.authRequired.length}`);
  console.log(`Errors:        ${results.error.length}`);

  if (results.unreliable.length > 0) {
    console.log("\nUnreliable feeds:");
    results.unreliable.forEach((id) => console.log(`  - ${id}`));
  }

  if (results.authRequired.length > 0) {
    console.log("\nFeeds requiring authentication:");
    results.authRequired.forEach((id) => console.log(`  - ${id}`));
  }

  if (results.error.length > 0) {
    console.log("\nFeeds with errors:");
    results.error.forEach((id) => console.log(`  - ${id}`));
  }

  // Update catalog file
  if (!options.dryRun) {
    console.log("\nUpdating catalog...");
    const updatedContent = toml.stringify(catalog);
    writeFileSync(CATALOG_PATH, updatedContent);
    console.log(`Catalog updated: ${CATALOG_PATH}`);
  } else {
    console.log("\nDry run - catalog not updated");
  }

  return results;
}

// Run if called directly
runHealthcheck(parseArgs()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
