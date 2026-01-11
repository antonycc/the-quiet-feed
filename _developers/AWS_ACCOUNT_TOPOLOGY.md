# AWS Account Topology

## Overview

The Quiet Feed uses a multi-account AWS Organization structure under Polycode Limited. This document describes the account hierarchy, trust relationships, and deployment model.

## Account Hierarchy

```
Polycode Limited (Root)
  541134664601
       │
       └── Master Account
             │
             ├── GitHub OIDC Trust (provisioning)
             │
             ├── DNS Management (apex domains only)
             │
             └── Member Accounts
                   ├── backup   - Disaster recovery, cross-region replication
                   ├── ci       - Feature branch deployments, integration testing
                   └── prod     - Production workloads (thequietfeed.com)
```

## Account Responsibilities

| Account | Purpose | Deployment Frequency |
|---------|---------|---------------------|
| **Root (541134664601)** | Organization management, billing consolidation | Rarely (manual) |
| **Master** | OIDC trust, apex DNS, account provisioning scripts | Rarely (bootstrap only) |
| **backup** | Cross-region backups, disaster recovery resources | Automated via backup plans |
| **ci** | Feature branch deployments, ephemeral stacks, integration tests | Per-commit (automated) |
| **prod** | Production infrastructure, user-facing services | Release deployments |

## Master Account Principles

The master account should be **minimal and stable**:

1. **Bootstrap scripts only** - Scripts to create member accounts and establish trust relationships
2. **Apex DNS management** - Route53 hosted zones for apex domains (e.g., `thequietfeed.com`)
3. **GitHub OIDC provider** - Trust relationship allowing GitHub Actions to assume roles
4. **No application code** - All application infrastructure lives in member accounts
5. **Not part of development cycle** - Changes are infrequent and deliberate

### Bootstrap Process

Master account setup scripts are designed to be run from:
- AWS CloudShell in the root account, or
- A privileged local environment with OrganizationAccountAccessRole

These scripts are **not** part of the normal CI/CD pipeline.

## Trust Relationships

```
GitHub Actions (OIDC)
       │
       ▼
  Master Account
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
   ci account        prod account      backup account
```

GitHub Actions authenticates via OIDC (no long-lived credentials) and assumes roles in the appropriate member account based on:
- Branch name (feature branches → ci)
- Release tags (→ prod)
- Scheduled jobs (→ backup)

## Deployment Targets

| Trigger | Target Account | Stacks |
|---------|---------------|--------|
| Push to feature branch | ci | Full application stack (self-destructing) |
| Push to `main` | ci | Integration test stack |
| Release tag | prod | Production stack |
| Scheduled backup | backup | Backup verification |

## Resilience Model

| Component | Strategy |
|-----------|----------|
| **Infrastructure code** | Git repository (this repo) |
| **Application state** | DynamoDB with PITR, cross-region to backup account |
| **Secrets** | AWS Secrets Manager with cross-region replication |
| **DNS** | Route53 in master account (delegated to member accounts) |
| **Static assets** | S3 with versioning, CloudFront cache |

Everything below the master account should be:
- **Scriptable** - Reproducible via CDK/CloudFormation
- **Backupable** - State replicated to backup account
- **Re-deployable** - Can be torn down and recreated from Git
- **Resilient** - Multi-AZ, health checks, auto-recovery

## Account Creation

Member accounts are created via AWS Organizations from the master account. The process:

1. Create account via `aws organizations create-account`
2. Establish cross-account roles for GitHub Actions
3. Configure account-specific secrets in Secrets Manager
4. Deploy environment stacks (ObservabilityStack, DataStack, IdentityStack)

Detailed bootstrap scripts will be maintained in a separate repository or the `scripts/` directory.

## Security Boundaries

| Boundary | Enforcement |
|----------|-------------|
| Root → Master | OrganizationAccountAccessRole (break-glass only) |
| Master → Members | Cross-account IAM roles with conditions |
| GitHub → AWS | OIDC with repository/branch conditions |
| ci ↔ prod | Complete isolation (no cross-account access) |
| prod → backup | One-way replication (backup cannot modify prod) |

## Related Documentation

- `REPOSITORY_DOCUMENTATION.md` - CDK stack architecture
- `.github/workflows/deploy.yml` - GitHub Actions deployment workflow
- `infra/main/java/com/thequietfeed/stacks/` - CDK stack definitions
