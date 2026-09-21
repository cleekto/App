# KleeKto --- Master Build Prompt for Codex

## Mission

Bring the existing KleeKto repository into compliance with the Frozen
KleeKto MVP 1.0 contract.

Do not assume the repository is empty. Do not assume the repository is
correct. Do not throw away working code without evidence.

The goal is a production-grade, scalable, multi-tenant real-estate CRM /
OS.

## Mandatory first step

Before implementation, perform a complete repository audit.

The first task is read-only.

You must produce: 1. repository inventory; 2. architecture map; 3.
current database/domain map; 4. current API map; 5. current
authorization/RBAC map; 6. current event/history/audit map; 7. current
collector map; 8. current extension map; 9. current publication map; 10.
current search/matching/deal map; 11. current test map; 12.
deployment/observability map; 13. security and tenant-isolation
assessment; 14. frozen-spec compliance matrix; 15. reusable-code matrix;
16. migration/replacement matrix; 17. risk register; 18. current
design-system/UI architecture map; 19. UX/design compliance assessment;
20. recommended implementation order.

For every major component classify it:

`COMPLIANT | PARTIAL | MISSING | CONFLICTING | UNKNOWN`

Do not infer UNKNOWN into COMPLIANT.

## Critical comparisons

Explicitly compare the existing implementation against:

### Market

-   SourceListing / SourceObservation / Opportunity boundaries.
-   Owner verification.
-   Shared Opportunity Feed.
-   Cloud Collector independence.
-   24/7/restartable collector architecture.
-   price history.
-   off-market preservation.
-   soft claim model.

### Consent

-   contact outcome.
-   consent event.
-   Opportunity → Property conversion.
-   hidden phone protection.
-   manual phone path.
-   provenance.

### CRM

-   Owner.
-   Property.
-   Client.
-   Requirements.
-   Match.
-   Deal.
-   Showing.
-   Next Action.
-   multiple Deals per Property and Client.

### Platform

-   Company tenant.
-   AuthContext.
-   RBAC.
-   permission registry.
-   RLS/defense-in-depth.
-   audit.
-   Business History.
-   Event Bus.
-   Outbox.
-   ProcessedEvent.
-   idempotency.

### Search

-   PostgreSQL FTS.
-   pg_trgm.
-   normalized structured fields.
-   aliases RU/KA/EN.
-   permission filtering before display.
-   Search ≠ Matching.
-   command bar.

### Design / UX

Compare the current frontend against
`KleeKto_Design_System_and_UX_Specification_v1.0.md`.

Inspect: - existing tokens/theme architecture; - typography; -
spacing/radius/ elevation; - application shell; - navigation; - Today; -
Opportunity Feed; - entity drawers/split views; - Command Bar; -
tables/forms; - async/error/ permission/conflict states; -
keyboard/focus behavior; - dark/light/system themes; - responsive
behavior; - RU/KA/EN overflow; - reduced motion; - accessibility; -
duplicated/page-local styling; - existing reusable components and design
debt.

Classify existing UI components
`KEEP | ADAPT | REPLACE | REMOVE | UNKNOWN`. Do not replace working UI
merely for stylistic preference; identify concrete contract gaps first.

### Communication

-   Messenger.
-   CRM cards.
-   notification preferences.
-   action-oriented notifications.

### Publication

-   separate Publication entity.
-   lifecycle.
-   marketplace adapters.
-   stored media.
-   human confirmation.
-   no owner-contact leakage.

### Analytics / Achievement

-   authorized company analytics.
-   historical facts.
-   drill-down.
-   eight award categories.
-   reproducible calculations.
-   immutable award history.

## Forbidden behavior

Never: - bypass authorization; - trust client-supplied companyId; -
silently merge ambiguous owners/properties; - silently publish; - invent
marketplace selectors or API behavior; - delete history to simplify a
migration; - edit applied migrations; - disable tests; - expose
secrets; - put real owner PII in fixtures; - replace the whole
repository without a migration justification.

## Architecture principle

Prefer:

`API → AuthContext → DTO validation → Domain Command → Authorization + Invariants → Transaction → State + Event + Outbox → Consumers`

Domain code must not depend on: - HTTP; - Next.js; - Chrome APIs; -
marketplace DOM; - external credentials.

## Migration principle

When old and frozen architecture differ:

1.  identify current behavior;
2.  identify data dependencies;
3.  preserve existing production data;
4.  design additive migration;
5.  migrate;
6.  verify;
7.  remove obsolete implementation only after consumers are migrated.

Do not combine unrelated migrations.

## Phase order

1.  Repository Audit
2.  Foundation / Auth / Tenant / RBAC
3.  DB / Domain primitives
4.  Event / Outbox / Audit 4A. Design System Foundation / Application
    Shell
5.  Source contracts
6.  Collector
7.  Opportunity Feed
8.  Owner Resolution
9.  Property / Source Listing
10. Client / Requirements
11. Search
12. Matching
13. Deal / Pipeline
14. Showing
15. Next Action
16. Notifications
17. Messenger
18. Documents / Media
19. Publication / Extension
20. Analytics
21. Achievements
22. Automation hardening
23. Observability
24. E2E / Security / Performance
25. Production release gates

Parallelize only when dependency contracts are already stable.

## Reporting format

At the end of every task report:

### Changed

-   files/modules;
-   migrations;
-   commands.

### Verified

-   typecheck;
-   lint;
-   unit tests;
-   integration tests;
-   contract tests;
-   build;
-   E2E where applicable.

### Risks

-   data;
-   security;
-   external adapters;
-   performance.

### Open

Only unresolved product/architecture decisions.

### Next

One concrete next step.

Stop at the phase gate.
