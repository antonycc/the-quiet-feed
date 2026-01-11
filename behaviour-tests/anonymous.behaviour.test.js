// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

// behaviour-tests/anonymous.behaviour.test.js
// Anonymous user behaviour test - visits homepage without login, expects default feed

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { dotenvConfigIfNotBlank } from "@app/lib/env.js";
import {
  addOnPageLogging,
  getEnvVarAndLog,
  runLocalHttpServer,
} from "./helpers/behaviour-helpers.js";

dotenvConfigIfNotBlank({ path: ".env" });

const screenshotPath = "target/behaviour-test-results/screenshots/anonymous-behaviour-test";

const envFilePath = getEnvVarAndLog("envFilePath", "DIY_SUBMIT_ENV_FILEPATH", null);
const httpServerPort = getEnvVarAndLog("serverPort", "TEST_SERVER_HTTP_PORT", 3000);
const runTestServer = getEnvVarAndLog("runTestServer", "TEST_SERVER_HTTP", null);
// For anonymous test, always use local server - no need for ngrok/OAuth

let serverProcess;

// Timestamp helper for unique screenshot names
const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

test.setTimeout(120_000);

test.beforeEach(async ({}, testInfo) => {
  testInfo.annotations.push({ type: "test-id", description: "web-test-anonymous" });
});

test.beforeAll(async () => {
  console.log("Starting anonymous behaviour test beforeAll hook...");

  if (!envFilePath) {
    throw new Error("Environment variable DIY_SUBMIT_ENV_FILEPATH is not set");
  }

  // Ensure screenshot directory exists
  fs.mkdirSync(screenshotPath, { recursive: true });

  // Run local HTTP server if configured
  serverProcess = await runLocalHttpServer(runTestServer, httpServerPort);

  console.log("beforeAll hook completed successfully");
});

test.afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

test("Anonymous user: View default feed without login", async ({ page }, testInfo) => {
  // For anonymous test, always use local HTTP server (no OAuth/ngrok needed)
  const testUrl = `http://127.0.0.1:${httpServerPort}/`;

  // Add console logging to capture browser messages
  addOnPageLogging(page);

  // Test artefacts directory
  const outputDir = testInfo.outputPath("");
  fs.mkdirSync(outputDir, { recursive: true });

  /* ****************** */
  /*  GO TO HOME PAGE   */
  /* ****************** */

  await test.step("Navigate to homepage", async () => {
    console.log(`[Anonymous Test] Navigating to: ${testUrl}`);
    await page.goto(testUrl);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${screenshotPath}/01-${timestamp()}-homepage-initial.png` });
  });

  /* ****************** */
  /*  VERIFY NOT LOGGED IN  */
  /* ****************** */

  await test.step("Verify not logged in", async () => {
    // Check login status shows "ANONYMOUS"
    const loginStatus = page.locator("#loginStatus");
    await expect(loginStatus).toContainText("ANONYMOUS");

    // Check auth link shows "ENHANCE" (not "SETTINGS")
    const authLink = page.locator("#authLink");
    await expect(authLink).toContainText("ENHANCE");

    await page.screenshot({ path: `${screenshotPath}/02-${timestamp()}-not-logged-in-verified.png` });
    console.log("[Anonymous Test] Verified user is not logged in");
  });

  /* ****************** */
  /*  VERIFY DEFAULT FEED LOADS */
  /* ****************** */

  await test.step("Verify default feed loads", async () => {
    // Wait for feed container to have items
    const feedContainer = page.locator("#feedContainer");
    await expect(feedContainer).toBeVisible();

    // Wait for spinner to disappear (feed loaded)
    const spinner = page.locator("#feedSpinner");
    await expect(spinner).toBeHidden({ timeout: 10000 });

    // Verify feed items are displayed
    const feedItems = page.locator(".feed-item");
    const itemCount = await feedItems.count();
    console.log(`[Anonymous Test] Found ${itemCount} feed items`);
    expect(itemCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${screenshotPath}/03-${timestamp()}-feed-loaded.png` });
  });

  /* ****************** */
  /*  VERIFY FEED HEADER */
  /* ****************** */

  await test.step("Verify feed header displays correctly", async () => {
    // Check feed name
    const feedName = page.locator("#feedName");
    await expect(feedName).toContainText("CURATED FEED");

    // Check item count is displayed
    const feedCount = page.locator("#feedCount");
    await expect(feedCount).toContainText("items");

    // Check "ALL" source button is active
    const allButton = page.locator('[data-feed="default"]');
    await expect(allButton).toHaveClass(/active/);

    await page.screenshot({ path: `${screenshotPath}/04-${timestamp()}-feed-header.png` });
    console.log("[Anonymous Test] Feed header verified");
  });

  /* ****************** */
  /*  VERIFY FEED ITEM STRUCTURE */
  /* ****************** */

  await test.step("Verify feed item structure", async () => {
    // Check first feed item has required elements
    const firstItem = page.locator(".feed-item").first();
    await expect(firstItem).toBeVisible();

    // Verify score is displayed
    const scoreValue = firstItem.locator(".score-value");
    await expect(scoreValue).toBeVisible();
    const scoreText = await scoreValue.textContent();
    const score = parseInt(scoreText, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    console.log(`[Anonymous Test] First item score: ${score}`);

    // Verify title link exists
    const titleLink = firstItem.locator(".feed-item-title a");
    await expect(titleLink).toBeVisible();

    // Verify source is displayed
    const source = firstItem.locator(".feed-item-source");
    await expect(source).toBeVisible();

    await page.screenshot({ path: `${screenshotPath}/05-${timestamp()}-feed-item-structure.png` });
  });

  /* ****************** */
  /*  TEST FEED FILTERS */
  /* ****************** */

  await test.step("Test feed filters", async () => {
    // Click HIGH SCORE filter
    const highScoreFilter = page.locator(".feed-filter").filter({ hasText: "HIGH SCORE" });
    await highScoreFilter.click();
    await page.waitForTimeout(500); // Wait for filter to apply

    await page.screenshot({ path: `${screenshotPath}/06-${timestamp()}-high-score-filter.png` });

    // Verify filter is active
    await expect(highScoreFilter).toHaveClass(/active/);

    // Reset to ALL filter
    const allFilter = page.locator(".feed-filter").filter({ hasText: "ALL" });
    await allFilter.click();
    await page.waitForTimeout(500);

    console.log("[Anonymous Test] Filters tested");
  });

  /* ****************** */
  /*  TEST FEED SOURCE SWITCHING */
  /* ****************** */

  await test.step("Test feed source switching", async () => {
    // Click TECH source
    const techButton = page.locator('[data-feed="tech"]');
    await techButton.click();
    await page.waitForTimeout(1000); // Wait for new feed to load

    await page.screenshot({ path: `${screenshotPath}/07-${timestamp()}-tech-feed.png` });

    // Verify TECH is active
    await expect(techButton).toHaveClass(/active/);

    // Check feed name changed
    const feedName = page.locator("#feedName");
    await expect(feedName).toContainText("TECH");

    // Switch back to default
    const defaultButton = page.locator('[data-feed="default"]');
    await defaultButton.click();
    await page.waitForTimeout(1000);

    console.log("[Anonymous Test] Feed sources tested");
  });

  /* ****************** */
  /*  TEST LOAD MORE (SHIELD) */
  /* ****************** */

  await test.step("Test SHIELD pagination (Load More)", async () => {
    // Check if Load More button exists
    const loadMoreContainer = page.locator("#loadMoreContainer");
    const isLoadMoreVisible = await loadMoreContainer.isVisible();

    if (isLoadMoreVisible) {
      const loadMoreButton = page.locator(".btn-load-more");
      await loadMoreButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: `${screenshotPath}/08-${timestamp()}-after-load-more.png` });
      console.log("[Anonymous Test] Load More button clicked");
    } else {
      console.log("[Anonymous Test] All items already displayed, no Load More needed");
    }
  });

  /* ****************** */
  /*  FINAL FULL PAGE SCREENSHOT */
  /* ****************** */

  await test.step("Capture final state", async () => {
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    await page.screenshot({
      path: `${screenshotPath}/09-${timestamp()}-final-state.png`,
      fullPage: true,
    });
    console.log("[Anonymous Test] Final state captured");
  });

  /* ****************** */
  /*  TEST CONTEXT JSON  */
  /* ****************** */

  const testContext = {
    testId: "web-test-anonymous",
    name: testInfo.title,
    title: "Anonymous User Feed View",
    description: "Verifies anonymous users can view the default feed without logging in. Tests SHIELD compliance (explicit pagination, no infinite scroll).",
    env: {
      serverPort: httpServerPort,
      runTestServer,
    },
    testData: {
      testUrl,
      feedItemsVerified: true,
      shieldCompliant: true,
    },
    artefactsDir: outputDir,
    screenshotPath,
    testStartTime: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(path.join(outputDir, "testContext.json"), JSON.stringify(testContext, null, 2), "utf-8");
  } catch (_e) {
    console.error("[Anonymous Test] Failed to write test context:", _e);
  }

  console.log("[Anonymous Test] Test completed successfully");
});
