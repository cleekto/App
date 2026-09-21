# KleeKto --- Frozen MVP 1.0 Master Specification

**Document status:** FROZEN\
**Version:** 1.0\
**Purpose:** Single product/architecture source of truth for
implementation of KleeKto MVP 1.0.

------------------------------------------------------------------------

## 1. Executive Definition

KleeKto is a multi-tenant real-estate CRM / operating system for
Georgian real-estate agencies.

The core operating model is:

> KleeKto continuously collects market listings, identifies
> source-verified owner listings, presents them as Opportunities, helps
> agents contact owners, converts only owner-approved opportunities into
> CRM Properties, matches Properties to Client Requirements, manages
> Showings and Deals, and records the complete business history for
> analytics and future intelligence.

The MVP is intentionally designed as a scalable platform rather than a
collection of isolated screens.

### 1.1 Core boundary

**Market layer:**

`Source → Observation → Opportunity → Owner contact`

**CRM layer:**

`Consent → Property → Client/Requirement → Match → Showing → Deal`

**System layer:**

`Domain Command → Event → Audit / Notification / Next Action / Matching / Search / Analytics / Automation`

**Publication layer:**

`Property → Publication → Extension → ss.ge / myhome.ge`

------------------------------------------------------------------------

# 2. Frozen MVP Scope

## 2.1 Included

### Market

-   ss.ge adapter
-   myhome.ge adapter
-   cloud collector
-   source observations
-   owner/source-verified indicator
-   Opportunity entity
-   shared Opportunity Feed
-   soft claims
-   team contact markers
-   archive/restore
-   price-change history
-   source snapshots

### CRM

-   Company
-   User/Team
-   Owner
-   Property
-   Source Listing
-   Client
-   Client Requirements
-   Matching
-   Deal
-   configurable Deal pipeline
-   Showing events
-   Next Action

### Communication

-   internal Messenger
-   CRM cards in messages
-   notifications
-   subscriptions/preferences
-   action-oriented notifications

### Data/System

-   Domain Events
-   Event Bus
-   Audit Log
-   Business History
-   provenance
-   Entity Resolution
-   deduplication
-   Global Search
-   structured Property Search

### Documents

-   Personal Library
-   Company Library
-   CRM Documents
-   media
-   versions
-   sharing
-   private object storage

### Publication

-   Publication entity
-   publication lifecycle
-   Chrome Extension
-   ss.ge publication adapter
-   myhome.ge publication adapter
-   stored property photos
-   automated form filling
-   human confirmation before final publication

### Intelligence/Management

-   company-wide Admin Analytics
-   historical/time-series analytics
-   agent performance analytics
-   district analytics
-   market analytics
-   Achievement/Recognition Engine
-   eight MVP award categories
-   rankings and medals

### Platform

-   RBAC
-   multi-tenancy
-   subscription/entitlement foundation
-   observability
-   queue/workers
-   retries
-   incident model
-   security controls
-   CI/CD
-   Development/Staging/Production
-   backups/PITR/restore procedures

------------------------------------------------------------------------

## 2.2 Explicitly not required as full MVP functionality

Architecture must permit later addition of: - AI assistant - predictive
analytics - predictive pricing - AI matching -
OpenSearch/Elasticsearch - no-code automation builder - external API
ecosystem - WhatsApp/Telegram adapters - advanced telephony - advanced
document generation - additional marketplaces

These are extension points, not MVP dependencies.

------------------------------------------------------------------------

# 3. Architectural Principles

1.  **Company is the tenant.**
2.  **Identity, permission, role and ownership are separate concepts.**
3.  **Opportunity is not Property.**
4.  **Property is not Source Listing.**
5.  **Owner is a first-class entity.**
6.  **Client Requirements are first-class entities.**
7.  **One Property can have multiple Deals.**
8.  **One Client can have multiple Deals.**
9.  **Showing is an event, not necessarily a pipeline stage.**
10. **Next Action is the central operational mechanism for "what happens
    next".**
11. **Business changes occur through Domain Commands.**
12. **Commands emit immutable Domain Events.**
13. **Consumers react to Events; modules do not directly orchestrate one
    another.**
14. **History belongs to the company, not to an individual agent.**
15. **Source provenance must never be destroyed by CRM edits.**
16. **No silent destructive merge.**
17. **No silent final publication.**
18. **Frontend authorization checks are UX only; server-side
    authorization is authoritative.**
19. **Search is not Matching.**
20. **Analytics is not the transactional source of truth.**
21. **All important workflows must be idempotent.**
22. **External systems are isolated behind adapters.**
23. **Technical failures in external integrations must not bring down
    core CRM.**
24. **Every critical operation is auditable.**
25. **Every future AI feature must be able to trace its result back to
    source facts.**

------------------------------------------------------------------------

# 4. High-Level System Architecture

``` text
                    ┌─────────────────────────────┐
                    │        MARKET SOURCES       │
                    │       ss.ge / myhome.ge    │
                    └──────────────┬──────────────┘
                                   │
                              Cloud Collector
                                   │
                          Source Adapters
                                   │
                          Normalization Layer
                                   │
                         Owner Verification
                                   │
                                   ▼
                         ┌─────────────────┐
                         │   OPPORTUNITY   │
                         └────────┬────────┘
                                  │
                              Agent Contact
                                  │
                           Owner Consent
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    PROPERTY     │
                         └───────┬─────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
                  CLIENT                 OWNER
                     │
               REQUIREMENTS
                     │
                     ▼
                  MATCHING
                     │
                     ▼
                  SHOWING
                     │
                     ▼
                   DEAL
                     │
                     ▼
                 ANALYTICS
                     │
                     ▼
               ACHIEVEMENTS
```

Cross-cutting architecture:

``` text
Domain Command
      ↓
Authorization
      ↓
Transaction
      ↓
Domain Event
      ↓
Event Bus
 ┌────┼─────┬──────────┬──────────┬──────────┐
 ▼    ▼     ▼          ▼          ▼          ▼
Audit Notifications NextAction Matching    Search Analytics
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
ss.ge / myhome.ge
```

------------------------------------------------------------------------

# 5. Core Domain Model

## 5.1 Company

Represents a tenant.

Minimum fields: - id - name - status - createdAt - updatedAt

Lifecycle: `TRIAL | ACTIVE | SUSPENDED | CANCELLED | DELETED`

------------------------------------------------------------------------

## 5.2 User

Minimum fields: - id - companyId - identity reference - name - email -
status - role/role assignments - createdAt - updatedAt

MVP roles: - Admin - Manager - Agent - Viewer

Authorization must be permission-based.

------------------------------------------------------------------------

## 5.3 Opportunity

Represents a market opportunity originating from a source listing.

Minimum data: - id - companyId - source - sourceListingId - sourceUrl -
sourceSnapshot - ownerIndicator - normalized property facts - price -
location - views - firstSeenAt - lastSeenAt - lastPriceChangeAt -
lifecycle/status - claimedBy - claimedAt - contact marker/history -
archivedBy / archivedAt where applicable

Rules: - Only source-owner-verified listings enter the company
Opportunity Feed. - Opportunity does not automatically become
Property. - Opportunity remains as provenance/history after
conversion. - Off-market is preferred to hard deletion.

------------------------------------------------------------------------

## 5.4 Owner

Minimum: - id - companyId - name - phones - emails - source references -
notes - status - timestamps

Resolution: - phone - email - source owner ID - supporting evidence

Name alone must not silently merge owners.

One Owner may have multiple Opportunities, Properties, Deals and
interactions.

------------------------------------------------------------------------

## 5.5 Source Listing

Represents an external marketplace representation.

Minimum: - id - provider - externalId - url - raw/normalized snapshot -
firstSeenAt - lastSeenAt - current status - linked Property where
resolved

Source Listing is not the physical Property.

------------------------------------------------------------------------

## 5.6 Property

Represents a company CRM object after owner consent.

Minimum: - id - companyId - responsibleAgentId - ownerId - property
type/subtype - rooms - area - price - currency - address/location -
district - condition - characteristics - title - description - media
references - source references - lifecycle/status - timestamps

Property stores: 1. original/source snapshot; 2. current working CRM
data; 3. provenance/history.

All business fields are editable subject to permissions and audit.
Unusual material changes should warn rather than silently destroy
provenance.

------------------------------------------------------------------------

## 5.7 Client

Minimum: - id - companyId - contact data - responsible agent -
lifecycle/status - notes - timestamps

A Client can have multiple Requirements and multiple Deals.

------------------------------------------------------------------------

## 5.8 Client Requirement

Separate entity.

Supports: - must-have criteria - nice-to-have criteria - min/max price -
min/max area - rooms - district/subdistrict - property type -
exclusions - characteristics - lifecycle - active/inactive dates

------------------------------------------------------------------------

## 5.9 Deal

Links:

`Client × Property × Responsible Agent`

Minimum: - id - companyId - clientId - propertyId - responsibleAgentId -
stage - price - commission - openedAt - closedAt - outcome - timestamps

One Property may have many Deals. One Client may have many Deals.

------------------------------------------------------------------------

## 5.10 Showing

A business event/entity associated with a Deal.

Minimum: - id - companyId - dealId - propertyId - clientId - agentId -
scheduledAt - completedAt - result - notes

Showing count is derived from completed Showings.

------------------------------------------------------------------------

## 5.11 Next Action

Central operational object.

Minimum: - id - companyId - owner/assignee - type - priority - dueAt -
status - linked entity - generatedBy - source event - timestamps

Examples: - call owner - callback - contact client - reply to
colleague - schedule showing - request property - follow up on Deal

------------------------------------------------------------------------

# 6. Event Architecture

The canonical event envelope and complete event vocabulary are defined by
`KleeKto_Event_Catalog_and_Event_Contracts_v1.0.md`.

Canonical envelope:

``` text
Event {
  id
  type
  schemaVersion
  companyId
  actor {
    type
    id?
  }
  entity {
    type
    id
  }
  occurredAt
  source
  correlationId
  causationId?
  idempotencyKey?
  payload
  metadata?
}
```

Canonical actor types:

``` text
AGENT
MANAGER
ADMIN
VIEWER
PLATFORM_ADMIN
SYSTEM
CLOUD_COLLECTOR
EXTENSION
AUTOMATION
INTEGRATION
```

Events are append-only. Corrections create new events; historical events
are never edited or deleted.

Event names are lowercase past-tense facts. Representative MVP events
include:

``` text
source.observed
source.changed
opportunity.created
opportunity.updated
opportunity.claimed
opportunity.claim_released
opportunity.contact_recorded
opportunity.consent_confirmed
opportunity.converted
opportunity.archived
opportunity.restored
owner.created
property.created
property.updated
property.price_changed
property.archived
property.restored
client.created
client_requirement.created
client_requirement.updated
match.created
match.invalidated
deal.created
deal.stage_changed
deal.won
deal.lost
showing.scheduled
showing.completed
next_action.created
next_action.completed
next_action.overdue
message.sent
message.read
message.reaction_added
crm_card.shared
notification.created
notification.delivered
notification.read
publication.prepared
publication.confirmed
publication.published
publication.failed
publication.unpublished
security.authorization_denied
```

The Event Catalog is authoritative if a representative list in this
product-level document is incomplete.

------------------------------------------------------------------------

# 7. Audit and Business History

Two related but distinct concepts.

## Audit

Answers:

> Who changed what, when, and through which source?

Must support: - actor - timestamp - action - before/after - source -
entity - correlationId - authorization result

Sensitive denied actions are audited.

## Business History

Answers:

> What happened to this business object?

Examples: - owner contacted - consent obtained - price reduced - match
created - showing completed - deal won

Each entity exposes a Unified Timeline.

Filters: - All - Calls/Interactions - Changes - Messages - Deals -
System

History is company-owned and append-only.

------------------------------------------------------------------------

# 8. Opportunity Feed

One shared company feed.

Default: - all source-owner-verified opportunities.

Filters: - new - views - price changed - age - available - in work -
contacted - archived - source - location - property type

Card must prominently show: - owner verification - source - original
description - photos - key parameters - price - views - age -
contact/team marker - current work status - primary actions

Original description must not be hidden because it may contain owner
instructions such as "agents do not call".

------------------------------------------------------------------------

# 9. Claiming and Team Contact

Claim is a soft operational lock.

State: - available - in work - released/expired

Other agents can see: - responsible/in-work agent - timestamp/activity

Claim is not ownership.

Team contact marker: - appears when a company agent has contacted the
owner; - temporary visible marker; - full contact history remains
permanently; - exact cooldown is configurable.

Archive is personal to the archiving agent and does not remove the
Opportunity from other agents' feeds.

------------------------------------------------------------------------

# 10. Extension Architecture

Chrome Extension is mandatory MVP.

Supported domains: - ss.ge - myhome.ge

Context menu MVP: 1. Добавить в KleeKto 2. Опубликовать объявление 3.
Добавить заметку 4. Напомнить

## 10.1 Import

Workflow:

``` text
Source listing
 → extension validates domain
 → obtains human-provided phone evidence
 → captures source data
 → sends authenticated import command
 → server validates evidence and source
 → resolves Owner
 → resolves/deduplicates Property
 → creates/links Property
 → stores provenance
 → emits events
```

Accepted phone evidence modes are:

``` text
REVEALED_ON_SOURCE
MANUAL_AGENT_INPUT
```

`REVEALED_ON_SOURCE` means the human used the marketplace's native
interface to reveal the number and the extension captured that visible
state. `MANUAL_AGENT_INPUT` means the human explicitly entered a phone
number obtained from the owner or another legitimate human interaction.

The extension must never imitate, automate, or synthesize the
marketplace's native "show phone" action.

If neither valid evidence mode exists, import is blocked.

## 10.2 Publication

Extension: - receives prepared publication data; - fills marketplace
forms; - selects categories/options; - uploads stored copies of Property
media; - asks human where required; - reaches final confirmation
state; - never silently performs final publication.

Minimal extension permissions and strict domain allowlist are mandatory.

------------------------------------------------------------------------

# 11. Search Engine

One search layer for: - Property - Client - Owner - Opportunity - Deal -
Next Action - future Publication/Showing/Interaction/Documents

MVP provider: - PostgreSQL full-text search - pg_trgm - normalized
fields

Abstract interface:

`SearchProvider`

Future OpenSearch/Elasticsearch replacement must not require domain
rewrites.

Search supports: - partial/fuzzy matching - Russian - Georgian -
English - aliases and normalized locations - structured filters -
transparent ranking - permission filtering before display

Structured examples: - `3 rooms Saburtalo` - `до 150000` - `86 м²`

Search results always resolve to authoritative domain records.

Search ≠ Matching.

------------------------------------------------------------------------

# 12. Matching Engine

MVP is deterministic/rule-based.

Runs when: - Property is created; - relevant Property data changes; -
price changes; - Client Requirement is created/changed.

Produces: - match record - matched criteria - explanation

Example: - district matched - rooms matched - price range matched - area
matched

If responsible agent differs from requesting agent: - preserve
ownership; - allow collaboration request; - do not reassign
automatically.

Architecture must allow AI ranking later.

------------------------------------------------------------------------

# 13. Deal and Pipeline

Pipeline stages are configurable.

Managers can: - add - remove - rename - reorder

No stage names are hardcoded into business logic.

Showing is not required to be a permanent stage.

Every stage transition emits an event.

Won/Lost retains full history.

------------------------------------------------------------------------

# 14. Today Workspace

Primary agent screen.

Contains: - current date/greeting - overdue/today/upcoming counts -
global search - priority Next Actions - Opportunity highlights - company
requests/matches - team items - compact market summary

Design principle:

> The system should tell the agent what to do next.

KPI overload is prohibited on the main agent screen.

------------------------------------------------------------------------

# 15. UX / Application Shell

Primary navigation:

-   Today
-   Opportunities
-   Properties
-   Clients
-   Deals
-   Messenger
-   Documents
-   Analytics (authorized users only)
-   Settings

Global: - Command Bar / Ctrl+K - Notifications - user context

Preferred interaction patterns: - contextual actions - entity drawers -
split views - one-click actions - minimal navigation depth

Every screen should have one obvious primary next action.

Technical engines such as Audit, Matching, Automation and Event Bus are
not separate user-facing menu items.

## 15.1 MVP Design Quality Contract

Premium product-grade design is part of MVP 1.0, not a post-MVP polish
phase.

The binding visual/interaction contract is defined in
`KleeKto_Design_System_and_UX_Specification_v1.0.md`.

MVP UI must therefore use: - a token-driven design system; - the
binding Primary Visual Direction defined by
`KleeKto_Design_System_and_UX_Specification_v1.0.md`: a dark-first
premium PropTech operating-terminal expression with near-black/graphite
surfaces, high information density, thin precise borders, compact
high-legibility typography, KleeKto Purple as the controlled
brand/action accent, and restrained functional purple/violet glow; -
first-class dark, light and system themes, with dark as the primary
brand-expression and visual-QA baseline while light preserves the same
hierarchy, density and premium character; - contextual actions; - entity
drawers/split views; - keyboard-accessible core workflows; - explicit
loading/empty/error/denied/conflict states; - restrained functional
motion; - responsive behavior; - RU/KA/EN visual QA; - accessibility
target WCAG 2.2 AA for applicable critical web workflows.

Generic white/light SaaS admin-template styling, KPI-card walls,
excessive neon/glow/gradients, glassmorphism-heavy treatment, and
card-per-section composition are not acceptable as the dominant MVP
visual language. This paragraph refines visual implementation only and
does not alter any domain, API, event, RBAC, consent, provenance,
publication, tenant-isolation, or audit contract.

Design must not add or bypass domain commands, permissions, consent,
publication confirmation, provenance, tenant isolation or audit rules.

------------------------------------------------------------------------

# 16. Messenger

MVP internal messenger supports: - company-wide chat - personal/group
chats - CRM-context conversations - text - images/files - unread state -
mentions - replies - reactions - pinned messages - CRM cards -
Property/Client/Deal links - creating/suggesting Next Action from chat

Messenger is separate from Notifications.

Notifications can link into Messenger where appropriate.

------------------------------------------------------------------------

# 17. Notifications

Architecture:

`Domain Event → Notification Engine → Preferences/Rules → Channel`

Supports: - company-wide - personal - subscriptions/follows - priority -
grouping/deduplication - in-app - push/sound foundation

Notifications should be action-oriented.

Bad: \> Price changed.

Good: \> Price reduced by \$10,000. Property now matches 4 clients.

Business modules emit events; they do not directly send notifications.

------------------------------------------------------------------------

# 18. Documents and Media

Three distinct storage concepts:

### CRM Media

Property/Opportunity photos, videos, media.

### CRM Documents

Business documents linked to Owner/Client/Property/Deal.

### Personal Library

Agent-private: - contracts - templates - PDFs - DOCX/XLSX -
legislation - notes - images

Personal Library is private by default.

Sharing or attaching a document to a business entity is explicit.

Documents retain versions and audit.

Storage abstraction:

`StorageProvider`

Private object storage + signed URLs.

Property media pipeline:

`Original → Validate → Store → Thumbnail/Preview → Original`

Stored copies are reused for publication.

------------------------------------------------------------------------

# 19. Automation Engine

Architecture:

`Event → Rule → Condition → Action → Event`

Scopes: - SYSTEM - COMPANY - TEAM - USER

MVP actions: - CREATE_NEXT_ACTION - SEND_NOTIFICATION - CREATE_MATCH -
SEND_INTERNAL_MESSAGE - CHANGE_STATUS - ASSIGN_AGENT - ADD_TAG -
ARCHIVE - RESTORE

Rules must invoke authorized Domain Commands rather than arbitrary
database updates.

Required safeguards: - eventId - correlationId - idempotency - execution
depth - maximum chain depth - duplicate action protection -
retry/failure history - dead-letter handling

Human-in-the-loop required for risky operations such as publication,
merge, reassignment and destructive actions.

------------------------------------------------------------------------

# 20. Analytics Engine

Analytics is a separate user-facing page.

Full company analytics requires `analytics.company.read_full`. It is
normally granted to Company Admin and may be granted to a designated
main Manager. Ordinary Agents and Viewers are denied by default. Team or
limited analytics require their own explicit permissions.

Architecture:

`Domain Events → Analytics Pipeline → Historical/Time-Series Models → Analytics UI`

Analytics is read-oriented and must not become the transactional source
of truth.

## 20.1 MVP analytics

### Market

-   Opportunity volume
-   new opportunities
-   owner-verified volume
-   source distribution
-   price changes
-   listing age
-   views
-   districts
-   property types
-   rooms
-   areas
-   price/m²
-   supply trends

### Owner

-   unique owners
-   new owners
-   contacted owners
-   consent rate
-   repeat owners
-   properties per owner

### Agents

Per-agent: - opportunities processed - contacts - owner agreements -
Properties created - clients - matches - showings - deals - won/lost -
sales volume - commission - average deal - conversion rates - speed
metrics - overdue actions - performance by district/type/source

### Geography

-   inventory
-   demand
-   average/median price
-   price/m²
-   changes over time
-   transactions
-   speed of sale

### Trends

Historical time series are mandatory.

### Drill-down

Every important aggregate should be traceable to underlying records.

Supported comparison periods: - day - week - month - quarter - year -
custom range

Analytics must be structured so future predictive models can be trained
on historical facts without reconstructing lost history.

------------------------------------------------------------------------

# 21. Achievement / Recognition Engine

MVP includes eight award categories.

1.  Best Sales Volume
2.  Most Deals
3.  Most Showings
4.  Best Conversion
5.  Fastest Response
6.  Best Deal Closing
7.  Agent of the Month
8.  Breakthrough of the Month

Rankings: - Gold / 1st - Silver / 2nd - Bronze / 3rd

Periods: - week - month - quarter - year

Main recognition period: - monthly

Requirements: - objective event-backed calculations; - minimum sample
sizes where required; - no manual result editing without audit; -
immutable award history; - configurable achievement types; -
medal/badge/sticker representation; - "distance to next achievement"
guidance.

Achievement calculation should be based on validated analytics/business
data, not user-entered ranking values.

------------------------------------------------------------------------

# 22. File and Data Provenance

Every externally sourced business record should preserve: - source -
source ID - source URL - capturedAt - original snapshot -
transformation/provenance where relevant

CRM edits create history; they do not overwrite the existence of the
original source facts.

The system must distinguish: - source fact - normalized fact - current
CRM value - derived analytical value - AI interpretation (future)

### 22.1 Legacy migration truthfulness

Migration/backfill must never manufacture historical business facts.
In particular:

- a legacy closed Property must not be converted into a synthetic
  `Deal Won` without evidence;
- missing consent evidence must remain unknown / legacy-unverified and
  must not be backfilled as a synthetic consent event;
- preserved legacy timestamps and source records remain attributable to
  their original provenance;
- ambiguous identity collisions are reviewed rather than silently
  merged.

------------------------------------------------------------------------

# 23. Entity Resolution and Deduplication

## Owner

Strong identifiers: - phone - email - source owner ID

Ambiguous matches: - propose duplicate; - do not silently merge.

## Property

Property represents physical object.

Source listings represent external representations.

Candidate duplicate matching may use: - normalized address - coordinates
where available - source references - price - area - rooms - media
fingerprints - owner relationship

Automatic merge is allowed only at high confidence and must remain
auditable.

All merges record: - mergedFrom - mergedInto - actor - timestamp -
reason/confidence

------------------------------------------------------------------------

# 24. Security and Permissions

Tenant isolation: - every tenant-scoped entity has companyId; -
companyId derived from authenticated context.

Authorization: - server-side policy service; - permission-based; -
frontend checks are advisory only.

Permission identifiers are defined canonically by
`KleeKto_Authorization_and_RBAC_Specification_v1.0.md`. Product-level
examples include `property.update_own`, `property.update_company`,
`publication.prepare`, `publication.confirm`, `collaboration.request`,
`deal.update_own`, `deal.update_company`, `next_action.manage_own`,
`next_action.manage_company`, `analytics.company.read_full`,
`document.upload`, `audit.read`, and `billing.manage`.

Critical actions must be audited, including denied sensitive actions.

Secrets: - never in source code; - never in Git; - never in logs; -
environment-specific; - rotatable.

Extension: - minimal permissions; - authenticated API; - short-lived
credentials where possible; - version validation; - no excess local
storage.

------------------------------------------------------------------------

# 25. Integration Architecture

External systems are behind adapters.

Marketplace adapters: - `SsGeAdapter` - `MyHomeAdapter`

Core knows domain contracts, not marketplace DOM.

Adapter responsibilities: - source parsing - normalization -
source-specific field mapping - publication field mapping - health
checks - contract tests - versioning - rate limiting

Cloud Collector and Extension may reuse adapters but have different
responsibilities.

Webhook Gateway: - authentication/signature validation - normalization -
idempotency

Polling fallback where needed.

External failures must degrade gracefully.

------------------------------------------------------------------------

# 26. Collector Architecture

Cloud Collector is 24/7, restartable and observable.

Per source: - scheduler - worker - adapter - parser - normalizer - owner
indicator extractor - dedupe - change detector - persistence -
checkpointing

Metrics: - last successful run - pages processed - listings observed -
opportunities created - opportunities updated - price changes -
failures - parse errors - rate limits - source availability

Source schema/DOM drift: - detect; - stop unsafe transformation; -
create incident; - do not corrupt CRM data.

Collection must respect applicable source rules, rate limits and
legal/ToS constraints.

Architecture must permit API/partnership replacement of scraping where
required.

### 26.1 Shared market storage boundary

The implementation may use a platform-scoped shared collector cache for
public marketplace facts in order to avoid redundant external fetching.
That infrastructure cache is not a tenant CRM object and must never
contain company-private claim, contact, consent, notes, archive, client,
deal, or other tenant work state.

The canonical company domain remains tenant-scoped: Opportunities and
all company work history are isolated by `companyId`. If shared market
facts are projected into company `SourceListing` / `SourceObservation`
records, the projection preserves source provenance and may not import
another company's private activity.

### 26.2 Protected-source rule

KleeKto must not bypass anti-bot, access-control, or other technical
protections. For `myhome.ge`, server-side collection/publication remains
feature-gated until a permitted and technically stable path exists
(e.g. official API, partnership access, or another explicitly allowed
integration path). Browser-assisted human workflows do not count as a
replacement for the mandatory cloud collector. If an MVP-required
provider cannot be operated lawfully and reliably, that capability is a
release blocker rather than silently removed from scope.

------------------------------------------------------------------------

# 27. Publication Architecture

Publication is a separate entity.

Lifecycle:

`DRAFT → PREPARING → READY → FILLING → AWAITING_CONFIRMATION → PUBLISHED`

Failure: `FAILED`

Removal: `UNPUBLISHED`

One Property can have multiple Publications.

Property changes can mark Publication as needing synchronization.

Automatic external updates are not enabled by default without
confirmation.

Stored Property media must be reused; the system must not depend on
re-downloading expiring source URLs.

------------------------------------------------------------------------

# 28. Observability and Reliability

Distinguish: - logs - metrics - traces - domain events - business events

Use: - request ID - correlation ID - causation ID

Health: - liveness - readiness - functional health

Worker states: - queued - running - success - failed - retrying -
dead-letter

Error policy: - retryable vs non-retryable - exponential backoff -
bounded retries

Incidents: - INFO - WARNING - ERROR - CRITICAL

Statuses: - OPEN - INVESTIGATING - MITIGATED - RESOLVED

Platform alerts are separate from company/user notifications.

------------------------------------------------------------------------

# 29. Deployment and Infrastructure

Environments: - Development - Staging - Production

Flow:

`Commit → CI → Tests → Build → Staging → Smoke Tests → Production`

Database: - PostgreSQL - transactional source of truth - safe
expand/contract migrations - no manual production schema edits

Queues/workers: - Collector - Matching - Notifications - Automation -
Analytics - Publication - Media - Billing

Object storage: - private - signed URLs - optional CDN for permitted
media

Production: - least-privilege access - temporary privileged access -
audit - backups - PITR - restore tests - disaster recovery

Feature flags are separate from permissions.

------------------------------------------------------------------------

# 30. API and Command Principles

External/API requests must not directly mutate arbitrary models.

Pattern:

`Request → Authentication → Tenant Context → Authorization → Domain Command → Transaction → Event`

Examples:

`ClaimOpportunity`

`ImportSourceListing`

`CreateProperty`

`ChangePropertyPrice`

`CreateClient`

`CreateRequirement`

`CreateMatch`

`CreateDeal`

`ScheduleShowing`

`CompleteShowing`

`CreateNextAction`

`PublishProperty`

`RequestCooperation`

Commands: - validate invariants; - authorize; - execute transaction; -
emit event(s); - return authoritative result.

Idempotency is required for externally retried commands.

API is versioned: - `/api/v1` - future breaking changes via `/api/v2`

------------------------------------------------------------------------

# 31. Transaction and Consistency Rules

Transactional database state is authoritative.

A Domain Command that changes core state must atomically persist: 1.
state change; 2. domain event/outbox record.

Consumers process events asynchronously.

Required pattern:

`DB Transaction → Outbox → Event Bus → Consumers`

This prevents successful database changes from losing their
corresponding event.

Consumers must be idempotent.

Cross-module side effects must not require distributed database
transactions.

------------------------------------------------------------------------

# 32. Analytics Data Contract

Analytics consumers must receive stable event contracts.

For each event, analytics should preserve: - event ID - event
timestamp - company - actor - entity - event type - source - relevant
numeric facts - dimensions required for later grouping

Historical facts must not be recalculated solely from current mutable
entity state when the original event contains the historical value.

Example:

A Deal Won event should preserve the relevant: - closing price -
commission - property - district - agent - client - date

so future analytics remain correct even if the Property is later edited.

------------------------------------------------------------------------

# 33. Performance Requirements

The UI must remain responsive while heavy work is asynchronous.

Asynchronous candidates: - Collector - Matching - Notifications -
Automation - Analytics aggregation - Media processing - Publication
preparation

Search should have predictable latency.

Performance monitoring: - P50 - P95 - P99

Database, queue and worker performance must be observable.

------------------------------------------------------------------------

# 34. Testing Strategy

## Unit

-   domain rules
-   parsers
-   normalization
-   calculations
-   permissions
-   achievement formulas
-   matching rules

## Integration

-   DB
-   Event/Outbox
-   Search
-   storage
-   adapters
-   workers

## Contract

-   ss.ge parser contracts
-   myhome.ge parser contracts
-   publication mappings
-   extension/server contracts

## E2E critical paths

### Market-to-CRM

`Collect → Opportunity → Claim → Contact → Import → Property`

### Client-to-Deal

`Client → Requirement → Match → Showing → Deal Won`

### Publication

`Property → Publication → Extension → Form Fill → Human Confirm → Published`

### Event-driven

`Domain Change → Event → Audit → Notification → Next Action`

### Analytics

`Deal/Showing/Opportunity Events → Analytics → Admin Dashboard`

### Achievement

`Validated Business Results → Ranking → Award`

### Security

-   tenant isolation
-   unauthorized reads/writes
-   permission denial
-   extension authentication
-   sensitive action audit

------------------------------------------------------------------------

# 35. Data Integrity Invariants

The following are non-negotiable:

1.  No cross-company entity access.
2.  Opportunity cannot become Property without the required
    owner-consent workflow.
3.  Import requires valid human-provided phone evidence:
    `REVEALED_ON_SOURCE` or `MANUAL_AGENT_INPUT`; hidden phone without a
    valid manual input blocks import.
4.  Source provenance cannot be destroyed by editing.
5.  Ambiguous Owner duplicates are not silently merged.
6.  Ambiguous Property duplicates are not silently merged.
7.  Claim is not ownership.
8.  Responsible Agent is separate from Owner.
9.  Property may have multiple Deals.
10. Client may have multiple Deals.
11. Showing is not required to be a pipeline stage.
12. History is append-only.
13. Critical actions are auditable.
14. Automation cannot bypass domain authorization.
15. Publication cannot silently finalize.
16. Analytics cannot mutate transactional domain state.
17. Achievement rankings cannot be based on unverifiable manual values.
18. External integration failure cannot corrupt core CRM state.
19. Event consumers must tolerate duplicate delivery.
20. Search index is never the source of truth.

------------------------------------------------------------------------

# 36. Primary End-to-End Scenarios

## Scenario A --- New market opportunity

``` text
Collector
→ source observation
→ owner verification
→ dedupe
→ Opportunity
→ Opportunity Feed
```

No Property is created.

## Scenario B --- Agent takes opportunity

``` text
Agent claims
→ opportunity.claimed
→ Audit
→ team marker
→ Next Action
```

## Scenario C --- Owner agrees

``` text
Agent contacts owner
→ opportunity.contact_recorded
→ opportunity.consent_confirmed
→ Import
→ Owner Resolution
→ Property Resolution
→ Property Created/Linked
→ Audit
→ Matching
→ Search
```

## Scenario D --- Property matches client

``` text
Property Created/Changed
→ Matching
→ Match Created
→ responsible agent notification
→ optional Next Action
→ collaboration if another agent owns Property
```

## Scenario E --- Showing

``` text
Deal
→ Schedule Showing
→ Showing Completed
→ Event
→ History
→ Analytics
→ Next Action
```

## Scenario F --- Deal won

``` text
Deal Won
→ immutable event
→ Analytics
→ achievement recalculation
→ leaderboard
→ award history
```

## Scenario G --- Price reduction

``` text
Change Price
→ property.price_changed
→ Audit
→ Matching
→ Search update
→ Notification
→ Next Action
→ Analytics
```

## Scenario H --- Publication

``` text
Property
→ Publication DRAFT
→ PREPARING
→ READY
→ Extension
→ form fill
→ missing choices requested
→ AWAITING_CONFIRMATION
→ human confirms
→ PUBLISHED
→ external reference
→ Audit
→ Analytics
```

------------------------------------------------------------------------

# 37. MVP Acceptance Criteria

MVP is not considered complete unless all of the following work:

### Market

-   collector can ingest supported sources;
-   only owner-verified listings enter Opportunity Feed;
-   duplicate source observations do not create duplicate Opportunities;
-   price history is preserved;
-   off-market state is preserved.

### Agent workflow

-   agent can claim;
-   agent can contact;
-   hidden source phone without valid `MANUAL_AGENT_INPUT` evidence blocks import;
-   revealed-phone import works;
-   consent converts the opportunity into a Property;
-   original source data remains available.

### CRM

-   Properties are searchable;
-   Clients and Requirements are searchable;
-   matching works;
-   collaboration preserves responsible ownership;
-   Deals support multiple client/property relationships;
-   Showings are recorded;
-   Next Actions are operational.

### Communication

-   internal messenger works;
-   CRM cards can be shared;
-   notifications are preference-aware;
-   notifications can lead to action.

### Publication

-   extension works on supported marketplaces;
-   publication fields are mapped;
-   stored media is used;
-   missing human choices are surfaced;
-   final publication requires human confirmation.

### Data

-   events are emitted;
-   audit is complete for critical actions;
-   history is visible;
-   dedupe and provenance are preserved.

### Analytics

-   authorized manager can see company analytics;
-   agent-level sales are available;
-   district analytics are available;
-   market trends are available;
-   drill-down works;
-   historical data remains usable.

### Achievements

-   eight categories calculate;
-   rankings are reproducible;
-   medals/badges are assigned;
-   award history is retained.

### Design / UX

-   the token-driven KleeKto design system is used by the core UI;
-   the binding Primary Visual Direction from the Design System & UX
    Specification is implemented consistently across the MVP core;
-   dark, light and system themes work, with dark used as the primary
    brand-expression and visual-QA baseline;
-   Today remains action-oriented and avoids KPI overload;
-   Opportunity Feed is dense, scannable and preserves source/owner
    warnings;
-   entity drawers/split views preserve working context;
-   Command Bar and core workflows are keyboard operable;
-   critical loading/empty/error/denied/conflict states are implemented;
-   RU/KA/EN layouts are visually verified;
-   reduced-motion preference is respected;
-   critical web workflows target WCAG 2.2 AA;
-   UI actions remain mapped to authorized domain commands.

### Security/Reliability

-   tenant isolation works;
-   unauthorized access is denied;
-   denied sensitive actions are audited;
-   worker failures retry correctly;
-   dead-letter handling exists;
-   backup/restore procedure is tested;
-   external adapter failure does not take down core CRM.

------------------------------------------------------------------------

# 38. Implementation Order

Recommended implementation sequence:

## Phase 1 --- Foundation

-   monorepo structure
-   auth
-   tenant context
-   RBAC
-   database
-   migrations
-   event/outbox infrastructure
-   audit foundation
-   observability

## Phase 1.5 --- Design Foundation

-   semantic design tokens
-   dark/light/system themes
-   application shell
-   navigation
-   Command Bar primitives
-   entity drawer / split-view primitives
-   feedback/state primitives
-   accessibility and motion foundations

This phase establishes reusable UI infrastructure only. It does not
bypass domain-first implementation or introduce UI-only business
behavior.

## Phase 2 --- Market

-   source contracts
-   source adapters
-   collector
-   observation model
-   normalization
-   Opportunity
-   Opportunity Feed
-   claims

## Phase 3 --- CRM Core

-   Owner
-   Property
-   Source Listing
-   Client
-   Requirements
-   Entity Resolution
-   Search

## Phase 4 --- Matching / Deals

-   Matching
-   collaboration
-   Deal
-   configurable pipeline
-   Showing
-   Next Action

## Phase 5 --- Communication

-   Messenger
-   Notifications
-   subscriptions/preferences

## Phase 6 --- Documents / Media

-   storage
-   media pipeline
-   Personal Library
-   Company Library
-   CRM Documents

## Phase 7 --- Publication

-   Publication model
-   extension
-   ss.ge publication
-   myhome.ge publication
-   human confirmation

## Phase 8 --- Analytics / Achievements

-   analytics events/read models
-   dashboards
-   drill-down
-   rankings
-   eight achievements

## Phase 9 --- Hardening

-   E2E
-   contract tests
-   security
-   performance
-   source drift monitoring
-   restore testing
-   staging smoke tests
-   production gates

------------------------------------------------------------------------

# 39. Definition of Frozen

This document defines the **Frozen KleeKto MVP 1.0 product boundary**.

After freeze: - new product capabilities require an explicit Post-MVP
decision or ADR; - changes to core invariants require architecture
review; - external adapter changes may occur when source sites change; -
bug fixes and security fixes are not considered scope expansion; -
implementation details may change if they preserve the contracts and
invariants defined here.

The document is the product/architecture baseline from which the later
**Codex Technical Master Specification** must be derived.

------------------------------------------------------------------------

# 40. Final System Contract

KleeKto MVP 1.0 is complete when the system can reliably execute this
loop:

``` text
MARKET
  ↓
COLLECT
  ↓
VERIFY OWNER
  ↓
OPPORTUNITY
  ↓
AGENT CONTACT
  ↓
OWNER CONSENT
  ↓
PROPERTY
  ↓
CLIENT REQUIREMENT
  ↓
MATCH
  ↓
SHOWING
  ↓
DEAL
  ↓
ANALYTICS
  ↓
ACHIEVEMENT
```

while every meaningful business transition simultaneously produces:

``` text
EVENT
 ↓
AUDIT
 ↓
HISTORY
 ↓
NOTIFICATION / NEXT ACTION / SEARCH / MATCHING / ANALYTICS
```

and every publishable Property can follow:

``` text
PROPERTY
 ↓
PUBLICATION
 ↓
EXTENSION
 ↓
ss.ge / myhome.ge
```

**This is the Frozen KleeKto MVP 1.0 baseline.**
