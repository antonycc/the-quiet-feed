# THE QUIET FEED: TECHNICAL ECONOMICS & CONTENT DIVERSITY MODEL

## The Fundamental Question

> "How much unique, quality content exists in the world daily that's worth showing people, 
> and how does the cost of surfacing it scale with audience size?"

This question has both technical and philosophical dimensions. We'll address both.

---

## PART 1: THE COHORT'S PERSPECTIVE ON CONTENT DIVERSITY

*What would our imaginary advisors say about how much "signal" exists in the flood?*

### Linus Torvalds (Software, Systems Thinking)
"Most content is derivative. In any given day, there are maybe 50-100 genuinely new technical insights worth reading across all of software engineering. The rest is rehashing, marketing, or people discovering things that were solved in 1978. Your dedup should be aggressive—if you show me the same idea from 50 different LinkedIn thought leaders, you've failed. Show me the original, once."

**His estimate:** 100-500 genuinely novel technical posts/day globally worth reading

### Tim Berners-Lee (The Web, Information Architecture)  
"The web was designed for linking, not for silos. The tragedy is that most 'content' today is the same information refracted through thousands of closed platforms, each adding noise rather than signal. A well-curated feed should be *smaller* than what people expect. The value is in what you exclude."

**His estimate:** The entire day's meaningful web output could fit in a few hundred interlinked documents

### Jimmy Wales (Wikipedia, Collective Knowledge)
"Wikipedia has ~600 active editors who produce the vast majority of valuable edits. The long tail is real but thin. For any topic, there are maybe 3-5 people in the world producing primary insight; everyone else is summarizing or reacting. Your job is to find those 3-5 people per topic and surface them. The 'content' question is really a 'sources' question."

**His estimate:** ~10,000-50,000 primary sources globally producing original insight daily; everything else is derivative

### Germaine Greer (Cultural Criticism, Institutional Skepticism)
"The internet has industrialized opinion without industrializing thought. Most of what passes for content is performance—people positioning themselves rather than saying anything. Genuine insight is rare because it requires the courage to be unfashionable. Your algorithm should be biased toward the unfashionable."

**Her estimate:** Perhaps 1,000 genuinely independent voices per day saying something that hasn't been pre-approved by their imagined audience

### Betty White (Warmth, Longevity, Practical Wisdom)
"Honey, people have been sharing stories around fires for 100,000 years. The good ones get retold; the bad ones disappear. The internet just sped up the fire. Most of what's 'new' today won't matter tomorrow. Focus on what people will still want to read next week."

**Her estimate:** The truly durable content of any day could fit in a newspaper

### Margaret Atwood (Literature, Surveillance, Human Agency)
"Every platform is a panopticon now. People don't write what they think; they write what they think will be rewarded. The authentic voice—the one not performing for an algorithm—is vanishingly rare. When you find it, that's signal. Everything else is noise shaped by invisible incentives."

**Her estimate:** True signal is maybe 1% of 1% of output—the rest is algorithmic mimicry

### Jack Dorsey (Protocol Design, Minimalism)
"Chronological is underrated. When you let algorithms pick, you get homogeneity. When you show everything in order, you get serendipity. The 'how much content' question is wrong—the question is 'how do you avoid collapsing diversity into consensus?' Show less, but show different."

**His estimate:** A healthy feed should be ~50-100 items/day maximum; beyond that, you're just adding anxiety

### Jack Black & Jason Momoa (Joy, Craft, Accessibility)
"Dude, most people just want to see what their friends are up to and maybe learn one cool thing. The internet made everyone think they need to have opinions about geopolitics at breakfast. A good feed should feel like bumping into friends, not like homework."

**Their estimate:** 20-30 items that actually matter to any individual; the rest is filler

---

## SYNTHESIS: THE CONTENT DIVERSITY MODEL

### Global Daily Content Production (Estimated)
| Category | Daily Volume | After Quality Filter | After Dedup |
|----------|-------------|---------------------|-------------|
| Blog posts | 7.5M | ~75,000 (1%) | ~15,000 |
| LinkedIn posts | ~2M | ~20,000 (1%) | ~5,000 |
| Twitter/X posts | ~500M | ~500,000 (0.1%) | ~50,000 |
| News articles | ~300K | ~30,000 (10%) | ~10,000 |
| Reddit posts | ~2M | ~100,000 (5%) | ~30,000 |
| **Total** | **~512M** | **~725,000** | **~110,000** |

### The Deduplication Cliff
This is the crucial insight: **after aggressive semantic deduplication, the world produces perhaps 100,000-150,000 genuinely distinct pieces of content per day worth showing anyone.**

But it gets more concentrated:
- **Per topic cluster** (e.g., "UK Politics", "Machine Learning", "Cooking"): ~500-2,000 unique items/day
- **Per individual's interest graph**: ~200-500 relevant unique items/day
- **After quality scoring (SCORE > 60)**: ~50-150 items/day per person

### The Long Tail of Interests
Here's where it gets interesting. At small scale, everyone's feed is unique. At large scale, interests converge:

| User Pool Size | Unique Interest Combinations | Cache Hit Potential |
|----------------|------------------------------|---------------------|
| 1,000 | ~800 unique | Low (20-30%) |
| 10,000 | ~3,000 unique | Medium (40-50%) |
| 100,000 | ~10,000 unique | High (60-70%) |
| 1,000,000 | ~30,000 unique | Very High (75-85%) |
| 10,000,000 | ~50,000 unique | Excellent (85-90%) |
| 100,000,000 | ~100,000 unique | Maximum (90-95%) |

**This is the core economic insight:** Interest diversity has a ceiling. At 100M users, you're not serving 100M unique feeds—you're serving maybe 100,000 distinct interest clusters, with enormous overlap between them.

---

## PART 2: TECHNICAL COST MODEL

### Baseline Assumptions

#### AWS Pricing (2025/2026)
| Service | Cost |
|---------|------|
| Lambda invocation | $0.20/million requests |
| Lambda compute (ARM, 256MB) | $0.0000033/100ms |
| DynamoDB read | $0.25/million RCU |
| DynamoDB write | $1.25/million WCU |
| CloudFront requests | $0.0085/10K requests |
| CloudFront data transfer | $0.085/GB (first 10TB) |
| S3 storage | $0.023/GB/month |
| API Gateway (HTTP) | $1.00/million requests |

#### Claude API Pricing (Haiku 3 for scoring - cheapest option)
| Model | Input | Output |
|-------|-------|--------|
| Haiku 3 | $0.25/MTok | $1.25/MTok |
| Haiku 3.5 | $0.80/MTok | $4.00/MTok |
| Sonnet 4.5 | $3.00/MTok | $15.00/MTok |

#### Embedding Model (Self-hosted or API)
- all-MiniLM-L6-v2: Free (self-hosted on Lambda)
- ~10ms per embedding, ~384 dimensions
- Alternative: Voyage AI at ~$0.10/MTok

### Per-Item Processing Cost (First View)

For each unique content item we've never seen:

| Operation | Tokens/Compute | Cost |
|-----------|----------------|------|
| Fetch content | 1 Lambda (200ms) | $0.0000007 |
| Generate embedding | 1 Lambda (50ms) | $0.0000002 |
| Quality score (Haiku 3) | ~500 input + ~100 output tokens | $0.000125 + $0.000125 = **$0.00025** |
| Store score in DynamoDB | 1 WCU | $0.00000125 |
| Store embedding (if needed) | 1 WCU | $0.00000125 |
| **Total per new item** | | **~$0.00026** |

**Key insight:** LLM scoring dominates cost at ~96% of per-item processing.

### Per-View Cost (Cached)

For subsequent views of already-scored content:

| Operation | Cost |
|-----------|------|
| CloudFront cache hit | $0.00000085 |
| DynamoDB read (if cache miss) | $0.00000025 |
| Lambda to assemble feed | $0.0000003 |
| **Total per cached view** | **~$0.000001** |

**The ratio:** First view costs ~260x more than subsequent views. This is why caching is everything.

---

## PART 3: SCENARIO MODELING

### Scenario 0: Zero Users (Baseline Infrastructure)
Just keeping the lights on with no traffic.

| Component | Monthly Cost |
|-----------|-------------|
| Route 53 (DNS) | $0.50 |
| CloudFront distribution (idle) | $0.00 |
| DynamoDB (on-demand, idle) | $0.00 |
| Lambda (idle) | $0.00 |
| S3 (10GB baseline) | $0.23 |
| ACM certificates | $0.00 |
| **Total** | **~$1/month** |

---

### Scenario 1: Early Prototype
**100 ENHANCE users (sporadic, then abandoning) + 100,000 ANONYMOUS users (sporadic, some bots)**

#### User Behavior Assumptions
- ENHANCE users: 10 sessions total before abandoning, 20 items/session = 200 views each
- ANONYMOUS users: 2 sessions/month average, 15 items/session = 30 views each
- Bot traffic: 10% of anonymous requests, filtered at CDN (cost but no scoring)

#### Content Requirements
- Curated public feed (ANONYMOUS): ~1,000 items/day refreshed
- ENHANCE users pulling LinkedIn: ~50 unique items/user = 5,000 items total
- Overlap assumption: 60% of LinkedIn items overlap between users

#### Calculations

**Unique items to score:**
- Curated feed: 1,000 items/day × 30 days = 30,000 items
- LinkedIn (100 users, 60% overlap): 5,000 × 0.4 = 2,000 unique items
- **Total unique items:** ~32,000

**Scoring cost:**
- 32,000 items × $0.00026 = **$8.32/month**

**View costs:**
- ENHANCE: 100 users × 200 views = 20,000 views
- ANONYMOUS: 100,000 users × 30 views = 3,000,000 views
- Bot traffic (filtered but costed): 300,000 requests
- **Total requests:** ~3,320,000

**CDN + API costs:**
- CloudFront: 3.32M × $0.00000085 = $2.82
- API Gateway: 3.32M × $0.000001 = $3.32
- Lambda assembly: 3.32M × $0.0000003 = $1.00
- DynamoDB reads: 1M (cache misses) × $0.00000025 = $0.25

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring (Haiku 3) | $8.32 |
| CloudFront | $2.82 |
| API Gateway | $3.32 |
| Lambda | $1.50 |
| DynamoDB | $2.00 |
| S3 | $0.50 |
| **Total** | **~$19/month** |

**Note on bots:** We're not fighting them, but the CDN layer returns cached data. They cost us almost nothing per request. The "tar pit" mentioned would be: if a single IP exceeds 1000 requests/hour, we start adding 100ms delays, doubling every 100 requests. Not hostile, just "you're being greedy, here's friction."

---

### Scenario 2: 1,000 Daily Active Users (2hr/day)
**Ratio: 70% ANONYMOUS, 30% ENHANCE**

#### Assumptions
- 700 ANONYMOUS, 300 ENHANCE
- 2 hours/day = ~120 items viewed/day (1 item per minute average)
- Days active: 25/month
- Items per user per month: 3,000

#### Content Pool
- Interest clusters at 1,000 users: ~500 unique
- Items per cluster per day: ~200
- Total unique items/month: 500 × 200 × 30 = 3,000,000
- But! Overlap across clusters: ~70%
- **Unique items to score:** ~900,000/month

#### Calculations

**Scoring:**
- 900,000 × $0.00026 = **$234/month**

**Views:**
- 1,000 users × 3,000 views = 3,000,000 views/month
- Cache hit rate at this scale: ~50%
- Cache misses needing DynamoDB: 1,500,000

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring | $234 |
| CloudFront | $2.55 |
| API Gateway | $3.00 |
| Lambda | $15.00 |
| DynamoDB | $10.00 |
| S3 | $5.00 |
| **Total** | **~$270/month** |
| **Per user** | **$0.27/user/month** |

---

### Scenario 3: 10,000 Daily Active Users

**Ratio: 60% ANONYMOUS, 40% ENHANCE**

#### Content Pool
- Interest clusters: ~3,000
- Unique items/month: ~2,500,000
- Cache hit rate: ~65%

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring | $650 |
| CloudFront | $25 |
| API Gateway | $30 |
| Lambda | $100 |
| DynamoDB | $75 |
| S3 | $25 |
| **Total** | **~$905/month** |
| **Per user** | **$0.09/user/month** |

---

### Scenario 4: 100,000 Daily Active Users

**Ratio: 50% ANONYMOUS, 50% ENHANCE**

#### Content Pool
- Interest clusters: ~10,000
- Unique items/month: ~5,000,000
- Cache hit rate: ~75%

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring | $1,300 |
| CloudFront | $250 |
| API Gateway | $300 |
| Lambda | $500 |
| DynamoDB | $400 |
| S3 | $100 |
| Reserved capacity discounts | -20% |
| **Total** | **~$2,280/month** |
| **Per user** | **$0.023/user/month** |

---

### Scenario 5: 1,000,000 Daily Active Users

**Ratio: 45% ANONYMOUS, 55% ENHANCE**

This is where economies of scale really kick in.

#### Content Pool
- Interest clusters: ~30,000
- Unique items/month: ~8,000,000 (diminishing returns on novelty)
- Cache hit rate: ~85%

#### The Content Ceiling Effect
At 1M users, we're hitting the ceiling of how much unique content exists. The marginal user adds almost no new content to score—they're consuming from the same ~100K daily items as everyone else.

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring | $2,100 |
| CloudFront | $2,500 |
| API Gateway | $3,000 |
| Lambda | $4,000 |
| DynamoDB | $3,000 |
| S3 | $500 |
| Reserved/committed discounts | -30% |
| **Total** | **~$10,570/month** |
| **Per user** | **$0.011/user/month** |

---

### Scenario 6: 10,000,000 Daily Active Users

**Ratio: 40% ANONYMOUS, 60% ENHANCE**

#### Content Pool
- Interest clusters: ~50,000 (near ceiling)
- Unique items/month: ~10,000,000 (hard ceiling)
- Cache hit rate: ~90%

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring | $2,600 |
| CloudFront | $20,000 |
| API Gateway | $25,000 |
| Lambda | $30,000 |
| DynamoDB | $20,000 |
| S3 | $2,000 |
| Enterprise discounts | -40% |
| **Total** | **~$59,760/month** |
| **Per user** | **$0.006/user/month** |

---

### Scenario 7: 100,000,000 Daily Active Users

**Ratio: 35% ANONYMOUS, 65% ENHANCE**

At this scale, we're essentially a utility.

#### Content Pool
- Interest clusters: ~100,000 (absolute ceiling)
- Unique items/month: ~12,000,000 (global novelty limit)
- Cache hit rate: ~95%

The fascinating thing: **scoring costs barely increase from 10M to 100M users.** The content that exists is the content that exists. More users just means more cache hits.

| Component | Monthly Cost |
|-----------|-------------|
| LLM Scoring | $3,120 |
| CloudFront | $150,000 |
| API Gateway | $200,000 |
| Lambda | $250,000 |
| DynamoDB | $150,000 |
| S3 | $15,000 |
| Enterprise/negotiated | -50% |
| **Total** | **~$384,060/month** |
| **Per user** | **$0.004/user/month** |

---

## PART 4: SUMMARY TABLE

| Scale | Users | Monthly Cost | Per User | Scoring % | Cache Hit % |
|-------|-------|-------------|----------|-----------|-------------|
| Prototype | 100K sporadic | $19 | N/A | 44% | 20% |
| Small | 1,000 | $270 | $0.27 | 87% | 50% |
| Growing | 10,000 | $905 | $0.09 | 72% | 65% |
| Medium | 100,000 | $2,280 | $0.023 | 57% | 75% |
| Large | 1,000,000 | $10,570 | $0.011 | 20% | 85% |
| Very Large | 10,000,000 | $59,760 | $0.006 | 4% | 90% |
| Massive | 100,000,000 | $384,060 | $0.004 | 0.8% | 95% |

---

## PART 4B: REVENUE REQUIREMENTS FOR 10% MARGIN

Assuming:
- HARD COPY at £50/month (first month free, so effective £45.83/month amortized)
- ENHANCE/ANONYMOUS ratio as per scenario estimates
- "10% margin" means revenue = cost × 1.11 (cost + 10% of revenue)

| Scale | Monthly Cost | Revenue for 10% Margin | HARD COPY @ 2% Conv. | Revenue per HARD COPY | Revenue per All Users |
|-------|-------------|------------------------|----------------------|----------------------|----------------------|
| **1,000** | £270 | £300 | 6 | £50.00 | £0.30 |
| **10,000** | £905 | £1,006 | 80 | £12.58 | £0.10 |
| **100,000** | £2,280 | £2,533 | 1,000 | £2.53 | £0.025 |
| **1,000,000** | £10,570 | £11,744 | 11,000 | £1.07 | £0.012 |
| **10,000,000** | £59,760 | £66,400 | 120,000 | £0.55 | £0.007 |
| **100,000,000** | £384,060 | £426,733 | 1,300,000 | £0.33 | £0.004 |

### Reading the Table

**Revenue for 10% Margin:** This is the total monthly revenue needed to cover costs and have 10% left over as profit. Formula: `cost / 0.9`

**HARD COPY @ 2% Conv.:** Number of paying subscribers if 2% of ENHANCE users convert. Based on ENHANCE being ~30-65% of total users depending on scale.

**Revenue per HARD COPY:** What each HARD COPY subscriber would need to pay monthly to hit the 10% margin target. At £50/month actual price:
- At 1,000 users: Need £50, we charge £50 → **breakeven**
- At 10,000 users: Need £12.58, we charge £50 → **£37.42 surplus per subscriber**
- At 1M users: Need £1.07, we charge £50 → **£48.93 surplus per subscriber**

**Revenue per All Users:** If we spread the revenue requirement across ALL users (ANONYMOUS + ENHANCE + HARD COPY), this is what each would need to contribute. This represents the "advertising value" floor if we ever went that route (we won't).

### The Insight

At **10,000 users**, the required revenue per HARD COPY subscriber (£12.58) is well below our £50 price point. This means:

1. **We have pricing headroom.** We could charge £15/month for HARD COPY and still hit 10% margin at 10K+ users.
2. **Or we subsidize growth.** Keep price at £50, use surplus to fund free tiers longer.
3. **The £0.10/user "ad value"** at 10K users is so low that advertising would never make sense. Privacy-first is economically rational, not just ethical.

### Break-Even Points

| Metric | Users Required |
|--------|---------------|
| Break-even (costs covered) | ~180 HARD COPY subscribers |
| 10% margin | ~200 HARD COPY subscribers |
| At 2% conversion rate | ~10,000 total users |
| At 1% conversion rate | ~20,000 total users |

### What If HARD COPY Were Cheaper?

| HARD COPY Price | Users Needed for 10% Margin (2% conv) |
|-----------------|---------------------------------------|
| £50/month | 10,000 |
| £25/month | 20,000 |
| £15/month | 33,000 |
| £10/month | 50,000 |
| £5/month | 100,000 |

Even at £5/month, we'd only need 100,000 users to be sustainably profitable. That's "small indie app" territory, not "venture scale or die."

## PART 4C: THE $100 CLUB & SELF-SUSTAINING MODEL

### The Model

```
Phase 1: THE $100 CLUB
├─ Founders pay $100/month
├─ Funds the build at HIGH margin
└─ Continues until WAR CHEST TRIGGER

WAR CHEST TRIGGER:
├─ When: 1 month's PROFIT ≥ 24 months of COSTS
├─ Founders go FREE (lifetime HARD COPY)
└─ Price floats DOWN to 10% margin

Phase 2: THE QUIET MACHINE  
├─ 10% margin forever
├─ Price floats DOWN as scale increases
└─ Proportional, not extractive
```

### The War Chest Trigger Math

**Trigger:** `monthly_profit >= monthly_costs × 24`

This is a HIGH bar. In a single month, your profit must cover 2 years of runway.

**When does it fire?** When revenue is ~25× costs (i.e., ~96% margin).

With uncapped $100 Club membership at 2% conversion:

| Scale | Monthly Cost | 24× Costs (Trigger) | $100 Club Members (2%) | Revenue | Profit | Trigger? |
|-------|-------------|---------------------|------------------------|---------|--------|----------|
| 5,000 | £600 | £14,400 | 100 | £8,000 | £7,400 | ✗ |
| 10,000 | £905 | £21,720 | 200 | £16,000 | £15,095 | ✗ |
| 15,000 | £1,200 | £28,800 | 300 | £24,000 | £22,800 | ✗ |
| 20,000 | £1,400 | £33,600 | 400 | £32,000 | £30,600 | ✗ |
| **25,000** | £1,500 | £36,000 | 500 | £40,000 | **£38,500** | **YES** |

**Trigger fires at ~25,000 users with ~500 $100 Club members**

At that moment:
- You bank £38,500 (the war chest)
- All 500 founders go FREE forever
- Price drops to 10% margin

### Post-Trigger: 10% Margin Forever (with $2 floor)

Price = `max($2, (monthly_cost / 0.9) / paying_subscribers)`

The price floats down with scale, but never below **$2/month** (~£1.60). Below that, you're just accumulating extra margin rather than passing savings to users - use it for the war chest, projects fund, or rainy days.

| Scale | Monthly Cost | 10% Margin Price | Floored Price | Actual Margin | Monthly Profit |
|-------|-------------|------------------|---------------|---------------|---------------:|
| 25,000 | £1,500 | £3.33 | **£3.33** | 10% | £167 |
| 50,000 | £1,900 | £2.11 | **£2.11** | 10% | £211 |
| 100,000 | £2,280 | £1.27 | **£1.60** | 30% | £940 |
| 500,000 | £5,000 | £0.56 | **£1.60** | 69% | £11,000 |
| 1,000,000 | £10,570 | £0.59 | **£1.60** | 67% | £21,430 |
| 10,000,000 | £59,760 | £0.33 | **£1.60** | 81% | £260,240 |
| 100,000,000 | £384,060 | £0.21 | **£1.60** | 89% | £2,815,940 |

**The $2 floor changes everything at scale.**

At 10M users, instead of £6,640/month profit, you're making £260K/month. At 100M, nearly £3M/month.

This isn't greed - it's recognition that:
1. $2/month is already incredibly cheap
2. Below $2, the price becomes meaningless (less than a coffee)
3. The surplus funds resilience, experiments, and independence

### What 10% Margin (with $2 floor) Means Over Time

| Scale | Price | Monthly Profit | Annual Profit |
|-------|-------|---------------|---------------|
| 25,000 | £3.33 | £167 | £2,000 |
| 50,000 | £2.11 | £211 | £2,533 |
| 100,000 | £1.60 | £940 | £11,280 |
| 1,000,000 | £1.60 | £21,430 | £257,160 |
| 10,000,000 | £1.60 | £260,240 | £3,122,880 |
| 100,000,000 | £1.60 | £2,815,940 | £33,791,280 |

**The $2 floor creates a sustainability flywheel:**
- Small scale: 10% margin, scrappy, honest
- Medium scale: Price hits floor, margin grows, war chest builds
- Large scale: Significant surplus funds independence, experiments, resilience

At 100M users making £34M/year - that's "never be acquired, never compromise, fund ten more quiet projects" money. Still only $2/month to users. Still no ads. Still no data selling.

### The $100 Club - Final

```
THE $100 CLUB

$100/month while we build.

You get:
├─ Full HARD COPY access from day one
├─ Lifetime FREE when trigger fires
│   (1 month's profit ≥ 24 months of costs)
├─ Founding member status forever
└─ No ads, ever

No cap on members.
More founders = faster trigger = everyone wins.
Everyone who joins before trigger gets lifetime free.
```

### The Four Numbers

1. **$100/month** - Founder price during build
2. **24× costs** - War chest trigger (1 month profit = 2 years runway)  
3. **10% margin** - Post-trigger, floating down with scale
4. **$2/month floor** - Price never drops below this; surplus builds resilience

---
## PART 5: KEY INSIGHTS

### 1. The Content Ceiling
The world produces ~100,000-150,000 genuinely unique, quality items per day. Beyond ~1M users, you're not scaling content—you're scaling distribution. This is why per-user costs drop so dramatically.

### 2. Scoring is the Bottleneck (Until It Isn't)
At small scale, LLM scoring is 70-90% of costs. At massive scale, it's <1%. The inflection point is around 100K-1M users.

### 3. CDN Economics Win
At scale, the question becomes "how cheaply can you serve static JSON from a CDN?" Answer: very cheaply. CloudFront at $0.0085/10K requests is the real cost floor.

### 4. The ENHANCE/ANONYMOUS Ratio Matters Less Than Expected
Because ENHANCE users pull from the same content pools (LinkedIn, Twitter, etc.), their marginal scoring cost over ANONYMOUS is modest. The OAuth token storage and per-user state is the real differentiator.

### 5. Bot Traffic is Nearly Free
If bots hit cached CDN responses, they cost us ~$0.001/1000 requests. The "tar pit" approach (progressive delays) is about fairness signaling, not cost control. We're essentially saying: "You can have this data, but be polite about it."

---

## PART 6: WHAT THE COHORT WOULD SAY ABOUT THESE ECONOMICS

**Linus:** "So basically, the marginal cost of serving users approaches the cost of bandwidth, which approaches zero. Good. That's how infrastructure should work."

**Tim Berners-Lee:** "The interesting number is that 100,000 unique items per day. That's the real 'web' underneath all the duplication. You're essentially rebuilding what the web was supposed to be."

**Jimmy Wales:** "Wikipedia serves 20 billion page views per month on ~$3M/year budget. Your numbers are in the same ballpark at scale. That's sustainable without ads."

**Germaine Greer:** "The fact that 100 million people would be consuming from the same 100,000 items should terrify us about monoculture, but at least you're not amplifying the worst of it."

**Betty White:** "Honey, $0.004 per person per month? That's less than a stamp. If people won't pay a nickel for quality, we've got bigger problems than technology."

**Margaret Atwood:** "The scoring costs drop because the surveillance apparatus is already built. You're just adding a quality filter to the panopticon. At least you're filtering *for* the user, not against them."

**Jack Dorsey:** "Process once, serve many. That's protocol thinking. This should be an open standard, not a product."

**Jack Black:** "Wait, so at 100 million users, scoring costs $3,000/month? That's like... one night at a decent hotel. The robots are cheap!"

**Jason Momoa:** "Bro, you could fund this by selling t-shirts."

---

## APPENDIX: REVENUE MODEL AT EACH SCALE

If HARD COPY is £50/month with first month free, and 2% of ENHANCE converts:

| Scale | ENHANCE Users | Conversions (2%) | Monthly Revenue | Net (Revenue - Cost) |
|-------|---------------|------------------|-----------------|---------------------|
| 1,000 | 300 | 6 | £300 | +£30 |
| 10,000 | 4,000 | 80 | £4,000 | +£3,095 |
| 100,000 | 50,000 | 1,000 | £50,000 | +£47,720 |
| 1,000,000 | 550,000 | 11,000 | £550,000 | +£539,430 |
| 10,000,000 | 6,000,000 | 120,000 | £6,000,000 | +£5,940,240 |
| 100,000,000 | 65,000,000 | 1,300,000 | £65,000,000 | +£64,615,940 |

**Break-even point:** ~200 HARD COPY subscribers, which requires ~10,000 ENHANCE users at 2% conversion.

This is achievable. This is sustainable. This is not venture-scale growth, and that's the point.

---

*"All those moments will be lost in time, like tears in rain."*

*Unlike Roy's memories, the economics of serving quality content at scale are surprisingly gentle. The hard part was never the technology—it was deciding what's worth showing.*

**The Quiet Feed. Enhance. Stop.**
