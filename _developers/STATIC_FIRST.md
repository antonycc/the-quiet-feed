Now let me look at the existing frontend structure to understand the web component patterns:Now I have a good understanding. Let me design the complete static-first architecture:I'll create a comprehensive design document as a markdown file since that's more appropriate for a technical architecture document that can be version-controlled in the repository:I've designed a comprehensive static-first architecture that aligns with your preferences and the economics model. Here are the key design decisions:

**Core Pattern: "Process Once, Publish Static, Fetch Live"**

The architecture has three distinct data layers:

1. **Content Layer** (public, cached forever) - Our derivative works: scores, clusters, topic manifests. These are stored in S3 and served via CloudFront with aggressive caching.

2. **User Layer** (private, per-user) - Settings, mutes, subscriptions, and pre-computed feed indexes. Written to S3 on every state change, read directly by the browser.

3. **DynamoDB** (source of truth) - Remains authoritative for user state, but acts as write-through to S3 static files. The API only handles writes; all reads are static.

**Key Design Choices:**

- **Browser fetches actual content from source** using the user's OAuth token stored in localStorage - we never proxy or store the content itself
- **Static JSON files** for all read operations - feed indexes, scores, settings
- **APIs exist only for writes** - settings updates, mute rules, subscription changes trigger async regeneration of static files
- **Token security** - OAuth tokens encrypted server-side, only short-lived access tokens exposed to browser for source API calls
- **CloudFront multi-origin** - Different behaviors for `/content/*`, `/users/*`, `/public/*`, and `/api/*`

**The economics work because:**
- Scoring cost is one-time per content item (~$0.00026)
- Serving static JSON from CDN is ~$0.00001/request
- Content ceiling means scoring costs flatten at scale
- User feed regeneration is async (SQS + Lambda)

The document includes DynamoDB schemas, CDK infrastructure changes, browser-side JavaScript for feed loading, and a migration path. Would you like me to elaborate on any specific component?
