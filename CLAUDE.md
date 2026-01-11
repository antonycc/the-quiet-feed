# Claude Code Memory - The Quiet Feed

## Quick Reference

**Primary documentation**: See `README.md` for project vision and architecture.

**Other AI assistants in this repo**:
- `.junie/guidelines.md` - Junie (testing & iteration focus)
- `.github/copilot-instructions.md` - GitHub Copilot (code review focus)

## Git Workflow

**You may**: create branches, commit changes, push branches, open pull requests

**You may NOT**: merge PRs, push to main, delete branches, rewrite history

**Branch naming**: `claude/<short-description>`

## Test Commands

Run in sequence to verify code works:
```bash
npm test                       # Unit + system tests (~4s)
./mvnw clean verify            # Java CDK build
npm run test:behaviour-proxy   # E2E behaviour tests
```

Capture output for analysis:
```bash
npm test > target/test.txt 2>&1
./mvnw clean verify > target/mvnw.txt 2>&1
npm run test:behaviour-proxy > target/behaviour.txt 2>&1
```

Find failures:
```bash
grep -i -n -A 20 -E 'fail|error' target/test.txt
```

**Important**: Behaviour tests generate too much output to read directly - always pipe to file.

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
   npm run test:behaviour-proxy
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
   # Watch workflow status
   gh run list --branch claude/<branch-name> --limit 5

   # Get specific workflow run details
   gh run view <run-id>

   # Stream logs for active run
   gh run watch <run-id>

   # Download logs for completed run if needed
   gh run view <run-id> --log
   ```

   **Wait for deployment completion**: Poll every 30-60 seconds until workflow completes.

   **Interpret failures**: Analyze GitHub Actions logs for:
   - CloudFormation stack errors (stuck/failed states)
   - Lambda deployment issues
   - Resource creation timeouts
   - IAM permission problems

   If deployment fails, diagnose from logs and iterate back to step 1.

4. **Validate against AWS deployment**:
   ```bash
   # Run Playwright tests against deployed environment
   npm run test:behaviour-ci
   ```

   If tests fail against AWS but passed locally, investigate environment-specific issues:
   - Check AWS-specific configuration in GitHub Actions logs
   - Compare `.env.proxy` vs `.env.ci` settings
   - Look for infrastructure state issues in deployment logs

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
| Behaviour | `behaviour-tests/` | `npm run test:behaviour-proxy` | E2E journeys |

## Environments

| Environment | File | Purpose |
|-------------|------|---------|
| test | `.env.test` | Unit/system tests (mocked) |
| proxy | `.env.proxy` | Local dev (ngrok, Docker OAuth2, dynalite) |
| ci | `.env.ci` | CI with real AWS |
| prod | `.env.prod` | Production |

## Naming Conventions

- Lambda files: `{feature}{Method}.js` (e.g., `bundlePost.js`)
- CDK stacks: `{Purpose}Stack` (e.g., `AuthStack`, `AccountStack`)
- DynamoDB tables: `{env}-quietfeed-{purpose}`
- npm scripts: colon separator for variants (e.g., `test:unit`)

## Security Checklist

- Never commit secrets - use AWS Secrets Manager ARNs
- Check IAM for least privilege (avoid `Resource: "*"`)
- Validate all user input in Lambda functions
- Verify OAuth state parameter validation
- Check JWT validation in `app/functions/auth/customAuthorizer.js`

## Project Overview

The Quiet Feed is a read-only feed aggregator with Blade Runner-inspired aesthetics:
- **SCORE**: Transparent relevance scoring
- **TRACE**: Full provenance chain
- **DEDUP**: Smart duplicate detection
- **MUTE**: Powerful filtering

## AWS Account Topology (Planned)

- **Polycode Limited root (541134664601)**: Seeds the master account
- **The Quiet Feed master**: Controls thequietfeed.com domain and sub-accounts
- **Backup account**: Resilient backups
- **CI account**: GitHub Actions deployments
- **Prod account**: Production workloads

Authentication: OIDC trust between GitHub repo and AWS master account.
