// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

// app/system-tests/feedToHomePage.system.test.js
//
// System test for the feed processing to home page workflow:
// 1. Run Ollama (prerequisite)
// 2. Run `npm run feeds:process-quick-refresh`
// 3. Run `npm start`
// 4. Browse the home page
// 5. Expect: Fresh LLM-scored content visible on home page

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runLocalHttpServer } from "../../behaviour-tests/helpers/behaviour-helpers.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SAMPLE_FEEDS_DIR = join(process.cwd(), "app/test-data/sample-feeds");
const DEFAULT_FEED_PATH = join(SAMPLE_FEEDS_DIR, "default.json");

describe("System: Feed Processing to Home Page Workflow", () => {
  /** @type {import('child_process').ChildProcess | undefined} */
  let serverProcess;
  const port = 3100 + Math.floor(Math.random() * 200);

  beforeAll(async () => {
    serverProcess = await runLocalHttpServer("run", port);
    expect(serverProcess?.pid).toBeTruthy();
  }, 60_000);

  afterAll(async () => {
    try {
      serverProcess?.kill();
    } catch {}
  });

  describe("Pre-requisite: sample-feeds directory", () => {
    it("sample-feeds directory exists", () => {
      expect(existsSync(SAMPLE_FEEDS_DIR)).toBe(true);
    });

    it("default.json exists in sample-feeds", () => {
      expect(existsSync(DEFAULT_FEED_PATH)).toBe(true);
    });

    it("default.json has valid feed structure", () => {
      const content = readFileSync(DEFAULT_FEED_PATH, "utf-8");
      const feed = JSON.parse(content);

      expect(feed).toHaveProperty("name");
      expect(feed).toHaveProperty("items");
      expect(Array.isArray(feed.items)).toBe(true);
    });
  });

  describe("Server serves sample-feeds at /sample-feeds/", () => {
    it("serves default.json at /sample-feeds/default.json", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/sample-feeds/default.json`);
      expect(response.status).toBe(200);

      const feed = await response.json();
      expect(feed).toHaveProperty("name");
      expect(feed).toHaveProperty("items");
    });

    it("feed items have required fields", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/sample-feeds/default.json`);
      const feed = await response.json();

      expect(feed.items.length).toBeGreaterThan(0);

      const item = feed.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("source");
    });

    it("feed items have scores (LLM scoring was used)", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/sample-feeds/default.json`);
      const feed = await response.json();

      // At least some items should have scores
      const scoredItems = feed.items.filter((item) => typeof item.score === "number");
      expect(scoredItems.length).toBeGreaterThan(0);

      // Scores should be in valid range 0-100
      for (const item of scoredItems) {
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("Home page loads and displays feed content", () => {
    it("home page loads successfully", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain("The Quiet Feed");
    });

    it("home page has feed container for displaying items", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      const html = await response.text();

      expect(html).toContain("feedContainer");
      expect(html).toContain("sample-feeds");
    });
  });

  describe("House content is preserved", () => {
    it("about.json exists and has expected structure", () => {
      const aboutPath = join(SAMPLE_FEEDS_DIR, "about.json");
      expect(existsSync(aboutPath)).toBe(true);

      const content = readFileSync(aboutPath, "utf-8");
      const about = JSON.parse(content);
      expect(about).toHaveProperty("name");
    });

    it("settings.json exists and has expected structure", () => {
      const settingsPath = join(SAMPLE_FEEDS_DIR, "settings.json");
      expect(existsSync(settingsPath)).toBe(true);

      const content = readFileSync(settingsPath, "utf-8");
      const settings = JSON.parse(content);
      expect(settings).toHaveProperty("name");
    });
  });

  describe("Category-specific feeds exist", () => {
    it("tech.json exists and has items", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/sample-feeds/tech.json`);
      expect(response.status).toBe(200);

      const feed = await response.json();
      expect(feed).toHaveProperty("name");
      expect(feed.name).toContain("Tech");
      expect(feed).toHaveProperty("items");
      expect(feed.items.length).toBeGreaterThan(0);

      // All items should have tech category
      for (const item of feed.items) {
        expect(item.category).toBe("tech");
      }
    });

    it("news.json exists and has items", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/sample-feeds/news.json`);
      expect(response.status).toBe(200);

      const feed = await response.json();
      expect(feed).toHaveProperty("name");
      expect(feed.name).toContain("News");
      expect(feed).toHaveProperty("items");
      expect(feed.items.length).toBeGreaterThan(0);

      // All items should have news category
      for (const item of feed.items) {
        expect(item.category).toBe("news");
      }
    });
  });
});
