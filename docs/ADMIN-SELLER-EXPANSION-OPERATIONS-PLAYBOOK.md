# Admin and Seller Expansion Operations Playbook

## Purpose
This document is the execution companion to the strategy playbook. It is built for day-to-day delivery control on a live production system.

Production context:
1. Platform is live on Hetzner.
2. Mobile app is in Google Play test mode.
3. All work must be zero-regression and rollback-safe.

## Operating Principles
1. Do not break existing checkout, entitlement, moderation, creator, and library flows.
2. Ship additive, backward-compatible DB and API changes only.
3. Keep feature-gated rollout discipline.
4. Enforce security controls at every boundary (RBAC, validation, rate limits, audit logs).
5. Use staged release with explicit go/no-go gates.

## Team Roles (Suggested)
| Role | Owner | Backup | Contact | Notes |
|---|---|---|---|---|
| Product Lead | Mukulah (Founder/Product) | Engineering Manager | Slack: #product-release | Scope, prioritization, final acceptance |
| Backend Lead | API Lead (tech-tools-api) | Senior Backend Engineer | Slack: #backend-api | API, DB, RBAC, migrations |
| Admin Dashboard Lead | Admin FE Lead (admin-dashboard) | Full-Stack Engineer | Slack: #admin-dashboard | Admin UX and integration |
| Web Store Lead | Web FE Lead (e-commerce-web-store) | Frontend Engineer | Slack: #web-store | Business switch UX |
| Mobile Lead | Mobile Lead (tech-tools-mobile-app) | Mobile Engineer | Slack: #mobile-app | Business switch UX |
| QA Lead | QA Lead (E2E + Regression) | QA Engineer | Slack: #qa-release | Test plans and signoff |
| DevOps/SRE Lead | DevOps Lead (Hetzner) | Platform Engineer | Slack: #platform-ops | Deploy, monitor, rollback |
| Security Reviewer | Security Lead/AppSec | Senior Backend Engineer | Slack: #security | Threat checks and RBAC review |

## Milestone Plan With Owners and ETA
| Milestone ID | Milestone | Scope | Owner | ETA Start | ETA End | Dependency | Status | Exit Criteria |
|---|---|---|---|---|---|---|---|---|
| M1 | Design Freeze | API contracts, DB changes, RBAC matrix | API Lead (tech-tools-api) | 2026-05-25 | 2026-05-27 | None | Planned | Approved design doc |
| M2 | Backend Additive Changes | Admin publish APIs, business switch endpoint, migrations | API Lead (tech-tools-api) | 2026-05-28 | 2026-06-03 | M1 | Planned | Tests pass, migration dry run pass |
| M3 | Admin Dashboard Flow | Admin create/upload/publish UX | Admin FE Lead (admin-dashboard) | 2026-06-02 | 2026-06-06 | M2 APIs available | Planned | End-to-end QA pass on staging |
| M4 | User Business Switch UX | Web + mobile account upgrade flows | Web FE Lead + Mobile Lead | 2026-06-03 | 2026-06-09 | M2 APIs available | Planned | Upgrade flow QA pass |
| M5 | Security and QA Signoff | RBAC, denial tests, abuse checks | Security Lead + QA Lead | 2026-06-09 | 2026-06-11 | M2-M4 | Planned | Signoff checklist complete |
| M6 | Staged Production Rollout | Stage 1 backend, Stage 2 admin, Stage 3 user switch | DevOps Lead (Hetzner) | 2026-06-12 | 2026-06-16 | M5 | Planned | All stage gates passed |
| M7 | Hypercare | Monitoring, fixes, stabilization | DevOps Lead (Hetzner) | 2026-06-17 | 2026-06-24 | M6 | Planned | No sev1/sev2 for 7 days |

## Detailed Workstream Checklist

### Workstream A: Backend (Admin Book Publishing + Business Switch)
| Task ID | Task | Owner | ETA | Risk Level | Status | Verification |
|---|---|---|---|---|---|---|
| A1 | Define RBAC matrix for admin/super_admin/user/creator paths | API Lead (tech-tools-api) | 2026-05-25 to 2026-05-26 | Medium | Planned | Security review approved |
| A2 | Add/extend additive migrations for business mode fields and audit fields | API Lead (tech-tools-api) | 2026-05-26 to 2026-05-28 | Medium | Planned | Migration dry run + rollback proof |
| A3 | Implement admin create book API with validation | API Lead (tech-tools-api) | 2026-05-28 to 2026-05-30 | High | Planned | Unit + integration tests |
| A4 | Implement admin upload asset API with idempotency and audit metadata | API Lead (tech-tools-api) | 2026-05-30 to 2026-06-01 | High | Planned | Duplicate request test pass |
| A5 | Implement business switch endpoint with privilege escalation protections | API Lead (tech-tools-api) | 2026-06-01 to 2026-06-02 | High | Planned | RBAC + escalation tests |
| A6 | Preserve existing creator endpoints and behavior | API Lead (tech-tools-api) | 2026-06-02 to 2026-06-03 | Medium | Planned | Regression suite pass |
| A7 | Update shared TypeScript contracts | API Lead (tech-tools-api) | 2026-06-03 | Low | Planned | Compile all packages |

### Workstream B: Admin Dashboard
| Task ID | Task | Owner | ETA | Risk Level | Status | Verification |
|---|---|---|---|---|---|---|
| B1 | Book metadata creation form for admin/super_admin | Admin FE Lead (admin-dashboard) | 2026-06-02 to 2026-06-03 | Medium | Planned | UI tests + API happy path |
| B2 | Book asset upload flow (supported formats only) | Admin FE Lead (admin-dashboard) | 2026-06-03 to 2026-06-04 | High | Planned | File validation tests |
| B3 | Submit/publish action mapped to role policy | Admin FE Lead (admin-dashboard) | 2026-06-04 to 2026-06-05 | High | Planned | Role-based UX and API checks |
| B4 | Error handling and moderation state feedback | Admin FE Lead (admin-dashboard) | 2026-06-05 to 2026-06-06 | Medium | Planned | Manual QA checklist |

### Workstream C: Web Store + Mobile Business Switch UX
| Task ID | Task | Owner | ETA | Risk Level | Status | Verification |
|---|---|---|---|---|---|---|
| C1 | Web account setting to switch to business mode | Web FE Lead (e-commerce-web-store) | 2026-06-03 to 2026-06-05 | Medium | Planned | E2E and regression tests |
| C2 | Mobile account setting to switch to business mode | Mobile Lead (tech-tools-mobile-app) | 2026-06-04 to 2026-06-07 | Medium | Planned | E2E and regression tests |
| C3 | Show seller/creator entry points after successful switch | Web FE Lead + Mobile Lead | 2026-06-06 to 2026-06-08 | Medium | Planned | Role-based UI checks |
| C4 | Ensure customer buying flows remain unchanged | Web FE Lead + Mobile Lead | 2026-06-08 to 2026-06-09 | High | Planned | Checkout regression pack |

### Workstream D: QA, Security, and Release
| Task ID | Task | Owner | ETA | Risk Level | Status | Verification |
|---|---|---|---|---|---|---|
| D1 | RBAC denial-path tests (normal user denied admin publish APIs) | QA Lead (E2E + Regression) | 2026-06-09 | High | Planned | Automated test evidence |
| D2 | Account upgrade flow tests | QA Lead (E2E + Regression) | 2026-06-09 to 2026-06-10 | Medium | Planned | Automated + manual pass |
| D3 | Admin create/upload happy and denied paths | QA Lead (E2E + Regression) | 2026-06-10 | High | Planned | Automated test evidence |
| D4 | Security review of ownership/audit/rate-limit controls | Security Lead/AppSec | 2026-06-10 to 2026-06-11 | High | Planned | Security signoff |
| D5 | Rollback drill in staging | DevOps Lead (Hetzner) | 2026-06-11 | High | Planned | Drill report |

## Release Checklist Table (Go/No-Go)
| Item | Owner | Required for Go-Live | Status | Evidence Link | Notes |
|---|---|---|---|---|---|
| Additive migrations applied in staging | API Lead (tech-tools-api) | Yes | Pending | TBD | |
| API contract compatibility verified | API Lead (tech-tools-api) | Yes | Pending | TBD | |
| Admin create/upload flow validated | Admin FE Lead (admin-dashboard) | Yes | Pending | TBD | |
| Business switch flow validated (web) | Web FE Lead (e-commerce-web-store) | Yes | Pending | TBD | |
| Business switch flow validated (mobile) | Mobile Lead (tech-tools-mobile-app) | Yes | Pending | TBD | |
| RBAC denial tests pass | QA Lead (E2E + Regression) | Yes | Pending | TBD | |
| Checkout and entitlement regression pass | QA Lead (E2E + Regression) | Yes | Pending | TBD | |
| Feature flags configured for staged rollout | DevOps Lead (Hetzner) | Yes | Pending | TBD | |
| Observability dashboards and alerts ready | DevOps Lead (Hetzner) | Yes | Pending | TBD | |
| Rollback runbook reviewed and tested | DevOps Lead (Hetzner) | Yes | Pending | TBD | |
| Security review signoff | Security Lead/AppSec | Yes | Pending | TBD | |
| Final product approval | Mukulah (Founder/Product) | Yes | Pending | TBD | |

## Staged Rollout Execution Plan
| Stage | Change | Flags | Owner | Success Gate | Rollback Action |
|---|---|---|---|---|---|
| Stage 1 | Deploy backend routes, keep UI hidden | Enable backend flags only | DevOps Lead (Hetzner) | API health + no regression in critical flows | Disable backend flags |
| Stage 2 | Enable admin dashboard publishing UI | Enable admin UI flag | DevOps Lead (Hetzner) | Admin flow end-to-end success and RBAC enforcement | Disable admin UI flag |
| Stage 3 | Enable user business switch | Enable business switch flag | DevOps Lead (Hetzner) | Upgrade flow and creator entry points verified | Disable business switch flag |

## Production Smoke Checklist (Per Stage)
| Check | Owner | Stage 1 | Stage 2 | Stage 3 | Result | Notes |
|---|---|---|---|---|---|---|
| API health is green | QA Lead (E2E + Regression) | Yes | Yes | Yes | Pending | |
| Checkout flow (physical + digital) is unaffected | QA Lead (E2E + Regression) | Yes | Yes | Yes | Pending | |
| Entitlement grant still works post-payment | QA Lead (E2E + Regression) | Yes | Yes | Yes | Pending | |
| Library and sample-read access still valid | QA Lead (E2E + Regression) | Yes | Yes | Yes | Pending | |
| Existing creator flow unchanged | QA Lead (E2E + Regression) | Yes | Yes | Yes | Pending | |
| Admin create/upload works by role | QA Lead (E2E + Regression) | No | Yes | Yes | Pending | |
| Normal user denied admin APIs | QA Lead (E2E + Regression) | No | Yes | Yes | Pending | |
| User can switch to business mode | QA Lead (E2E + Regression) | No | No | Yes | Pending | |
| Performance CI and bundle budgets are green | DevOps Lead (Hetzner) | Yes | Yes | Yes | Pending | |

## Rollback Checklist (Non-Destructive)
| Step | Owner | Status | Notes |
|---|---|---|---|
| Disable affected feature flags first | DevOps Lead (Hetzner) | Pending | |
| Keep additive schema changes intact (no destructive rollback) | API Lead (tech-tools-api) | Pending | |
| Revert UI exposure only | Admin FE Lead + Web FE Lead + Mobile Lead | Pending | |
| Verify legacy APIs and clients remain operational | QA Lead (E2E + Regression) | Pending | |
| Monitor errors and conversion metrics for 60 minutes post-rollback | DevOps Lead (Hetzner) | Pending | |

## Metrics and Monitoring Targets
| Metric | Owner | Baseline | Alert Threshold | During Rollout Target |
|---|---|---|---|---|
| API 5xx rate | DevOps Lead (Hetzner) | 7-day pre-release avg | >1% for 5 min | Stay within +0.2pp of baseline |
| Checkout success rate | Product Lead + QA Lead | 14-day pre-release avg | Drop >3% | No material drop |
| Order creation failure rate | API Lead (tech-tools-api) | 14-day pre-release avg | >2% | Stay within +0.3pp of baseline |
| Entitlement grant failure rate | API Lead (tech-tools-api) | 14-day pre-release avg | >1% | Stay within +0.2pp of baseline |
| Admin upload error rate | Admin FE Lead (admin-dashboard) | First 72h post-enable baseline | >5% | Downward trend in 24h |
| Business switch completion rate | Product Lead (Mukulah) | First 72h post-enable baseline | Drop >10% WoW | Stable/improving |

## Daily Standup Update Template
| Date | Workstream | Yesterday | Today | Blockers | Owner |
|---|---|---|---|---|---|
| YYYY-MM-DD | Backend/Admin/Web/Mobile/QA/DevOps | Completed items + PR links | Planned items + ETA | Risks + owner | Named owner |

## Final Release Signoff
| Signoff Area | Signoff Owner | Decision (Go/No-Go) | Date | Notes |
|---|---|---|---|---|
| Product | Mukulah (Founder/Product) | Pending | 2026-06-12 | |
| Engineering | API Lead (tech-tools-api) | Pending | 2026-06-12 | |
| QA | QA Lead (E2E + Regression) | Pending | 2026-06-12 | |
| Security | Security Lead/AppSec | Pending | 2026-06-12 | |
| Operations | DevOps Lead (Hetzner) | Pending | 2026-06-12 | |
