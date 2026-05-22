# Admin and Business-Seller Expansion Playbook

## Mission and Production Reality

This project is already live on the internet, hosted on Hetzner, and the mobile app is on Google Play in test mode.

All implementation work in this playbook must be treated as zero-regression and production-safe.

## Primary Business Goals

1. Admin and super admin can create and upload books from the admin dashboard (in addition to creators), so the platform can sell PLR and curated books directly.
2. A normal user can switch account mode to business so they can become a seller/creator and create and sell books.

## Critical Constraints

1. Do not break any existing live behavior.
2. Database and API changes must be backward compatible.
3. No destructive operations. No risky refactors unrelated to this feature.
4. Keep current payment, entitlement, moderation, and books flows intact.
5. Keep feature flags respected where applicable.
6. Security first: RBAC, ownership checks, validation, rate limits, and auditability.

## Project Context

Monorepo applications:

1. tech-tools-api (Express + TypeScript + Postgres + Redis + Stripe)
2. admin-dashboard (Next.js)
3. e-commerce-web-store (Vite + React + TypeScript)
4. tech-tools-mobile-app (Expo Router + TypeScript)

Existing Books/Web3 foundation includes:

1. Creator books flow
2. Moderation states
3. Sample access
4. Digital entitlements
5. Library access

Performance guardrails:

1. Performance CI and bundle budgets are already implemented and must remain green.

## Implementation Scope

### A) Admin and Super Admin Book Publishing Flow

#### Backend Requirements

1. Allow admin and super_admin to create book entries and upload book assets from admin-side APIs.
2. Reuse existing media/storage abstractions and moderation workflow safely.
3. Ensure publication status and rights metadata are handled correctly.
4. Ensure idempotency and validation on upload and create operations.
5. Add or extend audit metadata so actions can be traced to admin user ID.

#### Admin Dashboard Requirements

1. Add admin UI for creating book metadata.
2. Add admin UI for uploading assets (epub/pdf/mobi as supported).
3. Add admin UI action to submit to moderation queue or publish, according to role policy.
4. Provide clear UX feedback for upload, validation, and moderation state transitions.

#### Access Control Requirements

1. Enforce explicit RBAC checks.
2. admin and super_admin: allowed.
3. normal user: denied.
4. Existing creator flow: unchanged.

### B) User Switches Account to Business Mode

#### Backend Requirements

1. Add endpoint and service for authenticated user to request and/or activate business mode.
2. Define data model changes needed, for example:
   - role updates
   - account_type flag
   - seller flags
   - creator profile bootstrap
3. Ensure safe transition with no privilege escalation.
4. Optional approval path may be added, but default design should be fast and low friction.

#### Web Store and Mobile App Requirements

1. Add account setting and action for switching to business mode.
2. After upgrade, user sees creator/seller entry points.
3. Existing customer flows must continue without disruption.

#### Creator Integration Requirements

1. Business-upgraded users can use creator book creation flow without manual DB intervention.
2. Creator profile creation/bootstrap is automatic or clearly guided.

## Technical Requirements

1. Add migrations if needed, fully backward compatible.
2. Add or update API contracts and TypeScript types across apps.
3. Add server-side validation for all new payloads.
4. Add tests for:
   - RBAC
   - Account upgrade flow
   - Admin create/upload flow happy path
   - Admin create/upload flow denied path
5. Update docs with rollout and rollback notes.

## Rollout Safety Requirements

1. Provide staged rollout:
   - Stage 1: Deploy backend with feature-gated routes.
   - Stage 2: Enable admin UI.
   - Stage 3: Enable user business switch.
2. Include explicit env flags where needed.
3. Include production smoke test checklist after deploy.
4. Include rollback plan that does not require data loss.

## Execution Instructions

1. Inspect current code and identify exact files to modify.
2. Implement end-to-end changes.
3. Run builds and tests for touched packages.
4. Return:
   - Concise diff summary by area
   - Migration commands
   - Verification results
   - Remaining risks (if any)

## Definition of Done

1. Admin and super admin can create and upload books from admin dashboard securely.
2. Normal user can switch account to business mode and create/sell through creator flow.
3. No regression in checkout, entitlement, library, moderation, or existing creator functionality.
4. All touched apps compile successfully and critical tests pass.

## Production Smoke Checklist

Run after each rollout stage.

1. API health check passes.
2. Existing checkout succeeds for physical and digital products.
3. Entitlement grants on successful digital payment still work.
4. Library access URLs and sample-read endpoints still work as expected.
5. Existing creator can still create, submit, and track moderation states.
6. Admin/super admin can create and upload a book with expected moderation/publish behavior.
7. Normal user cannot access admin upload APIs before business switch.
8. Normal user can switch to business mode and then access creator entry points.
9. Rate limits and auth errors return expected status codes.
10. Performance CI and bundle budget checks remain green.

## Non-Destructive Rollback Strategy

1. Disable feature flags first (business switch and admin publishing entry points).
2. Keep schema changes additive; do not drop columns/tables in rollback.
3. Revert UI exposure while preserving stored data.
4. Keep old API behavior functional for existing clients.
5. Use targeted hotfixes instead of broad refactors.
