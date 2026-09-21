# KleeKto --- Technical Master Specification for Codex

**Document:** Technical Master Specification\
**Product:** KleeKto\
**Version:** 1.0\
**Status:** Implementation Baseline\
**Audience:** Codex / engineering team / reviewers\
**Authority:** Derived from Frozen KleeKto MVP 1.0 Master Specification

------------------------------------------------------------------------

# 1. Purpose

This document converts the frozen KleeKto MVP product architecture into
an implementation-oriented technical contract.

Codex must use this document as the engineering baseline.

The implementation may choose equivalent libraries or internal
structures where necessary, but must preserve: - domain boundaries; -
data invariants; - authorization semantics; - event contracts; - tenant
isolation; - provenance; - idempotency; - auditability; -
human-in-the-loop requirements; - external adapter isolation.

Do not implement Post-MVP features merely because extension points
exist.

------------------------------------------------------------------------

# 2. Technical Stack Baseline

The existing KleeKto project baseline is:

-   Next.js 15
-   React 19
-   TypeScript strict mode
-   Tailwind CSS 4
-   PostgreSQL
-   Prisma
-   pnpm monorepo
-   Vitest
-   Chrome MV3 Extension
-   Vercel-compatible web deployment
-   S3-compatible private object storage

Codex must first inspect the current repository before changing
architecture.

Do not blindly replace working infrastructure.

Before implementation: 1. inspect repository; 2. inspect package graph;
3. inspect Prisma schema and migrations; 4. inspect current API; 5.
inspect current extension; 6. inspect tests; 7. identify reusable code;
8. identify legacy contradictions; 9. produce a migration plan if
existing implementation differs from this specification.

Never expose, commit, or reproduce production secrets.

------------------------------------------------------------------------

# 3. Monorepo Architecture

Recommended structure:

``` text
apps/
  web/
  extension/

packages/
  core/
  db/
  contracts/
  ui/
  search/
  integrations/
  storage/
  i18n/
  analytics/

services/
  collector/
  workers/

infrastructure/
  ...
```

Exact directory names may vary, but dependency direction must remain
equivalent.

## Dependency rule

``` text
UI
 ↓
Application Services / Commands
 ↓
Domain
 ↓
Contracts / Ports
 ↓
Infrastructure Adapters
```

Domain code must not import: - Next.js; - React; - Prisma client; -
marketplace DOM code; - browser APIs.

------------------------------------------------------------------------

# 4. Domain Layer

Domain modules:

``` text
domain/
  company/
  identity/
  opportunity/
  owner/
  property/
  source-listing/
  client/
  requirement/
  matching/
  deal/
  showing/
  next-action/
  publication/
  messenger/
  document/
  notification/
  achievement/
```

Cross-cutting:

``` text
domain/
  events/
  audit/
  authorization/
  automation/
  search/
```

Each domain module should expose: - commands/use cases; - domain
validation; - entities/value objects; - domain events; - repository
ports where necessary.

Avoid generic "god services".

------------------------------------------------------------------------

# 5. Database

PostgreSQL is the transactional source of truth.

Prisma is the primary ORM.

Every tenant-scoped model must contain:

``` text
companyId
```

where applicable.

`companyId` must be derived from authenticated context, never trusted
from arbitrary request body data.

## 5.1 Required core tables/models

At minimum:

``` text
Company
User
Role
Permission
RolePermission
Team

Opportunity
OpportunityClaim
OpportunityContact
OpportunityArchive

Owner
OwnerPhone
OwnerEmail
OwnerSourceReference

SourceListing
SourceObservation

Property
PropertyMedia
PropertyCharacteristic
PropertySourceReference

Client
ClientRequirement

Match

Deal
DealStage
DealStageHistory

Showing
NextAction

Publication
PublicationMedia
PublicationExternalReference

Event
OutboxEvent
AuditEntry

Notification
NotificationPreference
NotificationSubscription

Conversation
ConversationParticipant
Message
MessageAttachment

Document
DocumentVersion
DocumentShare
DocumentFolder
DocumentTag

AchievementType
AchievementPeriod
AchievementAward

AutomationRule
AutomationExecution

SearchDocument / SearchIndex

CollectorJob
CollectorCheckpoint
IntegrationIncident

Subscription
Plan
Entitlement
UsageMeter
Invoice
InvoiceItem
Payment
```

Some tables may be implemented differently if the resulting semantics
are identical.

------------------------------------------------------------------------

# 6. IDs and Timestamps

Use stable opaque IDs.

All persisted entities must have: - id - createdAt - updatedAt

Events additionally have: - occurredAt - correlationId - causationId

Prefer UTC timestamps in storage.

Convert to company/user timezone only at presentation or explicitly
timezone-aware scheduling boundaries.

------------------------------------------------------------------------

# 7. Tenant Isolation

Every application request must establish:

``` text
AuthContext {
  userId
  companyId
  roles
  permissions
}
```

Every repository/query must operate under the tenant context.

Forbidden pattern:

``` ts
db.property.findMany({
  where: { id }
})
```

Preferred:

``` ts
propertyRepository.getById({
  companyId: context.companyId,
  propertyId
})
```

Database-level RLS may additionally be used where practical.

Tests must explicitly verify cross-company isolation.

------------------------------------------------------------------------

# 8. Authorization

Authorization service:

``` ts
authorize({
  actor,
  permission,
  resource,
  action
})
```

Never scatter role checks:

``` ts
if (user.role === "ADMIN") ...
```

Permissions are the source of authorization semantics.

Canonical permission identifiers are defined by the RBAC
Specification and must not be shortened or replaced with legacy aliases.

Core MVP permissions include:

``` text
opportunity.read
opportunity.claim
opportunity.contact
opportunity.archive
opportunity.restore

owner.read
owner.create
owner.update
owner.merge

property.read
property.create
property.update_own
property.update_company
property.archive
property.restore
property.assign
property.merge
property.export

client.read
client.create
client.update_own
client.update_company
client.export

deal.read
deal.create
deal.update_own
deal.update_company
deal.stage.change_own
deal.stage.change_company
deal.close

showing.read
showing.create
showing.update_own
showing.update_company

next_action.read
next_action.manage_own
next_action.manage_company

publication.prepare
publication.confirm
collaboration.request

messenger.read
messenger.send

document.read
document.upload
document.share
document.archive

automation.read
automation.manage

analytics.company.read_full
analytics.company.export
analytics.company.financial
analytics.company.agent_performance
analytics.team.read

achievement.read
achievement.admin.read
achievement.manage

audit.read
billing.read
billing.manage
```

Frontend permission checks are UX only.

Server authorization is authoritative.

------------------------------------------------------------------------

# 9. Core Domain Invariants

Codex must encode and test these invariants.

## 9.1 Opportunity

-   only source-owner-verified listings enter the company Opportunity
    Feed;
-   Opportunity is not Property;
-   Opportunity conversion requires the defined owner-consent workflow;
-   claim does not transfer ownership;
-   archive does not globally delete the Opportunity;
-   source provenance survives conversion.

## 9.2 Owner

-   phone/email/source owner ID can support resolution;
-   name alone cannot silently merge;
-   ambiguous duplicate produces a proposal.

## 9.3 Property

-   Property represents the physical object;
-   SourceListing represents an external representation;
-   source snapshot is immutable;
-   current CRM data is editable with history;
-   material changes may produce warnings.

## 9.4 Deal

-   Property can have multiple Deals;
-   Client can have multiple Deals;
-   each Deal has independent pipeline/history.

## 9.5 Showing

Showing is a business event/entity and does not need to equal a pipeline
stage.

## 9.6 History

Events and audit history are append-only.

## 9.7 Publication

Final external publication requires human confirmation.

## 9.8 Automation

Automation cannot bypass Domain Commands or authorization.

------------------------------------------------------------------------

# 10. Domain Commands

Commands are the only supported way to mutate business state.

Representative commands:

``` text
CreateOpportunity
ClaimOpportunity
ReleaseOpportunity
ArchiveOpportunity
RestoreOpportunity

RecordOwnerContact
RecordOwnerConsent

ResolveOwner
CreateOwner
MergeOwners

ImportSourceListing
CreateProperty
UpdateProperty
ChangePropertyPrice
ArchiveProperty
RestoreProperty

CreateClient
CreateRequirement
UpdateRequirement

CreateMatch
InvalidateMatch

CreateDeal
ChangeDealStage
CloseDealWon
CloseDealLost

ScheduleShowing
CompleteShowing

CreateNextAction
CompleteNextAction
RescheduleNextAction

CreatePublication
PreparePublication
MarkPublicationReady
BeginPublication
RequestPublicationConfirmation
ConfirmPublication

SendMessage
ShareCrmCard

CreateDocument
ShareDocument

RunAutomationRule
AwardAchievement
```

Each command: 1. validates input; 2. resolves tenant context; 3. checks
permission; 4. checks domain invariants; 5. performs transactional
mutation; 6. writes event/outbox record; 7. returns authoritative state.

------------------------------------------------------------------------

# 11. Event + Outbox Pattern

Transactional workflow:

``` text
Command
 ↓
DB transaction
 ├── domain state mutation
 └── outbox event
       ↓
committed
       ↓
event dispatcher
       ↓
Event consumers
```

Never publish an event before the transaction commits.

Never rely on a UI request directly invoking every downstream subsystem.

Outbox records require: - id - companyId - eventId - eventType -
payload - occurredAt - status - attempts - lastError - processedAt

------------------------------------------------------------------------

# 12. Event Contract

The Event Catalog is authoritative. Technical code must use the same
envelope without local variants:

``` ts
interface DomainEvent<TPayload = unknown> {
  id: string
  type: string
  schemaVersion: number
  companyId: string
  actor: {
    type:
      | "AGENT"
      | "MANAGER"
      | "ADMIN"
      | "VIEWER"
      | "PLATFORM_ADMIN"
      | "SYSTEM"
      | "CLOUD_COLLECTOR"
      | "EXTENSION"
      | "AUTOMATION"
      | "INTEGRATION"
    id?: string
  }
  entity: {
    type: string
    id: string
  }
  occurredAt: string
  source:
    | "WEB"
    | "EXTENSION"
    | "COLLECTOR"
    | "SYSTEM"
    | "AUTOMATION"
    | "INTEGRATION"
    | "IMPORT"
  correlationId: string
  causationId?: string
  idempotencyKey?: string
  payload: TPayload
  metadata?: Record<string, unknown>
}
```

Event schemas are versioned. Event names are the lowercase canonical
past-tense facts from the Event Catalog.

Consumers must tolerate duplicate delivery.

------------------------------------------------------------------------

# 13. Event Consumers

Consumers should be independently retryable.

Examples:

``` text
PropertyPriceChanged
 ├── SearchUpdater
 ├── MatchingWorker
 ├── NotificationWorker
 ├── AutomationWorker
 ├── AnalyticsConsumer
 └── AuditConsumer
```

A failed Notification consumer must not roll back the Property
transaction.

------------------------------------------------------------------------

# 14. Opportunity / Collector Pipeline

Collector architecture:

``` text
Scheduler
 ↓
Collector Worker
 ↓
Marketplace Adapter
 ↓
Source Parser
 ↓
Normalizer
 ↓
Owner Indicator Extractor
 ↓
SourceObservation
 ↓
Deduplication
 ↓
Opportunity Projection
 ↓
Events
```

Collector must be: - restartable; - checkpointed; - idempotent; -
rate-limited; - observable.

## 14.1 SourceObservation

Stores the raw/normalized observation needed to reconstruct source
history.

Do not overwrite historical observations.

## 14.2 Owner verification

Use explicit source-provided structured owner/author indicator.

Do not infer owner status from weak heuristics when the source does not
provide sufficient evidence.

## 14.3 Source drift

If required fields disappear or parsing confidence becomes unsafe: -
stop unsafe ingestion; - create incident; - preserve previous known
state; - do not create corrupt Opportunities.

------------------------------------------------------------------------

# 15. Opportunity Feed Query

Feed must support:

``` text
new
views
priceChanged
age
available
inWork
contacted
archived
source
district
propertyType
```

Default: - all source-owner-verified opportunities.

Cards should resolve: - source; - owner indicator; - source
description; - current price; - views; - age; - photos; - work state; -
team contact marker.

------------------------------------------------------------------------

# 16. Claim Model

Claim is a soft operational state.

Fields:

``` text
id
companyId
opportunityId
userId
claimedAt
lastActivityAt
releasedAt
expiresAt
```

The system must not permanently lock an Opportunity to an agent.

Claim activity can be refreshed by meaningful actions.

Expiration policy should be configurable.

------------------------------------------------------------------------

# 17. Contact Model

Contact history should be explicit.

``` text
OpportunityContact {
  id
  companyId
  opportunityId
  ownerId?
  agentId
  channel
  outcome
  occurredAt
  notes
}
```

Contact history remains after the visual team marker expires.

------------------------------------------------------------------------

# 18. Extension Import Contract

Request:

``` ts
ImportSourceListingCommand {
  source: "SS_GE" | "MYHOME_GE"
  sourceListingId: string
  sourceUrl: string
  sourceSnapshot: unknown
  phone: string
  phoneEvidence: {
    mode: "REVEALED_ON_SOURCE" | "MANUAL_AGENT_INPUT"
  }
  photos: CapturedPhoto[]
  capturedAt: string
  extensionVersion: string
}
```

Server validates: - authenticated extension; - supported source; -
provider/source URL allowlist; - extension compatibility; - phone
normalization; - valid human-provided phone evidence; - payload
consistency; - source ID; - deduplication.

The server must not trust the extension merely because it sends a
`phone` field or evidence label.

For `REVEALED_ON_SOURCE`, the extension captures the human-revealed
source state using supported extraction logic and never simulates the
native reveal action.

For `MANUAL_AGENT_INPUT`, the human explicitly enters the phone and the
system records that provenance. If neither evidence mode is valid, the
import is rejected.

------------------------------------------------------------------------

# 19. Property Conversion

Owner consent is a prerequisite.

Workflow:

``` text
Opportunity
 ↓
Owner Contact
 ↓
Consent Recorded
 ↓
ImportSourceListing
 ↓
Resolve Owner
 ↓
Resolve Property
 ↓
Create/Link Property
 ↓
Link SourceListing
 ↓
Persist Source Snapshot
 ↓
Emit PropertyCreated/Linked
```

Opportunity remains linked after conversion.

------------------------------------------------------------------------

# 20. Property Data Model

Property should separate:

``` text
source snapshot
current CRM data
derived data
```

Example:

``` text
Property
  currentPrice = 145000

SourceSnapshot
  capturedPrice = 150000
```

Price history is event-backed.

Photos should reference stored media, not temporary marketplace URLs.

------------------------------------------------------------------------

# 21. Entity Resolution

Provide explicit interfaces:

``` ts
OwnerResolver.resolve(input)
PropertyResolver.resolve(input)
```

Result:

``` ts
ResolutionResult<T> =
  | { type: "MATCH"; entityId; confidence }
  | { type: "NEW" }
  | { type: "AMBIGUOUS"; candidates[] }
```

No ambiguous auto-merge.

------------------------------------------------------------------------

# 22. Client and Requirements

Client Requirements are separate records.

Requirements must support: - price range; - area range; - rooms; -
property type; - districts; - must-have; - nice-to-have; - exclusions; -
characteristics; - active lifecycle.

A Client may have multiple active requirements.

------------------------------------------------------------------------

# 23. Matching

MVP matching is deterministic.

Example rule:

``` text
price within requirement range
AND rooms compatible
AND area compatible
AND district compatible
AND property type compatible
```

Each Match stores explanation data:

``` text
{
  price: "MATCH",
  rooms: "MATCH",
  area: "MATCH",
  district: "MATCH",
  propertyType: "MATCH"
}
```

Matching must not overwrite ownership.

------------------------------------------------------------------------

# 24. Deal

Deal aggregate:

``` text
Deal {
  id
  companyId
  propertyId
  clientId
  responsibleAgentId
  stageId
  price
  commission
  openedAt
  closedAt
  outcome
}
```

Stage transitions produce events.

Pipeline configuration is data-driven.

------------------------------------------------------------------------

# 25. Showing

Showing belongs to a Deal.

Minimum:

``` text
dealId
propertyId
clientId
agentId
scheduledAt
completedAt
result
notes
```

Completed Showings drive: - showing counts; - analytics; - achievement
calculations.

------------------------------------------------------------------------

# 26. Next Action

Next Action may be: - manually created; - generated by automation; -
generated from business events.

It must contain: - assignee; - type; - priority; - dueAt; - linked
entity; - status; - source; - generation metadata.

Statuses:

``` text
OPEN
IN_PROGRESS
COMPLETED
CANCELLED
```

Overdue is derived from dueAt and status.

------------------------------------------------------------------------

# 27. Search Architecture

Define:

``` ts
interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResult[]>
}
```

MVP implementation: - PostgreSQL FTS; - pg_trgm; - normalized fields.

Index records should contain: - entityType; - entityId; - companyId; -
searchable text; - normalized fields; - ranking metadata.

Permission filtering must occur before displaying results.

------------------------------------------------------------------------

# 28. Global Search / Command Bar

Support: - entity lookup; - property structured search; - Opportunity
filters; - Client lookup; - Owner lookup; - Deal lookup; - Next Action
lookup.

Deterministic parser MVP:

``` text
3 комнаты сабуртало до 150000
```

must translate into structured filters.

AI parsing is a future adapter.

------------------------------------------------------------------------

# 29. Messenger

Core entities:

``` text
Conversation
ConversationParticipant
Message
MessageAttachment
```

Message may include CRM reference:

``` text
CrmCard {
  entityType
  entityId
  title
  preview
}
```

Messenger must respect: - tenant; - conversation membership; -
permissions; - notification preferences.

------------------------------------------------------------------------

# 30. Notifications

Architecture:

``` text
Event
 ↓
Notification Rule
 ↓
Recipient Resolution
 ↓
Preference Check
 ↓
Deduplication / Grouping
 ↓
Notification
 ↓
Channel
```

Notification record:

``` text
id
companyId
recipientId
type
priority
title
body
entityType?
entityId?
action?
groupKey?
createdAt
readAt
```

No direct notification calls from domain modules.

------------------------------------------------------------------------

# 31. Automation

Rule:

``` text
trigger
conditions
actions
scope
priority
enabled
executionPolicy
```

Condition tree supports: - AND - OR - NOT - comparisons.

Actions must invoke Domain Commands.

Never implement:

``` text
automation -> arbitrary SQL UPDATE
```

Required safeguards: - max chain depth; - correlation ID; - event ID; -
idempotency; - execution record; - retry; - dead letter.

------------------------------------------------------------------------

# 32. Audit

Audit record:

``` text
AuditEntry {
  id
  companyId
  actorId?
  actorType
  action
  entityType
  entityId
  before
  after
  source
  correlationId
  occurredAt
  result
}
```

Audit is append-only.

Audit sensitive denied operations.

Do not log secrets, credentials, full payment card data or unnecessary
sensitive data.

------------------------------------------------------------------------

# 33. Unified History

Timeline should be generated from domain/business events.

Each entity can query:

``` text
entityId
companyId
```

and receive normalized history.

History categories: - changes; - calls/interactions; - messages; -
deals; - system.

------------------------------------------------------------------------

# 34. Publication

Publication is independent of Property.

``` text
Publication {
  id
  companyId
  propertyId
  provider
  status
  externalId?
  externalUrl?
  preparedPayload
  createdAt
  updatedAt
}
```

Lifecycle:

``` text
DRAFT
PREPARING
READY
FILLING
AWAITING_CONFIRMATION
PUBLISHED
FAILED
UNPUBLISHED
```

------------------------------------------------------------------------

# 35. Marketplace Adapter Interface

``` ts
interface MarketplaceAdapter {
  source: MarketplaceSource

  collect(...)
  parse(...)
  normalize(...)
  getOwnerIndicator(...)
  preparePublication(...)
  validatePublication(...)
}
```

Publication-specific capabilities must be explicit.

Core domain must not contain marketplace selectors such as CSS/XPath.

------------------------------------------------------------------------

# 36. Extension Publication Workflow

``` text
KleeKto
 ↓
Publication payload
 ↓
Extension
 ↓
Marketplace adapter
 ↓
Fill fields
 ↓
Select categories
 ↓
Upload stored media
 ↓
Detect missing human choices
 ↓
AWAITING_CONFIRMATION
 ↓
Human confirms
 ↓
PUBLISH
 ↓
Capture external reference
 ↓
KleeKto
```

No silent final submission.

------------------------------------------------------------------------

# 37. Analytics Architecture

Analytics must use event-derived data.

Recommended layers:

``` text
Domain Events
 ↓
Analytics Consumer
 ↓
Fact/Event Store or append-only analytical tables
 ↓
Dimension/aggregation models
 ↓
Dashboard queries
```

Minimum dimensions: - company; - date/time; - agent; - district; -
property type; - rooms; - source; - price band; - deal outcome.

Do not calculate historical analytics solely from mutable current
Property state.

------------------------------------------------------------------------

# 38. Analytics Facts

Minimum historical facts:

``` text
OpportunityCreated
OpportunityContacted
OwnerConsent
PropertyCreated
PropertyPriceChanged
ClientRequirementCreated
MatchCreated
ShowingCompleted
DealCreated
DealStageChanged
DealWon
DealLost
PublicationPublished
NextActionCompleted
```

For monetary events preserve historical values.

Example DealWon fact:

``` text
closingPrice
commission
agentId
propertyId
district
propertyType
rooms
area
occurredAt
```

------------------------------------------------------------------------

# 39. Analytics API

Canonical company analytics endpoints:

``` text
GET /api/v1/analytics/company
GET /api/v1/analytics/agents
GET /api/v1/analytics/districts
GET /api/v1/analytics/properties
GET /api/v1/analytics/owners
GET /api/v1/analytics/clients
GET /api/v1/analytics/deals
GET /api/v1/analytics/trends
```

Every full-company endpoint requires:

`analytics.company.read_full`

This permission is normally held by Company Admin and may be granted to
a designated main Manager. Ordinary Agents/Viewers are denied by
default. Financial data requires the appropriate additional permission.
Drill-down is behavior within the authorized analytics contract and does
not require a separate legacy route.

------------------------------------------------------------------------

# 40. Achievement Engine

Achievement calculations must be deterministic and reproducible.

MVP categories:

``` text
BEST_SALES_VOLUME
MOST_DEALS
MOST_SHOWINGS
BEST_CONVERSION
FASTEST_RESPONSE
BEST_DEAL_CLOSING
AGENT_OF_MONTH
BREAKTHROUGH_OF_MONTH
```

Achievement configuration must be data-driven.

Award record:

``` text
AchievementAward {
  id
  companyId
  achievementTypeId
  periodStart
  periodEnd
  userId
  rank
  score
  qualificationData
  awardedAt
}
```

`qualificationData` stores enough evidence to explain the result.

------------------------------------------------------------------------

# 41. Achievement Safety

Do not award based on manually editable leaderboard values.

Examples: - Most Deals uses validated DealWon events. - Most Showings
uses completed Showing records/events. - Sales Volume uses DealWon
monetary facts. - Breakthrough uses historical comparable periods.

Minimum sample thresholds are required for ratio-based categories.

------------------------------------------------------------------------

# 42. Documents / Storage

Storage abstraction:

``` ts
interface StorageProvider {
  put(...)
  getSignedUrl(...)
  delete(...)
}
```

Use private object storage.

Never expose predictable permanent public paths for private documents.

Document versioning is mandatory.

Personal Library and Company/CRM Documents must remain separate security
domains.

------------------------------------------------------------------------

# 43. Media

Property media pipeline:

``` text
source/captured file
 ↓
validation
 ↓
malware/content checks
 ↓
object storage
 ↓
metadata
 ↓
thumbnail/preview
 ↓
publication-ready reference
```

Publication uses stored copies.

Do not depend on temporary marketplace URLs.

------------------------------------------------------------------------

# 44. API Layer

Recommended structure:

``` text
Route Handler
 ↓
DTO validation
 ↓
Auth Context
 ↓
Authorization
 ↓
Application Command
 ↓
Domain
 ↓
Repository
 ↓
Event/Outbox
```

Use typed request/response contracts.

Do not expose ORM models directly as public API contracts.

------------------------------------------------------------------------

# 45. API Error Model

Use stable typed errors:

``` text
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
DUPLICATE
AMBIGUOUS_ENTITY
PHONE_NOT_REVEALED
PUBLICATION_CONFIRMATION_REQUIRED
EXTERNAL_SOURCE_UNAVAILABLE
RATE_LIMITED
INTEGRATION_DEGRADED
IDEMPOTENCY_REPLAY
```

Errors must not expose secrets or internal stack traces.

------------------------------------------------------------------------

# 46. Idempotency

Required for: - extension import; - publication confirmation; - webhook
handling; - collector ingestion; - event consumers; - billing
webhooks; - automation execution.

Use stable idempotency keys.

Duplicate delivery must not create duplicate: - Properties; - Deals; -
Publications; - Notifications; - achievements; - analytics facts.

------------------------------------------------------------------------

# 47. Queue Architecture

Workers should be independently deployable/scalable where practical.

Queues:

``` text
collector
matching
notifications
automation
analytics
publication
media
billing
```

Worker contract:

``` text
queued
→ running
→ success
```

or:

``` text
running
→ retrying
→ failed/dead-letter
```

Use exponential backoff.

------------------------------------------------------------------------

# 48. Dead Letter Handling

Every failed non-retryable or exhausted job must retain: - job ID; -
queue; - payload reference; - error code; - error message; - attempts; -
timestamps; - correlation ID.

Never expose raw secret-bearing payloads in operator dashboards.

------------------------------------------------------------------------

# 49. Observability

Every request should have: - requestId; - correlationId where
applicable.

Every distributed operation should propagate correlationId.

Metrics: - request latency; - DB latency; - queue latency; - worker
duration; - collector freshness; - publication success rate; - search
latency; - notification delivery; - matching throughput.

------------------------------------------------------------------------

# 50. Integration Health

Each marketplace adapter exposes health.

Track: - last successful collection; - parser errors; - mapping
errors; - rate limits; - source availability; - publication failures; -
schema/DOM drift.

Unsafe drift must disable affected operation rather than silently
producing wrong data.

------------------------------------------------------------------------

# 51. Security Requirements

Mandatory: - HTTPS/TLS; - secure sessions; - password hashing if local
authentication is used; - brute-force protection; - CSRF protection
where applicable; - secure cookies; - secret manager; - secret
rotation; - API authentication; - extension authentication; - least
privilege; - security event auditing.

Never: - store production credentials in Git; - print secrets to logs; -
trust client-supplied companyId; - trust frontend permissions; - trust
extension payloads blindly.

------------------------------------------------------------------------

# 52. Extension Security

Extension must: - restrict host permissions to supported domains; -
authenticate with KleeKto; - use versioned API contract; - validate
source page context; - minimize local storage; - never store long-lived
sensitive credentials unnecessarily; - never execute arbitrary remote
code; - never imitate native "show phone" action.

------------------------------------------------------------------------

# 53. Frontend Architecture

Use feature/domain-oriented UI composition.

Example:

``` text
features/
  opportunities/
  properties/
  clients/
  deals/
  messenger/
  documents/
  analytics/
  achievements/

components/
  entity-drawer/
  command-bar/
  contextual-actions/
  timeline/
  data-table/
  filters/
  cards/
```

Business state should not be duplicated unnecessarily across screens.

Server state should have one authoritative client data layer.

------------------------------------------------------------------------

# 54. UX Technical Rules

Primary patterns: - Today workspace; - contextual actions; - entity
drawer; - split view; - Command Bar; - shallow navigation.

Avoid: - deeply nested navigation; - duplicate forms; - repeated manual
data entry; - technical engine screens for ordinary agents; - KPI
overload on Today.

Each important entity should expose: - primary action; - secondary
actions; - history; - related entities.

## 54.1 Design System Engineering Contract

`KleeKto_Design_System_and_UX_Specification_v1.0.md` is binding for MVP
frontend implementation.

Technical requirements: - semantic CSS/design tokens; - centralized raw
visual values; - dark/light/system theme support; - reusable primitives
before page-local variants; - no business configuration hardcoded into
UI components; - keyboard/focus semantics in shared primitives; -
reduced-motion support; - responsive behavior; - RU/KA/EN overflow
testing; - explicit async/error/permission/conflict states; - visual and
interaction regression coverage for critical shared primitives where
practical.

KleeKto Purple is the brand/action accent. Semantic
success/warning/error roles remain separate.

The UI may optimize interaction depth but may not invent mutation paths.
Every state-changing UI action must resolve to an authorized domain
command defined by the API/domain contract.

Recommended frontend layering:

``` text
design tokens
  ↓
accessible UI primitives
  ↓
shared KleeKto patterns
  ↓
domain feature components
  ↓
route/workspace composition
```

Do not introduce a second page-local design system or uncontrolled
one-off colors, spacing, radii, shadows, typography or motion values.

------------------------------------------------------------------------

# 55. Today Query Model

Today should be a composed read model.

It should aggregate: - overdue Next Actions; - today actions; -
upcoming; - priority Opportunities; - relevant Matches; - team
requests; - compact market changes.

Today must not synchronously invoke every subsystem.

Use optimized read queries/read models.

------------------------------------------------------------------------

# 56. Analytics UI

Admin Analytics should support: - overview; - agents; - districts; -
market; - properties; - owners; - clients; - deals; - trends; -
drill-down; - period comparison.

Charts should be interactive.

Clicking an aggregate should resolve to source entities or filtered
records.

------------------------------------------------------------------------

# 57. Achievement UI

Agent-facing: - own awards; - public team rankings where permitted; -
progress to next award.

Admin-facing: - full ranking; - qualification evidence; - recalculation
status; - award history.

------------------------------------------------------------------------

# 58. Localization

MVP UI must support: - Russian; - Georgian; - English.

Normalize searchable aliases for: - district names; - property types; -
common real-estate terminology.

Do not store translated labels as the only canonical value.

Use stable enum/code values plus localized labels.

------------------------------------------------------------------------

# 59. Configuration

Data-driven configuration: - pipeline stages; - achievement types; -
notification rules/preferences; - automation rules; - source mappings
where appropriate; - company settings.

Do not hardcode business configuration in frontend components.

------------------------------------------------------------------------

# 60. Billing / Entitlements Foundation

MVP must keep: - Subscription; - Plan; - Entitlement; - Usage.

Separate: `feature available` from: `user permitted`.

Feature examples: - cloud collector; - marketplace publication; -
messenger; - automation; - advanced matching; - analytics.

Do not implement payment-provider-specific assumptions into core domain.

------------------------------------------------------------------------

# 61. Migration Strategy From Existing Codebase

Codex must not perform a blind rewrite.

Legacy migration must preserve epistemic truth:

- do not synthesize historical consent where no evidence exists;
- do not convert a legacy closed Property into a synthetic Deal Won;
- preserve original IDs, timestamps and provenance where possible;
- use explicit legacy/unknown state when a historical fact cannot be
  proven;
- phone collisions must resolve to candidate Owners and review, never a
  silent merge;
- applied production migrations are never edited in place.

A platform-scoped collector cache may deduplicate public marketplace
facts before tenant projection. It is infrastructure, not tenant CRM
state. Claims, contacts, consent, notes, archives, Clients, Deals and
other company work data must never be stored in or inferred across that
shared cache.



Required process:

### Step 1

Inventory existing: - routes; - models; - services; - APIs; - extension
code; - tests; - migrations.

### Step 2

Map current code to Frozen domains.

### Step 3

Classify: - KEEP - ADAPT - REPLACE - REMOVE - UNKNOWN

### Step 4

Resolve known legacy defects.

### Step 5

Implement domain contracts.

### Step 6

Migrate incrementally.

### Step 7

Remove duplicate/legacy paths only after replacement is verified.

Production database credentials or other exposed secrets found in old
artifacts must be rotated immediately and removed from all tracked
artifacts.

------------------------------------------------------------------------

# 62. Testing Contract

Minimum CI gates:

``` text
lint
typecheck
unit tests
integration tests
contract tests
build
critical E2E
security checks
```

## Domain tests

Must cover: - tenant isolation; - permissions; - owner resolution; -
opportunity conversion; - property dedupe; - multiple Deals; - showing
counting; - Next Action generation; - event creation; - automation
recursion protection; - publication confirmation; - achievement
calculation.

## Integration tests

Must cover: - PostgreSQL; - outbox; - event consumers; - storage; -
search; - worker retries.

## Contract tests

Must cover: - ss.ge adapter; - myhome.ge adapter; - extension API; -
publication mapping.

------------------------------------------------------------------------

# 63. Mandatory E2E Tests

## E2E-01 Market → CRM

``` text
Source observation
→ Opportunity
→ claim
→ contact
→ consent
→ import
→ Property
```

## E2E-02 Client → Deal

``` text
Client
→ Requirement
→ Match
→ Deal
→ Showing
→ Won
```

## E2E-03 Price Change

``` text
Property price change
→ Event
→ Audit
→ Matching
→ Notification
→ Next Action
→ Analytics
```

## E2E-04 Publication

``` text
Property
→ Publication
→ Extension
→ form fill
→ missing choice
→ human confirmation
→ Published
```

## E2E-05 Achievement

``` text
DealWon / ShowingCompleted
→ Analytics
→ ranking
→ award
```

## E2E-06 Security

``` text
Company A user
→ attempt Company B resource
→ FORBIDDEN
→ audit if sensitive
```

------------------------------------------------------------------------

# 64. Acceptance Tests for the Extension

### Import

Given: - supported marketplace; - valid listing; - revealed phone;

When: - user chooses "Добавить в KleeKto";

Then: - complete listing payload is captured; - import succeeds; -
Property is created/linked only after consent workflow; - media is
stored; - provenance is retained.

Given: - source phone is hidden; - no valid `MANUAL_AGENT_INPUT` evidence exists;

Then: - import is blocked; - user receives instruction to reveal it
natively or provide valid manual phone input; - extension never automates
native reveal.

### Publication

Given: - ready Property;

Then: - extension fills supported fields; - stored photos are used; -
missing human decisions are requested; - final publish requires human
confirmation.

------------------------------------------------------------------------

# 65. Analytics Acceptance Tests

The following must be reproducible from event-backed data:

-   total Opportunities;
-   total Properties;
-   agent sales;
-   sales volume;
-   commission;
-   showings;
-   conversion rates;
-   district inventory;
-   price trends;
-   source distribution;
-   owner conversion;
-   deal trends.

Historical result must remain correct after later editing of the
Property.

------------------------------------------------------------------------

# 66. Achievement Acceptance Tests

Example:

``` text
Agent A:
10 Won Deals
₾1,000,000 sales volume
20 completed Showings

Agent B:
12 Won Deals
₾800,000 sales volume
18 completed Showings
```

Expected:

``` text
Best Sales Volume → A
Most Deals → B
Most Showings → A
```

Tie handling must be deterministic and configurable.

Ratio-based awards require minimum sample thresholds.

Every award must have qualification evidence.

------------------------------------------------------------------------

# 67. Performance Targets

Initial engineering targets:

-   normal authenticated API p95: target \< 500 ms for simple reads;
-   simple search p95: target \< 500 ms;
-   standard CRUD p95: target \< 700 ms;
-   asynchronous heavy work must not block normal UI;
-   event consumers should normally process within seconds;
-   collector freshness must be observable.

Targets may be tuned after production measurements.

------------------------------------------------------------------------

# 68. Deployment

Three environments:

``` text
development
staging
production
```

Pipeline:

``` text
commit
→ CI
→ tests
→ build
→ staging
→ smoke
→ production
```

Use immutable deployment artifacts.

Migrations must be backwards-compatible during rolling deployment.

Use expand/contract for breaking schema changes.

------------------------------------------------------------------------

# 69. Feature Flags

Feature flags are separate from permissions.

Examples:

``` text
collector.ssge.enabled
collector.myhome.enabled
publication.ssge.enabled
publication.myhome.enabled
analytics.v2.enabled
achievement.engine.enabled
```

Flags may disable a broken integration without changing authorization.

A disabled required provider is not considered implemented for MVP
acceptance. Feature flags are safety controls, not a mechanism for
silently removing frozen scope.

For protected sources such as `myhome.ge`, KleeKto must not bypass
anti-bot or access-control mechanisms. Server-side collection/publication
may run only through a permitted and technically stable access path
(official API, partnership access, or another explicitly allowed
integration path). If unavailable, the capability remains feature-gated
and is a release blocker while it remains part of frozen MVP scope.

------------------------------------------------------------------------

# 70. Operational Kill Switches

Provide safe disablement for: - individual collector source; -
publication provider; - notification channel; - automation rule; -
matching worker; - problematic adapter version.

A kill switch must fail closed where data corruption is possible.

------------------------------------------------------------------------

# 71. Data Retention

Do not delete business history merely because: - Opportunity becomes
Property; - Deal is lost; - Publication is unpublished; - user leaves
company.

Retention policies for cancelled companies and personal documents must
be separately configured.

------------------------------------------------------------------------

# 72. Backup and Disaster Recovery

Required: - automated PostgreSQL backups; - PITR; - object-storage
durability strategy; - restore procedure; - periodic restore test; -
documented RPO/RTO targets.

A backup that has never been restored is not considered verified.

------------------------------------------------------------------------

# 73. Observability Dashboard

Platform operators should see:

``` text
API health
DB health
Queue health
Collector health
Marketplace adapter health
Publication health
Search health
Notification health
Matching health
Storage health
Analytics pipeline health
```

Company agents should not see raw infrastructure incidents.

------------------------------------------------------------------------

# 74. Definition of Done

A feature is not complete merely because its UI exists.

A feature is Done when: 1. domain rules exist; 2. server authorization
exists; 3. tenant isolation is tested; 4. transaction is correct; 5.
events are emitted; 6. audit is generated where required; 7. downstream
consumers work; 8. retries/idempotency are handled; 9. UI works; 10.
tests exist; 11. observability exists; 12. failure behavior is defined.

------------------------------------------------------------------------

# 75. Codex Operating Rules

Codex must:

1.  Read this document before implementation.
2.  Inspect the existing repository before modifying it.
3.  Preserve working functionality unless replacement is intentional.
4.  Never invent missing business rules silently.
5.  Never bypass authorization for convenience.
6.  Never write arbitrary cross-domain database mutations.
7.  Never silently merge ambiguous entities.
8.  Never silently publish externally.
9.  Never hide source provenance.
10. Never store secrets in code.
11. Never disable tests merely to make the build pass.
12. Never delete historical data to simplify implementation.
13. Prefer small reversible migrations.
14. Add tests for every new invariant.
15. Keep adapter-specific logic outside core domain.
16. Keep AI/Post-MVP features behind explicit extension points.
17. Report contradictions rather than guessing.
18. Treat security and tenant isolation as release blockers.

------------------------------------------------------------------------

# 76. Implementation Sequence

Codex should implement in dependency order:

``` text
1. Repository inventory
2. Foundation/auth/tenant/RBAC
3. DB/domain primitives
4. Event + Outbox + Audit
5. Source contracts
6. Collector
7. Opportunity Feed
8. Owner Resolution
9. Property/Source Listing
10. Client/Requirements
11. Search
12. Matching
13. Deal/Pipeline
14. Showing
15. Next Action
16. Notifications
17. Messenger
18. Documents/Media
19. Publication/Extension
20. Analytics
21. Achievements
22. Automation hardening
23. Observability
24. E2E/security/performance
25. Production release gates
```

Parallelization is allowed only where dependency contracts are already
stable.

------------------------------------------------------------------------

# 77. Final Technical Architecture

The canonical implementation graph is:

``` text
                        ┌───────────────┐
                        │  ss.ge /      │
                        │  myhome.ge    │
                        └───────┬───────┘
                                │
                         Marketplace Adapters
                                │
                         Cloud Collector
                                │
                        SourceObservation
                                │
                      Owner Verification
                                │
                                ▼
                         Opportunity
                                │
                           Agent Contact
                                │
                         Owner Consent
                                │
                                ▼
                           Property
                          /        \
                         /          \
                     Client        Owner
                       │
                 Requirements
                       │
                    Matching
                       │
                     Deal
                       │
                   Showings
                       │
                    Deal Won
                       │
                   Analytics
                       │
                 Achievements
```

Cross-cutting:

``` text
Domain Command
      ↓
Authorization
      ↓
Transaction
      ↓
Outbox/Event
      ↓
Event Bus
 ┌────┼────────┬─────────┬─────────┬─────────┐
 ▼    ▼        ▼         ▼         ▼         ▼
Audit Search Notifications Matching Automation Analytics
              │
              ▼
          Next Action
              │
              ▼
           Messenger
```

Publication:

``` text
Property
   ↓
Publication
   ↓
Extension
   ↓
Marketplace
```

------------------------------------------------------------------------

# 78. Final Engineering Contract

The implementation is correct only if these three end-to-end paths work
without architectural shortcuts:

### Market-to-Revenue

``` text
Collector
→ Opportunity
→ Owner
→ Contact
→ Consent
→ Property
→ Client
→ Match
→ Showing
→ Deal
→ Analytics
→ Achievement
```

### Event-to-Action

``` text
Domain Event
→ Audit
→ Notification
→ Next Action
→ Messenger
→ Analytics
```

### Property-to-Marketplace

``` text
Property
→ Publication
→ Extension
→ ss.ge / myhome.ge
→ human confirmation
→ external reference
→ audit/analytics
```

The implementation must preserve the core invariant:

> **KleeKto is an event-driven, multi-tenant real-estate operating
> system whose authoritative business state lives in the domain
> database, whose history is immutable, whose integrations are isolated
> behind adapters, and whose analytics and future intelligence are
> derived from preserved business facts.**

This document is the technical implementation baseline for Codex.
