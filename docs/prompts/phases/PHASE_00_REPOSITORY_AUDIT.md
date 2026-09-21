# PHASE 00 --- Repository Audit

## READ-ONLY / NO IMPLEMENTATION

## Objective

Determine exactly where the current KleeKto repository stands relative
to the Frozen KleeKto MVP 1.0 specification set.

This phase is not implementation.

## Absolute restrictions

During this phase: - do not modify application code; - do not modify
migrations; - do not install dependencies; - do not upgrade packages; -
do not alter deployment; - do not alter environment variables; - do not
touch production data; - do not disable tests; - do not "fix" issues
found; - do not refactor.

If a report file must be created, only create the audit report
explicitly requested for this phase.

## Step 1 --- Repository inventory

Inspect: - root files; - package manager; - workspaces; - apps; -
packages; - services; - scripts; - CI; - deployment configuration; -
extension; - documentation.

Report exact structure.

## Step 2 --- Current stack

Confirm from source, not assumptions: - Next.js version; - React
version; - TypeScript configuration; - Prisma version; - PostgreSQL
usage; - pnpm workspaces; - test framework; - extension framework; -
storage; - deployment.

## Step 3 --- Database

Inspect: - Prisma schema; - all migrations; - indexes; - unique
constraints; - tenant fields; - ownership fields; - source/provenance
fields; - history; - activity/audit; - event tables; - outbox; -
processed-event/idempotency persistence.

For every frozen entity classify:
`COMPLIANT | PARTIAL | MISSING | CONFLICTING | UNKNOWN`

## Step 4 --- Domain

Map current domain modules and compare with: - Company; - User; -
Team; - Owner; - SourceListing; - SourceObservation; - Opportunity; -
Claim; - Contact; - Consent; - Property; - Client; - Requirement; -
Match; - Deal; - Showing; - NextAction; - Publication; - Messenger; -
Notification; - Document; - Analytics facts; - Achievement.

Identify duplicates or concepts that represent the same thing under
different names.

## Step 5 --- Authorization

Inspect: - AuthContext; - permission registry; - roles; - permission
evaluation; - server middleware; - repository boundaries; - DB/RLS if
present; - negative tenant tests; - sensitive-action audit.

Compare against the frozen RBAC document.

## Step 6 --- Event architecture

Determine whether the current repository has: - append-only Domain
Event; - Event Bus; - transactional Outbox; - ProcessedEvent; -
at-least-once consumers; - retry; - dead-letter handling; -
correlation/causation IDs; - immutable history; - separate Audit vs
Business History.

Do not assume `ActivityLog` is equivalent. State precisely what it
covers and what it does not.

## Step 7 --- Collector

Inspect: - source adapters; - scheduler; - workers; - parser; -
normalization; - owner verification; - deduplication; - source change
detection; - checkpoints; - rate limiting; - incidents; - metrics; -
restart behavior.

Pay special attention to the documented current limitation: myhome.ge
server-side collection was previously blocked by Cloudflare.

Do not invent a bypass.

## Step 8 --- Opportunity Feed

Verify: - all owner-verified opportunities are available by default; -
feed is company-shared; - claim is soft; - claim expiry exists; -
personal archive semantics; - contact marker semantics; - price
history; - source snapshots; - no Property is created merely by
collection.

## Step 9 --- Property / Owner / Client / Deal

Verify the complete lifecycle: Opportunity → contact → consent →
Property.

Verify: - Owner dedupe; - Property dedupe; - ambiguity handling; -
multiple Deals per Property; - multiple Deals per Client; - Showing as
event/history; - Next Action as first-class operational object.

## Step 10 --- Search / Matching

Verify Search and Matching are separate.

Search: - FTS; - trigram; - normalized fields; - aliases; - permission
filtering.

Matching: - rule-based; - explainable; - triggered on Property/client
requirement changes; - responsible-agent preservation; - collaboration
when necessary.

## Step 11 --- Publication / Extension

Inspect: - extension contexts; - source import; - revealed-phone
detection; - manual phone path; - publication draft; - form adapters; -
media transfer; - human confirmation; - external reference; -
publication lifecycle.

Verify the extension cannot silently publish.

## Step 12 --- Analytics / Achievements / Automation

Verify: - analytics authorization; - analytics facts; - historical
periods; - drill-down; - achievement calculations; - immutable award
history; - automation command authorization; - recursion/idempotency
protections.

## Step 13 --- Design System / UX

Read
`docs/specifications/KleeKto_Design_System_and_UX_Specification_v1.0.md`
and audit the current frontend read-only.

Inventory and classify: - design tokens; - theme implementation; -
shared UI primitives; - app shell/navigation; - Today; - Opportunity
Feed; - entity drawers/split views; - Command Bar; - tables/forms; -
loading/empty/error/ denied/conflict states; - keyboard/focus
behavior; - responsive behavior; - RU/KA/EN layout behavior; -
reduced-motion support; - accessibility; - visual/interaction regression
tests; - duplicated/page-local styling.

For each major UI area classify
`COMPLIANT | PARTIAL | MISSING | CONFLICTING | UNKNOWN` and
`KEEP | ADAPT | REPLACE | REMOVE | UNKNOWN`.

Do not redesign or modify UI during Phase 00.

## Step 14 --- Tests

Inventory: - unit; - integration; - contract; - E2E; - security; -
tenant isolation; - extension; - adapter; - production smoke tests.

Report tests that exist but do not actually exercise the production call
path.

## Step 15 --- Deployment

Inspect: - Vercel; - GitHub Actions; - environment variables; -
collector scheduling; - queues/workers; - storage; - database; - backup
configuration; - restore procedure; - observability.

Do not print secrets.

## Step 16 --- Produce the gap report

The report must contain:

### A. Executive summary

### B. Current architecture

### C. Frozen MVP compliance matrix

Area Status Evidence Gap Risk ------ -------- ---------- ----- ------

### D. Reuse matrix

Existing module Reuse Adapt Replace Reason ----------------- -------
------- --------- --------

### E. Data migration risks

### F. Security risks

### G. External-source risks

### H. Design / UX gaps

### I. Test gaps

### J. Deployment gaps

### K. Ordered implementation plan

### L. Questions requiring owner decision

Only real product/architecture questions belong here. Do not ask the
owner to choose implementation details that are already specified.

## Final gate

Stop.

Do not begin Foundation or any implementation phase until the owner
explicitly accepts the audit and starts the next phase.
