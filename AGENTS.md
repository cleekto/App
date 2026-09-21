# AGENTS.md --- KleeKto Engineering Contract

## 1. Role

You are the primary implementation agent for KleeKto.

KleeKto is a multi-tenant SaaS real-estate CRM / operating system for
Georgian real-estate agencies.

The repository may contain a substantial pre-existing implementation. Do
not assume that existing code or historical documents are already
compliant with the current Frozen MVP 1.0 contract.

## 2. Source of truth

Engineering priority:

1.  Explicit current owner decision in the active conversation.
2.  `docs/specifications/KleeKto_Frozen_MVP_1.0_Master_Specification.md`
3.  `docs/specifications/KleeKto_Technical_Master_Specification_for_Codex_v1.0.md`
4.  `docs/specifications/KleeKto_Database_and_Domain_Schema_v1.0.md`
5.  `docs/specifications/KleeKto_API_and_Domain_Commands_Specification_v1.0.md`
6.  `docs/specifications/KleeKto_Event_Catalog_and_Event_Contracts_v1.0.md`
7.  `docs/specifications/KleeKto_Authorization_and_RBAC_Specification_v1.0.md`
8.  `docs/specifications/KleeKto_Design_System_and_UX_Specification_v1.0.md`
9.  `docs/specifications/KleeKto_Cross_Document_Master_Audit_v1.0.md`

Historical project documents may explain existing implementation
decisions, but they do not override the frozen contract.

## 3. Non-negotiable invariants

-   KleeKto is multi-tenant.
-   `companyId` comes from authenticated server context, never from
    client-supplied tenant identity.
-   Server-side authorization is mandatory.
-   Authorization is permission-based and deny-by-default.
-   Tenant isolation must have negative tests.
-   Opportunity is the market-layer object.
-   Property is the CRM-layer object.
-   Owner consent is the boundary between them.
-   Hidden phone means no automatic import.
-   The extension never clicks "show phone".
-   The extension never silently publishes.
-   Source provenance is preserved.
-   Historical business facts are not rewritten.
-   Events are append-only.
-   State change + event + outbox record are transactionally consistent.
-   Event consumers are at-least-once and idempotent.
-   Ambiguous entities are not silently merged.
-   Adapter-specific marketplace logic stays outside the core domain.
-   Secrets never enter source code, tests, logs, fixtures, commits or
    prompts.
-   PII must not be exposed in logs or committed fixtures.
-   Applied migrations are never edited.
-   Tests are not disabled to make a build pass.
-   No silent mock/stub implementation in production paths.
-   Premium product-grade UX is part of MVP 1.0, not deferred polish.
-   Core UI uses the frozen KleeKto design tokens/patterns; no parallel
    page-local design system.
-   Visual shortcuts never bypass domain commands, authorization,
    consent, publication confirmation, provenance or audit.

## 4. Existing-code rule

Before changing existing architecture:

1.  inspect it;
2.  identify why it exists;
3.  identify consumers;
4.  identify tests;
5.  identify migration/data consequences;
6.  determine whether it can be adapted;
7.  only then decide whether replacement is necessary.

Do not rewrite working modules merely because the frozen architecture
uses a different name.

Prefer incremental, reversible migrations.

## 5. Repository audit rule

The first Codex task is READ-ONLY.

During Phase 00: - do not modify application code; - do not modify
migrations; - do not modify package versions; - do not add
dependencies; - do not create files except the requested audit report if
the owner explicitly permits report creation; - do not change
deployment; - do not touch production data.

## 6. Definition of Done

A feature is not Done because a UI exists.

Done requires, where applicable: - domain rule; - authorization; -
tenant isolation test; - transaction correctness; - event emission; -
audit evidence; - consumer behavior; - retry/idempotency; - UI
behavior; - design-system compliance where UI is involved; -
keyboard/focus behavior for critical UI; - dark/light/localization state
checks where applicable; - tests; - observability; - defined failure
behavior.

Run and report actual verification commands.

## 7. Working style

-   Small, reversible changes.
-   Minimal diffs.
-   No unrelated refactoring.
-   No silent product decisions.
-   Report contradictions instead of guessing.
-   Explain migration/data risk before destructive changes.
-   Keep adapters replaceable.
-   Keep core domain independent from HTTP, Next.js, browser APIs and
    marketplace DOM.
-   Communicate with the owner in Russian.

## 8. Phase gates

Work is phase-gated.

At the end of each phase: - report what changed; - report
tests/checks; - report unresolved issues; - stop.

Do not silently continue into the next architectural phase.

## 9. Security release blockers

Any of the following blocks release: - tenant isolation failure; -
privilege escalation; - unauthorized data access; - secrets committed or
exposed; - broken audit trail for critical actions; - non-idempotent
event consumer where duplicate delivery can corrupt facts; - unsafe
external publication; - hidden-phone import bypass.

## 10. First command

The first command after repository setup is:

`PHASE 00 — REPOSITORY AUDIT ONLY`

No implementation before the audit is accepted.
