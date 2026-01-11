// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 Antony Cartwright

/**
 * RSS Feed Service for The Quiet Feed
 *
 * Fetches and parses RSS/Atom feeds from configured sources.
 */

import { createLogger } from "../lib/logger.js";
import { computeContentHash } from "../lib/contentHash.js";

const logger = createLogger({ source: "rssFeedService" });

/**
 * Fetch raw XML from an RSS/Atom feed URL.
 *
 * @param {string} url - Feed URL
 * @param {Object} [options] - Fetch options
 * @param {number} [options.timeout=10000] - Request timeout in ms
 * @returns {Promise<string>} Raw XML content
 */
export const fetchFeedXml = async (url, options = {}) => {
  const timeout = options.timeout || 10000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TheQuietFeed/1.0 (https://thequietfeed.com)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Parse RSS 2.0 feed XML into items.
 *
 * @param {string} xml - RSS XML content
 * @returns {Array<Object>} Parsed items
 */
export const parseRssItems = (xml) => {
  const items = [];

  // Extract channel info
  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/);
  const channelTitle = channelTitleMatch ? decodeEntities(channelTitleMatch[1].trim()) : "";

  // Extract all items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link") || extractGuidLink(itemXml);
    const description = extractTag(itemXml, "description");
    const pubDate = extractTag(itemXml, "pubDate");
    const guid = extractTag(itemXml, "guid");
    const author = extractTag(itemXml, "author") || extractTag(itemXml, "dc:creator");
    const category = extractTag(itemXml, "category");

    if (title || link) {
      items.push({
        title: decodeEntities(title),
        url: link,
        excerpt: cleanHtml(decodeEntities(description)),
        publishedAt: parseDate(pubDate),
        guid,
        author: decodeEntities(author),
        category: decodeEntities(category),
        source: channelTitle,
      });
    }
  }

  return items;
};

/**
 * Parse Atom feed XML into items.
 *
 * @param {string} xml - Atom XML content
 * @returns {Array<Object>} Parsed items
 */
export const parseAtomItems = (xml) => {
  const items = [];

  // Extract feed title
  const feedTitleMatch = xml.match(/<feed[\s\S]*?<title[^>]*>([^<]+)<\/title>/);
  const feedTitle = feedTitleMatch ? decodeEntities(feedTitleMatch[1].trim()) : "";

  // Extract all entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const title = extractTag(entryXml, "title");
    const link = extractAtomLink(entryXml);
    const summary = extractTag(entryXml, "summary") || extractTag(entryXml, "content");
    const updated = extractTag(entryXml, "updated") || extractTag(entryXml, "published");
    const id = extractTag(entryXml, "id");
    const author = extractAtomAuthor(entryXml);
    const category = extractAtomCategory(entryXml);

    if (title || link) {
      items.push({
        title: decodeEntities(title),
        url: link,
        excerpt: cleanHtml(decodeEntities(summary)),
        publishedAt: parseDate(updated),
        guid: id,
        author: decodeEntities(author),
        category: decodeEntities(category),
        source: feedTitle,
      });
    }
  }

  return items;
};

/**
 * Auto-detect feed format and parse accordingly.
 *
 * @param {string} xml - Feed XML content
 * @returns {Array<Object>} Parsed items
 */
export const parseFeed = (xml) => {
  // Detect feed format
  if (xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")) {
    return parseAtomItems(xml);
  }
  if (xml.includes("<rss") || xml.includes("<channel>")) {
    return parseRssItems(xml);
  }

  // Try RSS first, then Atom
  const rssItems = parseRssItems(xml);
  if (rssItems.length > 0) {
    return rssItems;
  }

  return parseAtomItems(xml);
};

/**
 * Fetch and parse a feed from URL.
 *
 * @param {string} url - Feed URL
 * @param {Object} [options] - Options
 * @returns {Promise<Array<Object>>} Parsed items with hashes
 */
export const fetchAndParseFeed = async (url, options = {}) => {
  const xml = await fetchFeedXml(url, options);
  const items = parseFeed(xml);

  // Add content hashes
  return items.map((item) => ({
    ...item,
    hash: computeContentHash(item),
    fetchedAt: new Date().toISOString(),
    feedUrl: url,
  }));
};

/**
 * Fetch multiple feeds in parallel.
 *
 * @param {Array<Object>} sources - Feed sources
 * @returns {Promise<Object>} Results keyed by source ID
 */
export const fetchMultipleFeeds = async (sources) => {
  const results = {};

  await Promise.all(
    sources.map(async (source) => {
      try {
        const items = await fetchAndParseFeed(source.url);
        results[source.id] = {
          success: true,
          items,
          fetchedAt: new Date().toISOString(),
        };
        logger.info({ message: "Feed fetched", sourceId: source.id, itemCount: items.length });
      } catch (error) {
        results[source.id] = {
          success: false,
          error: error.message,
          fetchedAt: new Date().toISOString(),
        };
        logger.warn({ message: "Feed fetch failed", sourceId: source.id, error: error.message });
      }
    }),
  );

  return results;
};

// Helper functions

/**
 * Extract content between XML tags.
 */
const extractTag = (xml, tag) => {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // Regular tag content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
};

/**
 * Extract link from guid if it's a permalink.
 */
const extractGuidLink = (xml) => {
  const guidMatch = xml.match(/<guid[^>]*isPermaLink\s*=\s*["']true["'][^>]*>([^<]+)<\/guid>/i);
  if (guidMatch) {
    return guidMatch[1].trim();
  }

  // Sometimes guid is just a URL without isPermaLink attribute
  const simpleGuid = extractTag(xml, "guid");
  if (simpleGuid && simpleGuid.startsWith("http")) {
    return simpleGuid;
  }

  return "";
};

/**
 * Extract link from Atom entry.
 */
const extractAtomLink = (xml) => {
  // Prefer alternate link
  const alternateMatch = xml.match(/<link[^>]*rel\s*=\s*["']alternate["'][^>]*href\s*=\s*["']([^"']+)["']/i);
  if (alternateMatch) {
    return alternateMatch[1];
  }

  // Any link with href
  const hrefMatch = xml.match(/<link[^>]*href\s*=\s*["']([^"']+)["']/i);
  return hrefMatch ? hrefMatch[1] : "";
};

/**
 * Extract author from Atom entry.
 */
const extractAtomAuthor = (xml) => {
  const authorMatch = xml.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/i);
  return authorMatch ? authorMatch[1].trim() : "";
};

/**
 * Extract category from Atom entry.
 */
const extractAtomCategory = (xml) => {
  const categoryMatch = xml.match(/<category[^>]*term\s*=\s*["']([^"']+)["']/i);
  return categoryMatch ? categoryMatch[1] : "";
};

/**
 * Decode HTML entities.
 */
const decodeEntities = (str) => {
  if (!str) return "";

  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
};

/**
 * Clean HTML from string.
 */
const cleanHtml = (str) => {
  if (!str) return "";

  return (
    str
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
      // Truncate to reasonable length
      .slice(0, 500)
  );
};

/**
 * Parse various date formats.
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch {
    return null;
  }
};

export default {
  fetchFeedXml,
  parseRssItems,
  parseAtomItems,
  parseFeed,
  fetchAndParseFeed,
  fetchMultipleFeeds,
};
