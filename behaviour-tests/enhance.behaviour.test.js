// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

// behaviour-tests/enhance.behaviour.test.js
// Enhanced user behaviour test - authenticated users with feed preferences

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { dotenvConfigIfNotBlank } from "@app/lib/env.js";
import {
  addOnPageLogging,
  getEnvVarAndLog,
  runLocalDynamoDb,
  runLocalHttpServer,
  runLocalOAuth2Server,
} from "./helpers/behaviour-helpers.js";
import { consentToDataCollection, goToHomePageExpectNotLoggedIn } from "./steps/behaviour-steps.js";
import {
  clickLogIn,
  loginWithCognitoOrMockAuth,
  logOutAndExpectToBeLoggedOut,
  verifyLoggedInStatus,
} from "./steps/behaviour-login-steps.js";

dotenvConfigIfNotBlank({ path: ".env" });

const screenshotPath = "target/behaviour-test-results/screenshots/enhance-behaviour-test";

const originalEnv = { ...process.env };

const envFilePath = getEnvVarAndLog("envFilePath", "DIY_SUBMIT_ENV_FILEPATH", null);
const httpServerPort = getEnvVarAndLog("serverPort", "TEST_SERVER_HTTP_PORT", 3000);
const httpsServerPort = getEnvVarAndLog("httpsServerPort", "TEST_SERVER_HTTPS_PORT", 3443);
const runTestServer = getEnvVarAndLog("runTestServer", "TEST_SERVER_HTTP", null);
const useHttps = getEnvVarAndLog("useHttps", "USE_HTTPS", "false") === "true";
const runMockOAuth2 = getEnvVarAndLog("runMockOAuth2", "TEST_MOCK_OAUTH2", null);
const testAuthProvider = getEnvVarAndLog("testAuthProvider", "TEST_AUTH_PROVIDER", null);
const testAuthUsername = getEnvVarAndLog("testAuthUsername", "TEST_AUTH_USERNAME", null);
const baseUrl = getEnvVarAndLog("baseUrl", "DIY_SUBMIT_BASE_URL", null);
const runDynamoDb = getEnvVarAndLog("runDynamoDb", "TEST_DYNAMODB", null);
const bundleTableName = getEnvVarAndLog("bundleTableName", "BUNDLE_DYNAMODB_TABLE_NAME", null);

let mockOAuth2Process;
let serverProcess;
let dynamoControl;

// Timestamp helper for unique screenshot names
const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

test.setTimeout(300_000);

test.beforeEach(async ({}, testInfo) => {
  testInfo.annotations.push({ type: "test-id", description: "enhanceBehaviour" });
});

test.beforeAll(async () => {
  console.log("Starting enhance behaviour test beforeAll hook...");

  if (!envFilePath) {
    throw new Error("Environment variable DIY_SUBMIT_ENV_FILEPATH is not set");
  }

  process.env = { ...originalEnv };

  // Ensure screenshot directory exists
  fs.mkdirSync(screenshotPath, { recursive: true });

  // Run servers needed for the test
  dynamoControl = await runLocalDynamoDb(runDynamoDb, bundleTableName);
  mockOAuth2Process = await runLocalOAuth2Server(runMockOAuth2);
  serverProcess = await runLocalHttpServer(runTestServer, httpServerPort, { useHttps, httpsPort: httpsServerPort });

  console.log("beforeAll hook completed successfully");
});

test.afterAll(async () => {
  if (serverProcess) serverProcess.kill();
  if (mockOAuth2Process) mockOAuth2Process.kill();
  try {
    await dynamoControl?.stop?.();
  } catch {}
});

test("Enhanced user: Login, view feeds, and use enhanced features", async ({ page }, testInfo) => {
  // Use baseUrl (which should be https://local.thequietfeed.com:3443/ for local HTTPS)
  // Or fall back to the local server URL if baseUrl is not set
  const testUrl = baseUrl || (useHttps ? `https://local.thequietfeed.com:${httpsServerPort}/` : `http://127.0.0.1:${httpServerPort}/`);

  // Add console logging to capture browser messages
  addOnPageLogging(page);

  // Test artefacts directory
  const outputDir = testInfo.outputPath("");
  fs.mkdirSync(outputDir, { recursive: true });

  /* ****************** */
  /*  CLEAR SESSION     */
  /* ****************** */

  await test.step("Clear browser session", async () => {
    await page.context().clearCookies();
    await page.goto(testUrl);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    console.log("[Enhance Test] Cleared browser session");
  });

  /* ****************** */
  /*  GO TO HOME PAGE   */
  /* ****************** */

  await goToHomePageExpectNotLoggedIn(page, testUrl, screenshotPath);

  /* ****************** */
  /*  VERIFY ENHANCE PROMPT */
  /* ****************** */

  await test.step("Verify ENHANCE prompt for anonymous user", async () => {
    // Check auth link shows "ENHANCE"
    const authLink = page.locator("#authLink");
    await expect(authLink).toContainText("ENHANCE");
    await page.screenshot({ path: `${screenshotPath}/01-${timestamp()}-enhance-prompt.png` });
    console.log("[Enhance Test] ENHANCE prompt visible for anonymous user");
  });

  /* ****************** */
  /*  LOGIN             */
  /* ****************** */

  await clickLogIn(page, screenshotPath);
  await loginWithCognitoOrMockAuth(page, testAuthProvider, testAuthUsername, screenshotPath);
  await verifyLoggedInStatus(page, screenshotPath);
  await consentToDataCollection(page, screenshotPath);

  /* ****************** */
  /*  VERIFY AUTHENTICATED STATE */
  /* ****************** */

  await test.step("Verify authenticated user state", async () => {
    // Check login status shows user identifier
    const loginStatus = page.locator("#loginStatus");
    await expect(loginStatus).not.toContainText("ANONYMOUS");

    // Check auth link now shows "SETTINGS" instead of "ENHANCE"
    const authLink = page.locator("#authLink");
    await expect(authLink).toContainText("SETTINGS");

    await page.screenshot({ path: `${screenshotPath}/05-${timestamp()}-authenticated.png` });
    console.log("[Enhance Test] Verified authenticated user state");
  });

  /* ****************** */
  /*  VIEW FEEDS AS AUTHENTICATED USER */
  /* ****************** */

  await test.step("View feeds as authenticated user", async () => {
    // Navigate to home to view feeds
    await page.goto(testUrl);
    await page.waitForLoadState("networkidle");

    // Wait for feed to load
    const feedContainer = page.locator("#feedContainer");
    await expect(feedContainer).toBeVisible();

    // Verify feed items are displayed
    const feedItems = page.locator(".feed-item");
    const itemCount = await feedItems.count();
    console.log(`[Enhance Test] Found ${itemCount} feed items as authenticated user`);
    expect(itemCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${screenshotPath}/06-${timestamp()}-authenticated-feed.png` });
  });

  /* ****************** */
  /*  TEST FEED SOURCE SWITCHING */
  /* ****************** */

  await test.step("Test feed source switching", async () => {
    // Click TECH source
    const techButton = page.locator('[data-feed="tech"]');
    if (await techButton.isVisible()) {
      await techButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: `${screenshotPath}/07-${timestamp()}-tech-feed.png` });

      // Verify TECH is active
      await expect(techButton).toHaveClass(/active/);

      // Check feed name changed
      const feedName = page.locator("#feedName");
      await expect(feedName).toContainText("TECH");

      console.log("[Enhance Test] Feed source switching works");
    }

    // Switch back to default
    const defaultButton = page.locator('[data-feed="default"]');
    await defaultButton.click();
    await page.waitForTimeout(1000);
  });

  /* ****************** */
  /*  TEST SCORE FILTERS */
  /* ****************** */

  await test.step("Test score filters", async () => {
    // Click HIGH SCORE filter
    const highScoreFilter = page.locator(".feed-filter").filter({ hasText: "HIGH SCORE" });
    if (await highScoreFilter.isVisible()) {
      await highScoreFilter.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: `${screenshotPath}/08-${timestamp()}-high-score-filter.png` });

      // Verify filter is active
      await expect(highScoreFilter).toHaveClass(/active/);
      console.log("[Enhance Test] HIGH SCORE filter applied");
    }

    // Reset to ALL filter
    const allFilter = page.locator(".feed-filter").filter({ hasText: "ALL" });
    if (await allFilter.isVisible()) {
      await allFilter.click();
      await page.waitForTimeout(500);
    }
  });

  /* ****************** */
  /*  LOGOUT            */
  /* ****************** */

  await logOutAndExpectToBeLoggedOut(page, screenshotPath);

  /* ****************** */
  /*  VERIFY BACK TO ANONYMOUS */
  /* ****************** */

  await test.step("Verify returned to anonymous state", async () => {
    await page.goto(testUrl);
    await page.waitForLoadState("networkidle");

    // Check login status shows "ANONYMOUS"
    const loginStatus = page.locator("#loginStatus");
    await expect(loginStatus).toContainText("ANONYMOUS");

    // Check auth link shows "ENHANCE" again
    const authLink = page.locator("#authLink");
    await expect(authLink).toContainText("ENHANCE");

    await page.screenshot({ path: `${screenshotPath}/10-${timestamp()}-logged-out.png` });
    console.log("[Enhance Test] Verified return to anonymous state");
  });

  /* ****************** */
  /*  FINAL SCREENSHOT  */
  /* ****************** */

  await test.step("Capture final state", async () => {
    await page.screenshot({
      path: `${screenshotPath}/11-${timestamp()}-final-state.png`,
      fullPage: true,
    });
    console.log("[Enhance Test] Test completed successfully");
  });

  /* ****************** */
  /*  TEST CONTEXT      */
  /* ****************** */

  const testContext = {
    testId: "enhanceBehaviour",
    name: testInfo.title,
    title: "Enhanced User Feed Experience",
    description: "Verifies authenticated users can login, view feeds, use filters, and logout. Tests ENHANCE tier features.",
    env: {
      serverPort: httpServerPort,
      runTestServer,
      baseUrl,
    },
    testData: {
      testUrl,
      feedSourcesVerified: true,
      filtersVerified: true,
      logoutVerified: true,
    },
    artefactsDir: outputDir,
    screenshotPath,
    testStartTime: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(path.join(outputDir, "testContext.json"), JSON.stringify(testContext, null, 2), "utf-8");
  } catch (_e) {
    console.error("[Enhance Test] Failed to write test context:", _e);
  }
});
