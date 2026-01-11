// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

// app/unit-tests/bundleEnforcement.test.js

import { beforeEach, describe, expect, test, vi } from "vitest";
import { dotenvConfigIfNotBlank } from "@app/lib/env.js";
// Import real functions from bundleManagement
import { BundleAuthorizationError, BundleEntitlementError, enforceBundles } from "@app/services/bundleManagement.js";
import { getUserBundles } from "@app/data/dynamoDbBundleRepository.js";

dotenvConfigIfNotBlank({ path: ".env.test" });

// Mock the DynamoDB bundle store at the module boundary used by bundleManagement
vi.mock("@app/data/dynamoDbBundleRepository.js", () => ({
  getUserBundles: vi.fn(),
  putBundle: vi.fn(),
  deleteBundle: vi.fn(),
  deleteAllBundles: vi.fn(),
  isDynamoDbEnabled: vi.fn(() => true),
}));

// Import the mocked functions for assertions in tests that go via Dynamo
//import * as dynamoDbBundleStore from "@app/data/dynamoDbBundleRepository.js";
//import { getUserBundles } from "@app/data/dynamoDbBundleRepository.js";

function base64UrlEncode(obj) {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function makeJWT(sub = "user-123", extra = {}) {
  const header = { alg: "none", typ: "JWT" };
  const payload = {
    sub,
    email: `${sub}@example.com`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...extra,
  };
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.`;
}

function buildEvent(token, authorizerContext = null, urlPath = null) {
  const event = {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };

  if (authorizerContext) {
    event.requestContext = {
      authorizer: {
        lambda: authorizerContext,
      },
    };
  }

  if (urlPath) {
    event.requestContext = event.requestContext || {};
    event.requestContext.http = event.requestContext.http || {};
    event.requestContext.http.path = urlPath;
  }

  return event;
}

describe("bundleEnforcement.js", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      DIY_SUBMIT_ENFORCE_BUNDLES: "true",
      // Ensure we do NOT use mock bundle store for enforceBundles tests by default
      TEST_BUNDLE_MOCK: "false",
    };
  });

  describe("enforceBundles", () => {
    test("should throw BundleAuthorizationError when no authorization token", async () => {
      const event = buildEvent(null);

      await expect(enforceBundles(event)).rejects.toThrow(BundleAuthorizationError);
      await expect(enforceBundles(event)).rejects.toThrow("Missing Authorization Bearer token");
    });

    test("should throw BundleEntitlementError when JWT is invalid", async () => {
      const event = buildEvent("invalid-token");

      await expect(enforceBundles(event)).rejects.toThrow(BundleAuthorizationError);
    });

    test("should allow access with enhance bundle", async () => {
      const token = makeJWT("user-with-enhance-bundle");
      const authorizerContext = {
        jwt: {
          claims: {
            "sub": "user-with-enhance-bundle",
            "cognito:username": "test",
            "email": "test@thequietfeed.com",
            "scope": "read write",
          },
        },
      };
      const event = buildEvent(token, authorizerContext);

      // Dynamo returns objects; enforceBundles maps to bundleId
      getUserBundles.mockResolvedValue([{ bundleId: "enhance", expiry: new Date().toISOString() }]);

      // Should not throw
      await enforceBundles(event);

      expect(getUserBundles).toHaveBeenCalledWith("user-with-enhance-bundle");
    });

    test("should allow access with enhance bundle with expiry", async () => {
      const token = makeJWT("user-with-enhance-bundle-expiry");
      const authorizerContext = {
        jwt: {
          claims: {
            "sub": "user-with-enhance-bundle-expiry",
            "cognito:username": "test",
            "email": "test@thequietfeed.com",
            "scope": "read write",
          },
        },
      };
      const event = buildEvent(token, authorizerContext);

      getUserBundles.mockResolvedValue([{ bundleId: "enhance", expiry: new Date().toISOString() }]);

      // Should not throw
      await enforceBundles(event);

      expect(getUserBundles).toHaveBeenCalledWith("user-with-enhance-bundle-expiry");
    });

    test("should deny API access without hard-copy bundle", async () => {
      const token = makeJWT("user-without-bundle");
      const authorizerContext = {
        jwt: {
          claims: {
            "sub": "user-without-bundle",
            "cognito:username": "test",
            "email": "test@thequietfeed.com",
            "scope": "read write",
          },
        },
      };
      const apiFeedUrlPath = "/api/v1/feed";
      const event = buildEvent(token, authorizerContext, apiFeedUrlPath);

      getUserBundles.mockResolvedValue([]);

      await expect(enforceBundles(event)).rejects.toThrow(BundleEntitlementError);
    });

    test("should allow access with anonymous bundle", async () => {
      const token = makeJWT("user-with-anonymous-bundle");
      const authorizerContext = {
        jwt: {
          claims: {
            "sub": "user-with-anonymous-bundle",
            "cognito:username": "test",
            "email": "test@thequietfeed.com",
            "scope": "read write",
          },
        },
      };
      const event = buildEvent(token, authorizerContext);

      getUserBundles.mockResolvedValue([{ bundleId: "anonymous", expiry: new Date().toISOString() }]);

      // Should not throw
      await enforceBundles(event);

      expect(getUserBundles).toHaveBeenCalledWith("user-with-anonymous-bundle");
    });

    test("should allow access with hard-copy bundle", async () => {
      const token = makeJWT("user-with-hardcopy-bundle");
      const authorizerContext = {
        jwt: {
          claims: {
            "sub": "user-with-hardcopy-bundle",
            "cognito:username": "test",
            "email": "test@thequietfeed.com",
            "scope": "read write",
          },
        },
      };
      const event = buildEvent(token, authorizerContext);

      getUserBundles.mockResolvedValue([{ bundleId: "hard-copy", expiry: new Date().toISOString() }]);

      // Should not throw
      await enforceBundles(event);

      expect(getUserBundles).toHaveBeenCalledWith("user-with-hardcopy-bundle");
    });

    test("should allow access with enhance bundle with expiry for feed viewing", async () => {
      const token = makeJWT("user-with-enhance-bundle-expiry");
      const authorizerContext = {
        jwt: {
          claims: {
            "sub": "user-with-enhance-bundle-expiry",
            "cognito:username": "test",
            "email": "test@thequietfeed.com",
            "scope": "read write",
          },
        },
      };
      const event = buildEvent(token, authorizerContext);

      getUserBundles.mockResolvedValue([{ bundleId: "enhance", expiry: new Date().toISOString() }]);

      // Should not throw
      await enforceBundles(event);

      expect(getUserBundles).toHaveBeenCalledWith("user-with-enhance-bundle-expiry");
    });

    test("should extract user info from authorizer context", async () => {
      const authorizerContext = {
        sub: "user-from-authorizer",
        username: "testuser",
      };
      const event = buildEvent(null, authorizerContext);

      getUserBundles.mockResolvedValue([{ bundleId: "enhance", expiry: new Date().toISOString() }]);

      // Should not throw
      await enforceBundles(event);

      expect(getUserBundles).toHaveBeenCalledWith("user-from-authorizer");
    });
  });
});
