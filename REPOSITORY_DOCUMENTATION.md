# The Quiet Feed - Repository Documentation

**Generated:** 2026-01-11

This document provides a high-level overview of The Quiet Feed repository. For detailed reference, consult the source files directly.

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [Environment Configuration](#environment-configuration)
3. [Build and Test Commands](#build-and-test-commands)
4. [AWS Deployment Architecture](#aws-deployment-architecture)
5. [Local Development](#local-development)
6. [Directory Structure](#directory-structure)

## Repository Overview

**The Quiet Feed** is a full-stack serverless feed aggregator that surfaces signal from your social connections while filtering noise. It does not post, comment, or interact with source platforms—it exists to give you back your attention.

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Static HTML/CSS/JavaScript served via CloudFront + S3 |
| **Backend** | Node.js (Express for local dev, AWS Lambda for production) |
| **Infrastructure** | AWS CDK v2 (Java) |
| **Testing** | Vitest (unit/system), Playwright (browser/behaviour) |
| **Authentication** | AWS Cognito + OAuth providers (production), Mock OAuth2 (local) |
| **Storage** | DynamoDB (bundles/feed configurations) |
| **Quality Scoring** | LLM-based scoring (Ollama local, Claude API production) |
| **Local HTTPS** | mkcert certificates for browser-trusted local.thequietfeed.com |

### Key Features

- **SCORE**: Quality rating 0-100 for each feed item
- **TRACE**: Origin tracking and propagation path visualization
- **DEDUP**: Semantic deduplication of similar content
- **MUTE**: Complete exclusion of topics or sources
- **WIRE MODE**: Headline normalization (removes sensationalism)
- **SHIELD**: Dark pattern neutralization (no autoplay, no infinite scroll)
- **TERM**: Terminal interface (planned) with browser handoff for auth
- **Bundle System**: User feed configuration and entitlement management
- **Multi-Environment**: Supports local proxy, CI, and production deployments
- **OAuth Integration**: Cognito for production, mock OAuth2 for local testing

### Access Tiers

| Tier | Access | Features |
|------|--------|----------|
| **DEFAULT** | Anonymous | Curated public feed with SCORE visible |
| **ENHANCE** | OAuth login | Personal feeds, all features enabled |
| **HARD COPY** | Paid subscription | Unlimited platforms, export, API access |

## Environment Configuration

The repository uses multiple environment files. See the actual files for complete configuration:

| Environment | File | Purpose |
|-------------|------|---------|
| **test** | `.env.test` | Unit/system tests with mocked services |
| **proxy** | `.env.proxy` | Local dev with HTTPS (local.thequietfeed.com), mock OAuth2, dynalite |
| **proxyRunning** | `.env.proxyRunning` | Connect to already-running local services |
| **ci** | `.env.ci` | CI with real AWS |
| **prod** | `.env.prod` | Production (`thequietfeed.com`) |

### Key Environment Variables

Core variables defined in all environment files:

- `ENVIRONMENT_NAME` / `DEPLOYMENT_NAME` - Environment identifiers
- `DIY_SUBMIT_BASE_URL` - Application base URL
- `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` - AWS Cognito configuration
- `BUNDLE_DYNAMODB_TABLE_NAME` - DynamoDB table for feed configurations

**Read the `.env.*` files directly for complete variable listings.**

### Secrets Management

| Environment | Secret Storage |
|-------------|----------------|
| Local | `.env` files (not committed), shell environment |
| AWS (CI/Prod) | AWS Secrets Manager |

**Critical Secrets** (stored in Secrets Manager):
- `{env}/quietfeed/google/client_secret` - Google OAuth
- `{env}/quietfeed/user-sub-hash-salt` - HMAC-SHA256 salt for user ID hashing

## Build and Test Commands

### Quick Reference

```bash
# Core test suite (~4s)
npm test

# Java CDK build (~45s)
./mvnw clean verify

# Local E2E tests
npm run test:anonymousBehaviour-proxy
```

**Read `package.json` for complete script listings.**

### Four-Tier Testing Pyramid

| Tier | Location | Command | Focus |
|------|----------|---------|-------|
| Unit | `app/unit-tests/`, `web/unit-tests/` | `npm run test:unit` | Business logic |
| System | `app/system-tests/` | `npm run test:system` | Docker integration |
| Browser | `web/browser-tests/` | `npm run test:browser` | UI components |
| Behaviour | `behaviour-tests/` | `npm run test:anonymousBehaviour-proxy` | E2E journeys |

### Maven Commands

| Command | Purpose |
|---------|---------|
| `./mvnw clean verify` | Full build: compile, test, package CDK JARs |
| `./mvnw clean test` | Run tests only |
| `./mvnw spotless:check` | Verify code formatting |
| `./mvnw spotless:apply` | Auto-format code |

**Output Artifacts**:
- `target/quietfeed-application.jar` - CDK entry point for application stacks
- `target/quietfeed-environment.jar` - CDK entry point for environment stacks

**Read `pom.xml` for complete Maven configuration.**

## AWS Deployment Architecture

### High-Level Architecture

```
Internet (Users)
       │
       ▼
   Route 53 (DNS)
       │
       ▼
   CloudFront (CDN) ────────────────┐
       │                            │
   ┌───┴───┐                        │
   │       │                        │
   ▼       ▼                        │
  S3    HTTP API Gateway            │
(Static)    │                       │
            ▼                       ▼
      Lambda Functions ────► External APIs
            │                 (Feed Sources)
    ┌───────┼───────┐
    ▼       ▼       ▼
Cognito  DynamoDB  Secrets Manager
```

### Lambda Execution Models

| Model | Pattern | Use Case |
|-------|---------|----------|
| **Synchronous** (`ApiLambda`) | Request → Lambda → Response | Fast operations (token exchange, bundle get) |
| **Asynchronous** (`AsyncApiLambda`) | Request → 202 → SQS → Worker → Poll | Long-running ops (feed scoring, dedup) |

**Async Flow**: Ingest Lambda → SQS Queue → Worker Lambda → DynamoDB (result) → Client polls

### CDK Stacks

#### Environment Stacks (Long-Lived)

Created once per environment by `deploy-environment.yml`:

| Stack | Resources |
|-------|-----------|
| ObservabilityStack | CloudWatch Log Groups, RUM, Alarms |
| DataStack | DynamoDB tables |
| ApexStack | Route53 apex domain |
| IdentityStack | Cognito user pool |

#### Application Stacks (Per-Deployment)

Created per deployment by `deploy.yml`:

| Stack | Resources |
|-------|-----------|
| DevStack | S3, CloudFront, ECR |
| SelfDestructStack | Auto-destroy (non-prod) |
| AuthStack | Auth Lambda functions |
| AccountStack | Bundle/feed config Lambdas |
| ApiStack | HTTP API Gateway |
| EdgeStack | Production CloudFront |
| PublishStack | S3 static file deployment |
| OpsStack | CloudWatch dashboard |

**Read the CDK stack files in `infra/main/java/com/thequietfeed/stacks/` for details.**

### GitHub Actions Workflows

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `deploy.yml` | Build, test, deploy application | Push, schedule, manual |
| `deploy-environment.yml` | Deploy shared infrastructure | Push to env files, manual |
| `test.yml` | Run all tests (reusable) | Push, schedule, workflow_call |
| `set-origins.yml` | Update DNS/CloudFront | Manual only |
| `scale-to.yml` | Set Lambda concurrency | Manual only |
| `manage-secrets.yml` | Backup/restore salt secrets | Manual only |

**Read `.github/workflows/*.yml` for complete workflow definitions.**

## Local Development

### Local Development Stack

```
Developer Machine
    │
    ├── Express Server (https://local.thequietfeed.com:3443) ──► Lambda handlers
    │       │
    ├── mkcert certificates (.certs/) ──► Browser-trusted HTTPS
    │
    ├── Mock OAuth2 (localhost:8080) ──► Simulates Cognito
    │
    └── Dynalite (dynamic port) ──► Local DynamoDB
```

### Starting Local Services

```bash
# One-time setup
npm run https:setup   # Install mkcert, generate certificates
# Add to /etc/hosts: 127.0.0.1 local.thequietfeed.com

# Start all services
npm start

# Or individually:
npm run data    # Local DynamoDB
npm run auth    # Mock OAuth2
npm run server:https  # Express HTTPS server
```

### Local vs AWS Comparison

| Aspect | Local (Express) | AWS (Lambda) |
|--------|----------------|--------------|
| Entry Point | `app/bin/server.js` | Lambda handler exports |
| Static Files | Express static | S3 + CloudFront |
| Authentication | Mock OAuth2 | AWS Cognito |
| Database | Dynalite (in-memory) | DynamoDB |
| Secrets | `.env` file | Secrets Manager |

**Read `app/bin/server.js` and `app/lib/httpServerToLambdaAdaptor.js` for implementation details.**

## Directory Structure

### Top-Level Overview

| Directory | Purpose |
|-----------|---------|
| `.github/` | GitHub Actions workflows and custom actions |
| `app/` | Backend Node.js Lambda functions and libraries |
| `behaviour-tests/` | End-to-end Playwright behaviour tests |
| `cdk-application/` | CDK configuration for application stacks |
| `cdk-environment/` | CDK configuration for environment stacks |
| `infra/` | Java/CDK infrastructure code |
| `scripts/` | Utility scripts for development and deployment |
| `web/` | Frontend HTML/CSS/JavaScript and tests |
| `_developers/` | Developer documentation |

### Backend Structure (`app/`)

| Path | Purpose |
|------|---------|
| `bin/` | Entry point scripts (server.js, dynamodb.js) |
| `data/` | DynamoDB repository implementations |
| `functions/` | Lambda function handlers (auth/, account/) |
| `lib/` | Shared libraries (logger, JWT, HTTP helpers) |
| `services/` | Business logic (bundleManagement.js, subHasher.js) |
| `unit-tests/` | Vitest unit tests |
| `system-tests/` | Vitest integration tests |

### Frontend Structure (`web/`)

| Path | Purpose |
|------|---------|
| `public/` | Static website files served by S3/CloudFront |
| `public/auth/` | Authentication pages |
| `public/account/` | User account pages (bundles/feed config) |
| `public/widgets/` | Reusable Web Components |
| `unit-tests/` | Vitest frontend unit tests |
| `browser-tests/` | Playwright browser tests |

### Infrastructure Structure (`infra/`)

| Path | Purpose |
|------|---------|
| `main/java/.../stacks/` | CDK stack definitions |
| `main/java/.../constructs/` | Reusable CDK constructs (ApiLambda, AsyncApiLambda) |
| `main/java/.../utils/` | Utility classes |
| `test/` | JUnit tests for CDK code |

**Use your IDE or `ls -la` to explore the full directory structure.**

## DynamoDB Schema

### Core Tables

| Table | Purpose | Key Schema |
|-------|---------|------------|
| Bundles | User feed configurations | `hashedSub` (PK), `bundleId` (SK) |

### Async Request Tables

Each async operation has its own request state table:
- `quietfeed-bundle-post-async-requests`
- `quietfeed-bundle-delete-async-requests`

**Schema**: `hashedSub` (PK), `requestId` (SK), `status`, `data`, `ttl`

## Security Architecture

### Authentication Flow

1. User navigates to application
2. Frontend checks for JWT in localStorage
3. If no JWT, redirect to Cognito OAuth
4. User authenticates (Google IdP or username/password)
5. Cognito redirects with auth code
6. Frontend exchanges code for JWT
7. JWT stored in localStorage
8. API requests include JWT in Authorization header
9. Custom authorizer Lambda validates JWT

### Key Security Measures

- All traffic over HTTPS (ACM certificates)
- Secrets in AWS Secrets Manager (never in code)
- User IDs hashed with HMAC-SHA256 before storage
- IAM least-privilege roles
- CORS properly configured
- JWT validation on all protected routes
- No content persistence (feed items not stored)

### Data Privacy Principles

- **Read-only**: The Quiet Feed does not post, comment, or interact with source platforms
- **No content storage**: Feed items are fetched, scored, and rendered but not persisted
- **User-delegated access**: All API calls use user's OAuth token
- **Links to originals**: Every item links to source platform

---

## Additional Documentation

For specific topics, see:

| Document | Location |
|----------|----------|
| Project vision & features | `README.md` |
| Claude Code instructions | `CLAUDE.md` |
| Static-first architecture | `_developers/STATIC_FIRST_ARCHITECTURE.md` |
| Prototype implementation plan | `AGENT_PLAN_PROTOTYPE.md` |
| Scaling phases strategy | `AGENT_PLAN_SCALING_PHASES.md` |
| Work in progress | `AGENT_WIP_PROTOTYPE.md` |
| AWS account topology | `_developers/AWS_ACCOUNT_TOPOLOGY.md` |
| Salted hash implementation | `_developers/SALTED_HASH_IMPLEMENTATION.md` |
| Salt secret recovery | `_developers/SALT_SECRET_RECOVERY.md` |

## Local-First Development

Favor approaches that work locally AND faithfully remotely:

**Good (Local-First):**
- Node.js scripts in `scripts/`
- Bash scripts for orchestration
- Docker Lambda containers (same runtime as AWS)
- Dynalite for local DynamoDB
- Mock OAuth2 server for auth testing
- LLM API calls from local workstation

**Avoid (Hard to Test Locally):**
- Step Functions (use SQS + Lambda patterns instead)
- Glue scripts (use Node.js ETL scripts)
- Complex GitHub Actions workflows

**Test Content Strategy:**
- Sample content: Static JSON in `app/test-data/sample-feeds/` (checked in, served via express at `/sample-feeds`)
- Generated test content: Created by system tests in `app/test-data/test-feeds/`, checked in but not regenerated on every test run
- Test reports: Generated by Playwright, stored in `web/public/tests/`

**For detailed implementation, always refer to the source files directly.**
