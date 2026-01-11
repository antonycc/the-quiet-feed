Instructions for Junie to follow:

**Last Updated:** 2026-01-11

## About This File

This file contains guidelines for **Junie** (custom agent). The repository also has guidelines for other AI coding assistants:
- `CLAUDE.md` + `.claude/rules/` - Guidelines for Claude Code (emphasis on autonomous task execution & implementation)
- `.github/copilot-instructions.md` - Guidelines for GitHub Copilot (emphasis on code review & analysis)

Each assistant has complementary strengths - Junie is optimized for continuous testing, iteration, and rapid development cycles.

## Project Overview

**The Quiet Feed** is a read-only feed aggregator that surfaces signal from your social connections while filtering noise. It does not post, comment, or interact with source platforms—it exists to give you back your attention.

### Key Features
- **SCORE**: Quality rating 0-100 for each feed item
- **TRACE**: Origin tracking and propagation path
- **DEDUP**: Semantic deduplication of similar content
- **MUTE**: Complete exclusion of topics or sources
- **WIRE MODE**: Headline normalization
- **SHIELD**: Dark pattern neutralization (no autoplay, explicit pagination)

### Access Tiers
- **ANONYMOUS**: No login, curated public feed
- **ENHANCE**: OAuth login, personal feeds, all features
- **HARD COPY**: Paid subscription, unlimited platforms, API access

## Primary References

Orientate yourself with the repository using `REPOSITORY_DOCUMENTATION.md`

Key architecture documents:
- `_developers/STATIC_FIRST_ARCHITECTURE.md` - Static-first data flow patterns
- `AGENT_PLAN_PROTOTYPE.md` - Phase 1 implementation plan
- `AGENT_WIP_PROTOTYPE.md` - Current work in progress

Use the script section of `package.json` to find the test commands.

## Test Commands

Run the following test commands in sequence to check that the code works:
```bash
npm test                              # Unit + system tests (~4s)
./mvnw clean verify                   # Java CDK build
npm run test:anonymousBehaviour-proxy # Anonymous feed behaviour tests
```

If you need to capture the output of a test do it like this:
```bash
npm test > target/test.txt 2>&1
./mvnw clean verify > target/mvnw.txt 2>&1
npm run test:anonymousBehaviour-proxy > target/behaviour.txt 2>&1
```

And query for a subset of things that might be of interest (fail|error) with:
```bash
grep -i -n -A 20 -E 'fail|error' target/test.txt
grep -i -n -A 20 -E 'fail|error' target/mvnw.txt
grep -i -n -A 20 -E 'fail|error' target/behaviour.txt
```

The behaviour tests generate too much output for you to read, pipe it to a file.

## Local-First Development

Favor approaches that work locally AND faithfully remotely:

**Good (Local-First):**
- Node.js scripts in `scripts/`
- Bash scripts for orchestration
- Docker Lambda containers
- Dynalite for local DynamoDB
- Mock OAuth2 server for auth testing

**Avoid (Hard to Test Locally):**
- Step Functions
- Glue scripts
- Complex GitHub Actions workflows

## Code Quality Guidelines

When considering running tests, first trace the code yourself in both the test execution path and the same path when the code is deployed to AWS and detect and resolve bugs found through tracing before running tests.

Avoid unnecessary formatting changes when editing code and do not reformat the lines of code that you are not changing.

Do not re-order imports (I consider this unnecessary formatting).

Only run linting and formatting fix commands `npm run linting-fix && npm run formatting-fix` if specifically asked to fix formatting and linting errors.

When fixing a bug do not add "fallback" paths that allow a silent failure.

When refactoring the code, change a name everywhere, rather than "compatibility" adaptors.
