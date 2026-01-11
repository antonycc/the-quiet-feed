# Claude Code Memory - The Quiet Feed

## Quick Reference

**Primary documentation**: See `README.md` for project vision, `REPOSITORY_DOCUMENTATION.md` for architecture, and `_developers/STATIC_FIRST_ARCHITECTURE.md` for data flow patterns.

**Other AI assistants in this repo**:
- `.junie/guidelines.md` - Junie (testing & iteration focus)
- `.github/copilot-instructions.md` - GitHub Copilot (code review focus)

## Project Overview

The Quiet Feed is a read-only feed aggregator with Blade Runner-inspired aesthetics:
- **SCORE**: Transparent relevance scoring (0-100)
- **TRACE**: Full provenance chain
- **DEDUP**: Smart duplicate detection
- **MUTE**: Powerful filtering
- **WIRE MODE**: Headline normalization
- **SHIELD**: Dark pattern neutralization (no autoplay, explicit pagination)

### Access Tiers

| Tier | Access | Features |
|------|--------|----------|
| **ANONYMOUS** | No login | Curated public feed with SCORE visible |
| **ENHANCE** | OAuth login | Personal feeds, all features enabled |
| **HARD COPY** | Paid subscription | Unlimited platforms, export, API access |

### Feed-Based Architecture

Everything is a feed. Navigation uses query params:
- `/index.html` - Default curated feed
- `/index.html?feed=tech` - Tech feed
- `/index.html?feed=about` - About content as feed items
- `/index.html?feed=settings` - Settings/tiers as feed items

## Git Workflow

**You may**: create branches, commit changes, push branches, open pull requests

**You may NOT**: merge PRs, push to main, delete branches, rewrite history

**Branch naming**: `claude/<short-description>`

## Test Commands

Run in sequence to verify code works:
```bash
npm test                           # Unit + system tests (~4s)
./mvnw clean verify                # Java CDK build
npm run test:anonymousBehaviour-proxy  # Anonymous feed behaviour tests
```

**Running npm scripts**: You can run any script defined in package.json:
```bash
npm test                           # Run all tests
npm run test:unit                  # Run unit tests only
npm run test:system                # Run system tests only
npm run feeds:process-quick        # Process feeds (quick mode)
npm run feeds:clear                # Clear processed feeds
```

**Running individual tests with vitest**: You can run any vitest-defined test directly:
```bash
npx vitest --run app/unit-tests/scoringService.test.js
npx vitest --run app/system-tests/feedToHomePage.system.test.js
npx vitest --run web/unit-tests/someTest.test.js
```

Capture output for analysis:
```bash
npm test > target/test.txt 2>&1
./mvnw clean verify > target/mvnw.txt 2>&1
npm run test:anonymousBehaviour-proxy > target/behaviour.txt 2>&1
```

Find failures:
```bash
grep -i -n -A 20 -E 'fail|error' target/test.txt
```

**Important**: Behaviour tests generate too much output to read directly - always pipe to file.

## Local-First Development

Favor approaches that work locally AND faithfully remotely:

### Good (Local-First)
- Node.js scripts in `scripts/`
- Bash scripts for orchestration
- Docker Lambda containers (same as AWS)
- Dynalite for local DynamoDB
- Mock OAuth2 server for auth testing

### Avoid (Hard to Test Locally)
- Step Functions (use SQS + Lambda instead)
- Glue scripts (use Node.js ETL scripts)
- Complex GitHub Actions workflows

### Local Development Stack

```
Developer Machine
├── Express Server (https://local.thequietfeed.com:3443) → Lambda handlers
├── mkcert certificates (.certs/) → Browser-trusted HTTPS
├── Mock OAuth2 (localhost:8080) → Simulates Cognito
└── Dynalite (dynamic port) → Local DynamoDB
```

**Setup** (one-time):
```bash
npm run https:setup   # Install mkcert, generate certificates
# Add to /etc/hosts: 127.0.0.1 local.thequietfeed.com
```

**Start all services**: `npm start`

## Deployment & Infrastructure Workflow

**Hybrid Orchestration Approach**: You can autonomously handle the commit/push/monitor cycle for infrastructure deployments.

### Permissions
At the start of each session where deployment work is needed, request permission to:
- Use GitHub CLI (`gh`) commands for: push, workflow monitoring, and log retrieval
- Commit and push to feature branches (following Git Workflow rules above)
- Monitor GitHub Actions workflows until completion

### Deployment Cycle

When implementing features that require infrastructure validation:

1. **Local validation first**:
   ```bash
   npm test
   ./mvnw clean verify
   npm run test:anonymousBehaviour-proxy
   ```
   Ensure all tests pass locally before pushing.

2. **Commit and push**:
   ```bash
   git add [files]
   git commit -m "descriptive message"
   git push origin claude/<branch-name>
   ```
   This triggers feature branch deployment via GitHub Actions.

3. **Monitor deployment**:
   ```bash
   gh run list --branch claude/<branch-name> --limit 5
   gh run view <run-id>
   gh run watch <run-id>
   gh run view <run-id> --log
   ```

4. **Validate against AWS deployment**:
   ```bash
   npm run test:behaviour-ci
   ```

## Code Quality Rules

- **Trace code paths** before running tests - follow both test execution and AWS deployment paths
- **No unnecessary formatting** - don't reformat lines you're not changing
- **No import reordering** - considered unnecessary formatting
- **No fallback paths** for silent failures when fixing bugs
- **No compatibility adaptors** when refactoring - change names everywhere consistently
- Only run `npm run linting-fix && npm run formatting-fix` when specifically asked

## Four-Tier Testing Pyramid

| Tier | Location | Command | Focus |
|------|----------|---------|-------|
| Unit | `app/unit-tests/`, `web/unit-tests/` | `npm run test:unit` | Business logic |
| System | `app/system-tests/` | `npm run test:system` | Docker integration |
| Browser | `web/browser-tests/` | `npm run test:browser` | UI components |
| Behaviour | `behaviour-tests/` | `npm run test:anonymousBehaviour-proxy` | E2E journeys |

### Test Content Strategy

- **Sample content**: Static JSON in `app/test-data/sample-feeds/` (checked in, served via express at `/sample-feeds`)
- **Generated test content**: Created by system tests, checked in but not regenerated on every test run
- **Test reports**: Generated by Playwright, stored in `web/public/tests/`

## Environments

| Environment | File | Purpose |
|-------------|------|---------|
| test | `.env.test` | Unit/system tests (mocked) |
| proxy | `.env.proxy` | Local dev (HTTPS on local.thequietfeed.com, mock OAuth2, dynalite) |
| ci | `.env.ci` | CI with real AWS |
| prod | `.env.prod` | Production |

## Naming Conventions

- Lambda files: `{feature}{Method}.js` (e.g., `bundlePost.js`, `feedGet.js`)
- CDK stacks: `{Purpose}Stack` (e.g., `AuthStack`, `AccountStack`, `FeedStack`)
- DynamoDB tables: `{env}-quietfeed-{purpose}`
- npm scripts: colon separator for variants (e.g., `test:unit`)

## Security Checklist

- Never commit secrets - use AWS Secrets Manager ARNs
- Check IAM for least privilege (avoid `Resource: "*"`)
- Validate all user input in Lambda functions
- Verify OAuth state parameter validation
- Check JWT validation in `app/functions/auth/customAuthorizer.js`

## Key Architecture Documents

| Document | Purpose |
|----------|---------|
| `_developers/STATIC_FIRST_ARCHITECTURE.md` | Static-first data flow design |
| `AGENT_PLAN_PROTOTYPE.md` | Phase 1 prototype implementation plan |
| `AGENT_PLAN_SCALING_PHASES.md` | Multi-phase scaling strategy |

## AWS Account Topology (Planned)

- **Polycode Limited root (541134664601)**: Seeds the master account
- **The Quiet Feed master**: Controls thequietfeed.com domain and sub-accounts
- **Backup account**: Resilient backups
- **CI account**: GitHub Actions deployments
- **Prod account**: Production workloads

Authentication: OIDC trust between GitHub repo and AWS master account.
