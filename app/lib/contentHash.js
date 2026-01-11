// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * Content hashing utilities for The Quiet Feed
 *
 * Content hashes are used for:
 * - Deduplication across reshares
 * - Score caching (same content = same score)
 * - Cluster identification
 */

import { createHash } from "crypto";

/**
 * Compute a content hash for a feed item.
 * The hash is based on URL and normalized title to detect duplicates
 * across reshares (different authors, different timestamps).
 *
 * @param {Object} item - Feed item
 * @param {string} item.url - Item URL
 * @param {string} [item.title] - Item title
 * @returns {string} 16-character hex hash
 */
export const computeContentHash = (item) => {
  if (!item || !item.url) {
    throw new Error("Item must have a url property");
  }

  const normalized = JSON.stringify({
    url: normalizeUrl(item.url),
    title: normalizeTitle(item.title),
  });

  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
};

/**
 * Compute a full content hash including content body.
 * Used for exact duplicate detection.
 *
 * @param {Object} item - Feed item with content
 * @param {string} item.url - Item URL
 * @param {string} [item.title] - Item title
 * @param {string} [item.content] - Item content/excerpt
 * @returns {string} 32-character hex hash
 */
export const computeFullContentHash = (item) => {
  if (!item || !item.url) {
    throw new Error("Item must have a url property");
  }

  const normalized = JSON.stringify({
    url: normalizeUrl(item.url),
    title: normalizeTitle(item.title),
    content: normalizeContent(item.content),
  });

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
};

/**
 * Normalize a URL for consistent hashing.
 * Removes tracking parameters, normalizes protocol.
 *
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export const normalizeUrl = (url) => {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    // Remove common tracking parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
    ];

    trackingParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    // Normalize to https
    parsed.protocol = "https:";

    // Remove trailing slash from path
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");

    // Remove www prefix
    parsed.hostname = parsed.hostname.replace(/^www\./, "");

    return parsed.toString().toLowerCase();
  } catch {
    // If URL parsing fails, just lowercase and trim
    return url.toLowerCase().trim();
  }
};

/**
 * Normalize a title for consistent hashing.
 * Removes case differences, extra whitespace, common prefixes.
 *
 * @param {string} title - Title to normalize
 * @returns {string} Normalized title
 */
export const normalizeTitle = (title) => {
  if (!title) return "";

  return (
    title
      .toLowerCase()
      .trim()
      // Remove multiple spaces
      .replace(/\s+/g, " ")
      // Remove common prefixes
      .replace(/^(breaking|update|developing|exclusive|opinion):\s*/i, "")
      // Remove emojis (common in social media)
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
      // Remove leading/trailing punctuation
      .replace(/^[^\w]+|[^\w]+$/g, "")
  );
};

/**
 * Normalize content for hashing.
 *
 * @param {string} content - Content to normalize
 * @returns {string} Normalized content
 */
export const normalizeContent = (content) => {
  if (!content) return "";

  return (
    content
      .toLowerCase()
      .trim()
      // Remove multiple spaces and newlines
      .replace(/\s+/g, " ")
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Truncate to first 500 chars for hashing
      .slice(0, 500)
  );
};

/**
 * Check if two items are likely duplicates based on their hashes.
 *
 * @param {Object} item1 - First item
 * @param {Object} item2 - Second item
 * @returns {boolean} True if items appear to be duplicates
 */
export const isDuplicate = (item1, item2) => {
  return computeContentHash(item1) === computeContentHash(item2);
};

export default {
  computeContentHash,
  computeFullContentHash,
  normalizeUrl,
  normalizeTitle,
  normalizeContent,
  isDuplicate,
};
