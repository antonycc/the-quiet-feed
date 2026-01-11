// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCatalog, loadCatalogFromRoot, bundlesForActivity, isActivityAvailable } from "../../services/productCatalog.js";
import { dotenvConfigIfNotBlank } from "@app/lib/env.js";

dotenvConfigIfNotBlank({ path: ".env.test" });

describe("productCatalogHelper", () => {
  const tomlPath = path.join(process.cwd(), "web/public/submit.catalogue.toml");
  const tomlText = fs.readFileSync(tomlPath, "utf-8");

  it("parseCatalog should parse TOML into object", () => {
    const catalog = parseCatalog(tomlText);
    expect(catalog).toBeTruthy();
    expect(catalog.version).toBeTypeOf("string");
    expect(Array.isArray(catalog.bundles)).toBe(true);
    expect(Array.isArray(catalog.activities)).toBe(true);
  });

  it("loadCatalogFromRoot should load and parse file from root", () => {
    const catalog = loadCatalogFromRoot();
    expect(catalog.version).toBe("2.0.0");
  });

  it("bundlesForActivity should return expected bundles", () => {
    const catalog = parseCatalog(tomlText);
    expect(bundlesForActivity(catalog, "view-feed")).toEqual(["anonymous", "enhance", "hard-copy"]);
    expect(bundlesForActivity(catalog, "api-feed")).toEqual(["hard-copy"]);
  });

  it("isActivityAvailable should work for positive and negative cases", () => {
    const catalog = parseCatalog(tomlText);
    expect(isActivityAvailable(catalog, "view-feed", "anonymous")).toBe(true);
    expect(isActivityAvailable(catalog, "api-feed", "anonymous")).toBe(false);
    expect(isActivityAvailable(catalog, "api-feed", "hard-copy")).toBe(true);
  });
});
