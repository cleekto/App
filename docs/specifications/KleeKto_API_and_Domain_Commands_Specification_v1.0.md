# KleeKto --- API & Domain Commands Specification v1.0

**Document status:** FROZEN API / DOMAIN CONTRACT BASELINE\
**Version:** 1.0\
**Purpose:** Concrete command, API, authorization, validation, event,
idempotency, error, and integration contract for KleeKto MVP 1.0.

------------------------------------------------------------------------

# 1. Purpose

This document defines the operational contract between:

-   Web application;
-   Chrome Extension;
-   Cloud Collector;
-   background workers;
-   internal domain services;
-   external integrations;
-   future mobile clients.

It answers:

> What can the system ask the domain to do, what validation is required,
> what changes state, what event is emitted, and what does the API
> return?

The database schema remains the source-of-truth for persistence.

This document defines behavior above the database.

------------------------------------------------------------------------

# 2. Architectural Rule

The API does not directly manipulate database records.

The canonical path is:

``` text
HTTP / Extension / Worker
          ↓
       AuthContext
          ↓
      API Handler
          ↓
      DTO Validation
          ↓
     Domain Command
          ↓
 Authorization + Invariants
          ↓
      Transaction
       ├── State change
       ├── Event
       └── Outbox
          ↓
     Async Consumers
       ├── Audit
       ├── Notifications
       ├── NextAction
       ├── Matching
       ├── Analytics
       ├── Messenger
       └── Automation
```

Domain code must not know about: - HTTP; - Next.js; - browser APIs; -
Chrome APIs; - marketplace DOM; - external API credentials.

------------------------------------------------------------------------

# 3. API Versioning

Base path:

``` text
/api/v1
```

All public application endpoints are versioned.

Breaking changes require: - new API version; - migration period; -
compatibility documentation.

Internal worker/domain commands may evolve independently but must
preserve event contracts.

------------------------------------------------------------------------

# 4. Request Context

Every command executes with:

``` text
AuthContext {
  userId
  companyId
  roleIds
  permissionSet
  sessionId
  requestId
  correlationId
  source
}
```

Possible sources:

``` text
WEB
EXTENSION
COLLECTOR
SYSTEM
AUTOMATION
IMPORT
INTEGRATION
```

`companyId` is derived from authenticated context.

The client must never be trusted to select an arbitrary tenant.

------------------------------------------------------------------------

# 5. Standard Command Envelope

Recommended internal command shape:

``` ts
type CommandEnvelope<T> = {
  commandId: string
  commandType: string
  actor: ActorContext
  correlationId: string
  causationId?: string
  idempotencyKey?: string
  payload: T
}
```

Every state-changing command must have: - command type; - actor; -
company context; - correlation ID; - validated payload.

External retries must use idempotency keys.

------------------------------------------------------------------------

# 6. Standard API Response

Successful read:

``` json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Successful mutation:

``` json
{
  "data": {},
  "events": [
    {
      "type": "property.updated"
    }
  ],
  "meta": {
    "requestId": "...",
    "correlationId": "..."
  }
}
```

The API may omit internal event payloads and expose only safe event
summaries.

------------------------------------------------------------------------

# 7. Standard Error Contract

``` json
{
  "error": {
    "code": "OPPORTUNITY_ALREADY_CLAIMED",
    "message": "Opportunity is currently being worked on by another agent.",
    "details": {},
    "requestId": "...",
    "retryable": false
  }
}
```

Required fields:

``` text
code
message
requestId
retryable
```

HTTP mapping:

``` text
400 INVALID_REQUEST
401 UNAUTHENTICATED
403 FORBIDDEN
404 NOT_FOUND
409 CONFLICT
422 DOMAIN_VALIDATION_ERROR
429 RATE_LIMITED
500 INTERNAL_ERROR
502 INTEGRATION_ERROR
503 SERVICE_UNAVAILABLE
504 INTEGRATION_TIMEOUT
```

Never expose: - stack traces; - SQL; - credentials; - tokens; - raw
integration secrets; - internal infrastructure details.

------------------------------------------------------------------------

# 8. Idempotency Contract

Required for externally retried mutations:

-   extension import;
-   publication commands;
-   collector observations;
-   webhook processing;
-   message sending where duplicate delivery is possible;
-   billing webhooks;
-   automation execution.

Idempotency key scope:

``` text
companyId + operationType + idempotencyKey
```

Repeated request with same semantic operation returns the original
result.

Different payload with an existing idempotency key returns:

``` text
IDEMPOTENCY_KEY_REUSED
```

------------------------------------------------------------------------

# 9. Authorization Model

Authorization is permission-based and uses the canonical permission identifiers defined in the RBAC Specification v1.0.

Core permissions include:

```text
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

Ownership is not equivalent to permission. Collaboration does not transfer ownership.

------------------------------------------------------------------------

# 10. Opportunity Commands

## 10.1 Claim Opportunity

Command:

``` text
CLAIM_OPPORTUNITY
```

Input:

``` json
{
  "opportunityId": "..."
}
```

Rules: - Opportunity must belong to company; - status must allow work; -
user must have `opportunity.claim`; - existing claim is soft, not
permanent; - active claim may remain visible to other agents; - activity
refreshes claim; - audit + event required; - optional NextAction to
contact owner.

Events:

``` text
opportunity.claimed
next_action.created
```

Errors:

``` text
OPPORTUNITY_NOT_FOUND
OPPORTUNITY_NOT_AVAILABLE
FORBIDDEN
```

------------------------------------------------------------------------

## 10.2 Refresh Opportunity Claim

``` text
REFRESH_OPPORTUNITY_CLAIM
```

Input:

``` json
{
  "opportunityId": "..."
}
```

Updates activity timestamp.

Event:

``` text
opportunity.claim_refreshed
```

------------------------------------------------------------------------

## 10.3 Release Opportunity Claim

``` text
RELEASE_OPPORTUNITY_CLAIM
```

Input:

``` json
{
  "opportunityId": "...",
  "reason": "..."
}
```

Event:

``` text
opportunity.claim_released
```

------------------------------------------------------------------------

## 10.4 Record Owner Contact

``` text
RECORD_OPPORTUNITY_CONTACT
```

Input:

``` json
{
  "opportunityId": "...",
  "outcome": "CALLBACK",
  "notes": "...",
  "occurredAt": "..."
}
```

Creates immutable OpportunityContact.

Events:

``` text
opportunity.contact_recorded
```

Depending on outcome: - CALLBACK → create NextAction; - CONSENT_GIVEN →
permit conversion workflow; - DECLINED → update opportunity workflow
state; - NO_ANSWER → optional retry NextAction.

------------------------------------------------------------------------

## 10.5 Convert Opportunity to Property

``` text
CONVERT_OPPORTUNITY_TO_PROPERTY
```

Input:

``` json
{
  "opportunityId": "...",
  "ownerId": "...",
  "phone": "...",
  "propertyOverrides": {},
  "media": []
}
```

Preconditions: - explicit owner consent exists; - valid phone evidence
(`REVEALED_ON_SOURCE` or `MANUAL_AGENT_INPUT`) has been verified for
extension-origin imports; - source provenance
exists; - user has property creation permission; - duplicate property
resolution completed.

Transaction:

``` text
validate consent
→ resolve Owner
→ resolve duplicate Property candidates
→ create/update Property
→ attach source reference
→ create source snapshot
→ attach media
→ update Opportunity convertedPropertyId
→ emit events
```

Events:

property.created
opportunity.converted

No silent duplicate merge.

------------------------------------------------------------------------

# 11. Extension Import API

Endpoint:

``` text
POST /api/v1/import/source-listing
```

Command:

``` text
IMPORT_SOURCE_LISTING
```

Payload:

``` json
{
  "provider": "SS_GE",
  "externalListingId": "...",
  "sourceUrl": "...",
  "sourceSnapshot": {},
  "phone": "...",
  "phoneEvidence": {
    "mode": "REVEALED_ON_SOURCE"
  },
  "photos": [],
  "capturedAt": "...",
  "extensionVersion": "..."
}
```

Rules: - authenticated extension only; - provider allowlist; - extension
version compatibility; - source URL validation; - phone must carry valid
human-provided evidence using `REVEALED_ON_SOURCE` or
`MANUAL_AGENT_INPUT`; - extension must never simulate native reveal; -
manual entry must be an explicit human input and its provenance is
recorded; - payload normalized server-side; - source snapshot preserved;
- entity resolution performed; - idempotency required.

Possible outcomes:

``` text
IMPORTED
ALREADY_IMPORTED
LINKED_TO_EXISTING
REQUIRES_REVIEW
REJECTED
```

Errors:

``` text
PHONE_EVIDENCE_REQUIRED
PHONE_NOT_REVEALED
INVALID_MANUAL_PHONE
UNSUPPORTED_PROVIDER
INVALID_SOURCE_URL
EXTENSION_VERSION_UNSUPPORTED
DUPLICATE_IMPORT
ENTITY_RESOLUTION_REQUIRED
```

------------------------------------------------------------------------

# 12. Opportunity Archive / Restore Commands

## Archive Opportunity

```text
ARCHIVE_OPPORTUNITY
```

Event: `opportunity.archived`

## Restore Opportunity

```text
RESTORE_OPPORTUNITY
```

Event: `opportunity.restored`

---

# 13. Owner Commands

## Create Owner

``` text
CREATE_OWNER
```

Input:

``` json
{
  "name": "...",
  "phones": [],
  "emails": []
}
```

Resolution: - normalize phone/email; - search existing company owner; -
exact match → reuse; - ambiguous match → propose resolution; - never
silently merge ambiguous owners.

Events:

``` text
owner.created
```

------------------------------------------------------------------------

## Update Owner

``` text
UPDATE_OWNER
```

All meaningful changes: - authorization; - before/after audit; - domain
event.

------------------------------------------------------------------------

## Merge Owner

``` text
MERGE_OWNER
```

High-risk command.

Requires: - explicit permission; - confirmation; - merge reason.

Creates immutable merge record/event.

Never hard-delete historical references.

------------------------------------------------------------------------

# 14. Property Commands

## Create Property

``` text
CREATE_PROPERTY
```

Required: - company; - owner; - responsible agent; - property type; -
core property data.

Events:

``` text
property.created
```

Triggers asynchronously: - matching; - search indexing; - analytics; -
publication readiness; - notifications where rules apply.

------------------------------------------------------------------------

## Update Property

``` text
UPDATE_PROPERTY
```

Input is patch-based:

``` json
{
  "propertyId": "...",
  "changes": {
    "price": 250000,
    "area": 86
  }
}
```

Server: - validates field permissions; - compares before/after; -
detects suspicious material changes; - writes change; - creates
event/audit.

Suspicious example:

``` text
rooms 3 → 7
area 85 → 210
```

Behavior: - warn; - audit; - do not automatically hard-block unless
policy requires it.

------------------------------------------------------------------------

## Change Property Price

Specialized command:

``` text
CHANGE_PROPERTY_PRICE
```

Input:

``` json
{
  "propertyId": "...",
  "newPrice": 245000,
  "currency": "GEL"
}
```

Atomic: - Property price; - PropertyPriceHistory; - Event; - Outbox.

Event:

``` text
property.price_changed
```

Triggers: - matching recalculation; - notifications; - NextAction; -
analytics.

------------------------------------------------------------------------

## Assign Property

``` text
ASSIGN_PROPERTY
```

Input:

``` json
{
  "propertyId": "...",
  "responsibleAgentId": "..."
}
```

Rules: - permission required; - current owner/responsible agent
preserved in history; - collaboration can be used instead of
reassignment.

Event:

``` text
property.assigned
```

------------------------------------------------------------------------

# 15. Client Commands

## Create Client

``` text
CREATE_CLIENT
```

Input:

``` json
{
  "name": "...",
  "phone": "...",
  "email": "..."
}
```

Normalize and resolve duplicate candidates.

Event:

``` text
client.created
```

------------------------------------------------------------------------

## Update Client

``` text
UPDATE_CLIENT
```

Patch-based.

------------------------------------------------------------------------

## Create Client Requirement

``` text
CREATE_CLIENT_REQUIREMENT
```

Input:

``` json
{
  "clientId": "...",
  "minPrice": 100000,
  "maxPrice": 250000,
  "currency": "USD",
  "roomsMin": 2,
  "roomsMax": 3,
  "minArea": 60,
  "maxArea": 100,
  "districts": ["Saburtalo"],
  "mustHave": ["BALCONY"],
  "niceToHave": ["PARKING"],
  "exclusions": []
}
```

Requirements remain separate from Client.

Event:

``` text
client_requirement.created
```

Triggers: - matching.

------------------------------------------------------------------------

## Update Requirement

``` text
UPDATE_CLIENT_REQUIREMENT
```

Requirement changes trigger matching recalculation.

------------------------------------------------------------------------

# 16. Matching Commands

## Create Match

``` text
CREATE_MATCH
```

Normally generated by Matching Engine.

Input:

``` json
{
  "propertyId": "...",
  "clientId": "...",
  "requirementId": "...",
  "score": 0.91,
  "explanation": {},
  "matchedCriteria": {}
}
```

System validates: - requirement active; - property/client same
company; - no duplicate match.

Event:

``` text
match.created
```

------------------------------------------------------------------------

## Invalidate Match

``` text
INVALIDATE_MATCH
```

Triggered when: - property no longer qualifies; - requirement becomes
inactive; - deal state makes match irrelevant according to policy.

Event:

``` text
match.invalidated
```

------------------------------------------------------------------------

# 17. Collaboration Commands

## Request Property Collaboration

``` text
REQUEST_PROPERTY_COLLABORATION
```

Input:

``` json
{
  "propertyId": "...",
  "requestingAgentId": "...",
  "message": "..."
}
```

Rules: - responsible agent remains responsible; - request does not
reassign; - notification/messenger event generated.

Events:

``` text
collaboration.requested
notification.created
```

------------------------------------------------------------------------

# 18. Deal Commands

## Create Deal

``` text
CREATE_DEAL
```

Input:

``` json
{
  "propertyId": "...",
  "clientId": "...",
  "responsibleAgentId": "...",
  "stageId": "..."
}
```

Validate: - property and client same company; - responsible agent
belongs to company; - stage belongs to company.

Event:

``` text
deal.created
```

------------------------------------------------------------------------

## Change Deal Stage

``` text
CHANGE_DEAL_STAGE
```

Input:

``` json
{
  "dealId": "...",
  "toStageId": "..."
}
```

Atomic: - Deal.stageId; - DealStageHistory; - Event/Outbox.

Event:

``` text
deal.stage_changed
```

Rules may create: - Showing proposal; - NextAction; - notification.

------------------------------------------------------------------------

## Close Deal Won

``` text
CLOSE_DEAL_WON
```

Input:

``` json
{
  "dealId": "...",
  "closedAt": "...",
  "price": 250000,
  "commission": 5000
}
```

Creates immutable business event.

Event:

``` text
deal.won
```

Triggers: - analytics; - achievements; - notifications; - property
lifecycle rules.

------------------------------------------------------------------------

## Close Deal Lost

``` text
CLOSE_DEAL_LOST
```

Input:

``` json
{
  "dealId": "...",
  "reason": "...",
  "closedAt": "..."
}
```

Event:

``` text
deal.lost
```

Client requirement remains preserved.

------------------------------------------------------------------------

# 19. Showing Commands

## Schedule Showing

``` text
SCHEDULE_SHOWING
```

Input:

``` json
{
  "dealId": "...",
  "scheduledAt": "...",
  "notes": "..."
}
```

Event:

``` text
showing.scheduled
```

------------------------------------------------------------------------

## Complete Showing

``` text
COMPLETE_SHOWING
```

Input:

``` json
{
  "showingId": "...",
  "result": "POSITIVE",
  "notes": "..."
}
```

Event:

``` text
showing.completed
```

------------------------------------------------------------------------

## Cancel Showing

``` text
CANCEL_SHOWING
```

Event:

``` text
showing.cancelled
```

------------------------------------------------------------------------

# 20. Next Action Commands

## Create Next Action

``` text
CREATE_NEXT_ACTION
```

Input:

``` json
{
  "assigneeId": "...",
  "type": "CALL_OWNER",
  "title": "Call owner",
  "dueAt": "...",
  "priority": "HIGH",
  "entityType": "OPPORTUNITY",
  "entityId": "..."
}
```

Event:

``` text
next_action.created
```

------------------------------------------------------------------------

## Complete Next Action

``` text
COMPLETE_NEXT_ACTION
```

Input:

``` json
{
  "nextActionId": "...",
  "result": "..."
}
```

Event:

``` text
next_action.completed
```

------------------------------------------------------------------------

## Reschedule Next Action

``` text
RESCHEDULE_NEXT_ACTION
```

------------------------------------------------------------------------

## Cancel Next Action

``` text
CANCEL_NEXT_ACTION
```

------------------------------------------------------------------------

# 21. Search API

Global:

``` text
GET /api/v1/search?q=...
```

Structured:

``` text
POST /api/v1/search/query
```

Input:

``` json
{
  "entityTypes": ["PROPERTY"],
  "query": "3 комнаты Сабуртало",
  "filters": {},
  "sort": "RELEVANCE",
  "page": 1,
  "pageSize": 50
}
```

Search engine: - PostgreSQL FTS; - pg_trgm; - normalized fields; -
deterministic parser.

Permission filtering happens before result exposure.

Search never bypasses authorization.

------------------------------------------------------------------------

# 22. Opportunity Feed API

``` text
GET /api/v1/opportunities
POST /api/v1/opportunities/:id/archive
POST /api/v1/opportunities/:id/restore
```

Supported filters: - source; - owner verified; - new; - views; - price
changed; - in work; - contacted; - available; - archived; - district; -
property type; - price; - area; - age.

Sorting: - newest; - views; - price changed; - age; - relevance when
enabled.

Default: - owner listings; - company-visible opportunities; - active
market state.

------------------------------------------------------------------------

# 23. Property API

``` text
GET    /api/v1/properties
GET    /api/v1/properties/:id
POST   /api/v1/properties
PATCH  /api/v1/properties/:id
```

Special commands:

``` text
POST /api/v1/properties/:id/change-price
POST /api/v1/properties/:id/assign
POST /api/v1/properties/:id/archive
POST /api/v1/properties/:id/restore
```

------------------------------------------------------------------------

# 24. Client API

``` text
GET    /api/v1/clients
GET    /api/v1/clients/:id
POST   /api/v1/clients
PATCH  /api/v1/clients/:id
```

Requirements:

``` text
GET    /api/v1/clients/:id/requirements
POST   /api/v1/clients/:id/requirements
PATCH  /api/v1/requirements/:id
```

------------------------------------------------------------------------

# 25. Deal API

``` text
GET    /api/v1/deals
GET    /api/v1/deals/:id
POST   /api/v1/deals
POST   /api/v1/deals/:id/stage
POST   /api/v1/deals/:id/won
POST   /api/v1/deals/:id/lost
```

------------------------------------------------------------------------

# 26. Today API

``` text
GET /api/v1/today
```

Returns aggregated actionable state:

``` json
{
  "overdue": [],
  "today": [],
  "upcoming": [],
  "opportunities": [],
  "matches": [],
  "teamItems": [],
  "marketSummary": {}
}
```

The endpoint is optimized for the agent's primary workflow.

------------------------------------------------------------------------

# 27. History API

Entity timeline:

``` text
GET /api/v1/entities/:entityType/:entityId/history
```

Filters:

``` text
ALL
CALLS
CHANGES
MESSAGES
DEALS
SYSTEM
```

Cross-company history is never exposed.

Timeline combines: - Events; - audit summaries; - interactions; - linked
business events.

------------------------------------------------------------------------

# 28. Notification API

``` text
GET  /api/v1/notifications
POST /api/v1/notifications/:id/read
POST /api/v1/notifications/read-all
GET  /api/v1/notification-preferences
PATCH /api/v1/notification-preferences
```

Notification creation should normally happen through Event →
Notification Engine, not arbitrary UI calls.

------------------------------------------------------------------------

# 29. Messenger API

``` text
GET  /api/v1/conversations
POST /api/v1/conversations
GET  /api/v1/conversations/:id/messages
POST /api/v1/conversations/:id/messages
POST /api/v1/messages/:id/reactions
POST /api/v1/messages/:id/reply
```

Message send must validate: - conversation membership; - company
membership; - attachment ownership; - CRM reference authorization.

------------------------------------------------------------------------

# 30. Document API

``` text
GET  /api/v1/documents
POST /api/v1/documents
GET  /api/v1/documents/:id
POST /api/v1/documents/:id/share
POST /api/v1/documents/:id/versions
POST /api/v1/documents/:id/archive
```

Storage: - private object storage; - signed URLs; - authorization before
URL issuance.

------------------------------------------------------------------------

# 31. Document Archive Command

```text
ARCHIVE_DOCUMENT
```

Business documents are archived rather than hard-deleted by default.

Event: `document.archived`

---

# 32. Publication API

Prepare:

``` text
POST /api/v1/publications
```

Prepare command:

``` text
PREPARE_PUBLICATION
```

Input:

``` json
{
  "propertyId": "...",
  "provider": "SS_GE"
}
```

Result:

``` text
READY
or
MISSING_FIELDS
```

Extension fill:

``` text
POST /api/v1/publications/:id/prepare-extension-session
```

Final confirmation:

``` text
POST /api/v1/publications/:id/confirm
```

Command:

``` text
CONFIRM_PUBLICATION
```

Critical rule:

> A publication cannot become PUBLISHED without explicit human
> confirmation.

Events:

``` text
publication.prepared
publication.confirmed
publication.published
publication.failed
```

------------------------------------------------------------------------

# 33. Collector API / Internal Commands

Collector is a backend subsystem, not a browser feature.

Command:

``` text
PROCESS_SOURCE_OBSERVATION
```

Input:

``` json
{
  "provider": "SS_GE",
  "externalListingId": "...",
  "observedAt": "...",
  "rawPayload": {},
  "normalizedPayload": {},
  "parserVersion": "...",
  "adapterVersion": "..."
}
```

Processing:

``` text
validate adapter contract
→ idempotency
→ store observation
→ resolve SourceListing
→ detect owner indicator
→ calculate content hash
→ detect changes
→ create/update Opportunity projection
→ emit domain events
```

Possible events:

``` text
source.observed
opportunity.created
opportunity.updated
opportunity.price_changed
opportunity.off_market
```

Collector must be restartable.

------------------------------------------------------------------------

# 34. Webhook Gateway

Endpoint:

``` text
POST /api/v1/webhooks/:provider
```

Processing:

``` text
authenticate signature
→ identify provider
→ validate schema
→ create idempotency record
→ normalize
→ enqueue command
→ acknowledge
```

Do not execute large workflows synchronously inside webhook requests.

------------------------------------------------------------------------

# 35. Automation API

Manager/admin:

``` text
GET    /api/v1/automation/rules
POST   /api/v1/automation/rules
PATCH  /api/v1/automation/rules/:id
POST   /api/v1/automation/rules/:id/enable
POST   /api/v1/automation/rules/:id/disable
GET    /api/v1/automation/executions
```

Rule execution remains event-driven.

Automation may invoke domain commands only through an allowed command
registry.

Never permit arbitrary SQL/DB updates from a rule.

------------------------------------------------------------------------

# 36. Analytics API

Company-wide authorized analytics:

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

Permission:

``` text
analytics.company.read_full
```

Analytics must support: - period; - comparison period; - drill-down; -
agent; - district; - property type; - source; - sales; - deals; -
showings; - conversion; - revenue/commission; - trends.

------------------------------------------------------------------------

# 37. Achievement API

``` text
GET /api/v1/achievements/me
GET /api/v1/achievements/team
GET /api/v1/achievements/leaderboard
GET /api/v1/achievements/admin/qualification
```

Admin qualification view must expose evidence behind ranking.

Awards are immutable once finalized.

------------------------------------------------------------------------

# 38. Audit API

Admin/authorized manager:

``` text
GET /api/v1/audit
GET /api/v1/audit/:entityType/:entityId
```

Audit output must not expose secret material.

------------------------------------------------------------------------

# 39. API Pagination

Default: - cursor pagination for large feeds; - offset pagination may be
used for small administrative tables.

Cursor should be opaque.

Example:

``` json
{
  "data": [],
  "page": {
    "nextCursor": "...",
    "hasMore": true
  }
}
```

------------------------------------------------------------------------

# 40. Filtering Contract

Filters must be typed.

Examples:

``` text
price.gte
price.lte
area.gte
area.lte
rooms.in
district.in
status.in
createdAt.gte
createdAt.lte
responsibleAgentId
```

Never construct raw SQL from user filter strings.

------------------------------------------------------------------------

# 41. Command Authorization Sequence

Every mutation follows:

``` text
1. Authenticate
2. Resolve company
3. Validate DTO
4. Resolve entity
5. Check tenant
6. Check permission
7. Check ownership/collaboration policy
8. Validate domain invariants
9. Execute transaction
10. Write event
11. Write outbox
12. Return result
```

Order matters.

Tenant check must occur before exposing unauthorized entity details.

------------------------------------------------------------------------

# 42. Domain Invariants

## Opportunity

-   belongs to one company;
-   references external SourceListing;
-   owner verification is factual source data;
-   does not automatically become Property;
-   archive is reversible;
-   claim is soft.

## Property

-   belongs to one company;
-   has responsible agent;
-   has provenance;
-   may participate in many Deals;
-   edits preserve history.

## Owner

-   independent entity;
-   may have multiple properties/opportunities;
-   ambiguous duplicates require resolution.

## Client

-   may have multiple requirements;
-   may participate in multiple Deals.

## Deal

-   links one Property + one Client;
-   has configurable stage;
-   stage changes are historical.

## Showing

-   is an event/business record;
-   does not have to be a pipeline stage.

## NextAction

-   belongs to one company;
-   has assignee;
-   may link to business entity;
-   can be system-generated.

------------------------------------------------------------------------

# 43. Cross-Domain Event Contract

Event envelope:

``` json
{
  "id": "...",
  "companyId": "...",
  "type": "property.price_changed",
  "schemaVersion": 1,
  "actor": {
    "type": "AGENT",
    "id": "..."
  },
  "entity": {
    "type": "PROPERTY",
    "id": "..."
  },
  "occurredAt": "...",
  "source": "WEB",
  "correlationId": "...",
  "causationId": "...",
  "metadata": {}
}
```

Event consumers must be idempotent.

Events are facts, not commands.

------------------------------------------------------------------------

# 44. Core Event Catalogue

Minimum MVP events:

``` text
owner.created
owner.updated
owner.merged

source.observed
source.changed

opportunity.created
opportunity.updated
opportunity.claimed
opportunity.claim_refreshed
opportunity.claim_released
opportunity.contact_recorded
opportunity.consent_confirmed
opportunity.converted
opportunity.off_market
opportunity.archived
opportunity.restored

property.created
property.updated
property.price_changed
property.assigned
property.archived
property.restored

client.created
client.updated
client_requirement.created
client_requirement.updated
client_requirement.deactivated

match.created
match.invalidated

collaboration.requested

deal.created
deal.stage_changed
deal.won
deal.lost

showing.scheduled
showing.completed
showing.cancelled

next_action.created
next_action.completed
next_action.rescheduled
next_action.cancelled

publication.prepared
publication.confirmed
publication.published
publication.failed
publication.unpublished

message.sent
message.reaction_added

document.created
document.shared
document.version_created

notification.created
notification.read

achievement.awarded

automation.executed
automation.failed
```

------------------------------------------------------------------------

# 45. Event Consumer Rules

Consumers must not mutate another module's tables directly.

Bad:

``` text
PropertyService → UPDATE Notification
```

Correct:

``` text
PropertyService
→ property.price_changed
→ Notification Engine
→ notification.created
```

Likewise:

``` text
Property
→ property.created
→ Matching
→ match.created
```

and:

``` text
Deal
→ deal.won
→ Analytics
→ Achievement
```

------------------------------------------------------------------------

# 46. Retry Rules

Retry: - network timeout; - temporary DB outage; - queue failure; -
external 429; - external 5xx.

Do not blindly retry: - invalid payload; - forbidden; - duplicate
permanent conflict; - unsupported provider; - missing required human
input.

Backoff: - exponential; - jitter; - bounded attempts.

Failed messages go to DLQ after policy threshold.

------------------------------------------------------------------------

# 47. Concurrency Rules

Optimistic concurrency is required for critical mutable entities.

Recommended: - `updatedAt` or explicit version number.

Example:

``` json
{
  "propertyId": "...",
  "version": 14,
  "changes": {
    "price": 250000
  }
}
```

If current version differs:

``` text
VERSION_CONFLICT
```

UI can refresh and present current state.

Critical claims use transactional locking/unique active-claim
constraints.

------------------------------------------------------------------------

# 48. Sensitive Commands

Require elevated permission and explicit confirmation:

``` text
MERGE_OWNER
MERGE_PROPERTY
ASSIGN_PROPERTY
CONFIRM_PUBLICATION
ARCHIVE_DOCUMENT
GRANT_SUPPORT_ACCESS
```

Every such action must create audit evidence.

------------------------------------------------------------------------

# 49. Extension Security Contract

Extension authentication: - short-lived access credentials; - refresh
mechanism where required; - extension version validation; - minimal host
permissions; - allowlisted domains; - service worker as network exit.

MAIN-world script: - may inspect already received page responses; - may
not contain API secrets; - may not contain long-lived tokens; - may not
contain privileged server configuration.

Content script: - DOM/UI helper; - source page interaction.

Service worker: - authenticated API requests; - token handling; -
command orchestration.

------------------------------------------------------------------------

# 50. Phone Evidence Contract

This is a hard domain rule.

Every source import must provide one of two human-origin evidence modes:

``` text
REVEALED_ON_SOURCE
MANUAL_AGENT_INPUT
```

For `REVEALED_ON_SOURCE`, the extension detects the phone only after the
human uses the marketplace's native reveal control. The extension never
simulates, automates, or bypasses that control.

For `MANUAL_AGENT_INPUT`, the human explicitly types a phone obtained
from the owner or another legitimate human interaction. The server
normalizes and validates the phone and records manual-input provenance.

A raw phone field without valid evidence is insufficient.

If neither evidence mode is valid:

``` text
PHONE_EVIDENCE_REQUIRED
```

If `REVEALED_ON_SOURCE` is claimed but the reveal state cannot be
established:

``` text
PHONE_NOT_REVEALED
```

------------------------------------------------------------------------

# 51. Publication Command Contract

Publication is a controlled workflow:

``` text
Property
 ↓
PREPARE_PUBLICATION
 ↓
READY / MISSING_FIELDS
 ↓
EXTENSION SESSION
 ↓
FILLING
 ↓
AWAITING_CONFIRMATION
 ↓
HUMAN CONFIRMATION
 ↓
PUBLISHED
```

Extension may: - select known categories; - fill known fields; - upload
stored media; - click Next; - navigate multi-step forms.

Extension may not: - invent missing business choices; - reveal hidden
phone; - silently publish; - bypass marketplace confirmation.

------------------------------------------------------------------------

# 52. Data Transfer Objects

DTOs must be separate from database models.

Example:

``` text
PropertyDTO
PropertyCreateDTO
PropertyUpdateDTO
PropertySearchDTO
PropertySummaryDTO
PropertyDetailDTO
```

Never expose Prisma model directly from API.

This prevents: - accidental field leakage; - schema coupling; -
authorization bypass; - unstable external contracts.

------------------------------------------------------------------------

# 53. API Security

Required: - authentication; - authorization; - tenant scoping; - rate
limits; - payload size limits; - schema validation; - CSRF protection
where cookie auth applies; - secure headers; - structured security
logging.

PII: - never in logs; - never in error messages; - never in analytics
dimensions unless explicitly justified.

------------------------------------------------------------------------

# 54. Observability Contract

Every request receives:

``` text
requestId
correlationId
```

Every domain mutation emits:

``` text
eventId
```

Logs include IDs, not secrets.

Required metrics: - API latency; - P50/P95/P99; - error rate; - command
failure rate; - queue depth; - event lag; - collector freshness; -
publication success rate; - notification delivery rate.

------------------------------------------------------------------------

# 55. Performance Targets

Initial MVP targets:

API reads: - P95 \< 300 ms for ordinary indexed reads.

Search: - P95 \< 500 ms for normal company-scale searches.

Mutation: - P95 \< 500 ms excluding async processing.

Feed: - first page P95 \< 700 ms under normal load.

Async workflows: - event processing normally \< 5 seconds.

External publication/collector operations are excluded from synchronous
API latency targets.

------------------------------------------------------------------------

# 56. API Rate Limits

Suggested initial limits:

Authenticated UI: - 120 requests/minute/user baseline.

Extension: - operation-specific limits.

Collector: - provider-specific adapter limits.

Webhooks: - provider-specific burst limits.

Limits must be configurable.

------------------------------------------------------------------------

# 57. Testing Contract

Every command requires:

### Unit

-   valid command;
-   invalid input;
-   authorization;
-   invariant failures.

### Integration

-   database transaction;
-   event creation;
-   outbox creation;
-   idempotency.

### Contract

-   DTO schema;
-   event schema;
-   adapter schema.

### E2E

Critical chains:

``` text
collector
→ opportunity
→ claim
→ contact
→ consent
→ property
→ client matching
→ showing
→ deal
→ analytics
→ achievement
```

Also:

``` text
property
→ publication
→ extension
→ human confirmation
→ published
```

------------------------------------------------------------------------

# 58. Critical End-to-End Acceptance Chain

## Collector

``` text
Marketplace
→ Adapter
→ SourceObservation
→ SourceListing
→ owner indicator
→ Opportunity
```

Expected: - duplicate observations do not duplicate Opportunity; - price
change is detected; - history preserved.

## Opportunity Owner

``` text
Opportunity
→ Claim
→ Contact
→ Consent
```

Expected: - claim visible; - contact history immutable; - consent
explicit.

## Contact

``` text
Contact outcome
→ NextAction / Conversion
```

Expected: - callback creates actionable NextAction; - consent enables
conversion.

## Property

``` text
Consent
→ Property
→ Source Snapshot
→ Media
→ Owner
```

Expected: - provenance preserved; - edits auditable.

## Client Matching

``` text
Property
→ Active Requirements
→ Match
→ Responsible Agent
```

Expected: - explainable match; - no ownership transfer.

## Showing

``` text
Deal
→ Showing
→ Result
```

Expected: - showing history preserved; - count derivable.

## Analytics

``` text
Business Events
→ Analytics Facts
→ Company Dashboard
```

Expected: - duplicate events do not double-count.

## Achievement

``` text
Validated Facts
→ Qualification
→ Rank
→ Award
```

Expected: - reproducible calculation; - evidence available to admin.

------------------------------------------------------------------------

# 59. Implementation Order

Recommended implementation sequence:

``` text
1. AuthContext + tenant guard
2. Core repositories
3. Command bus / command registry
4. Event + Outbox
5. Owner
6. SourceListing + SourceObservation
7. Opportunity
8. Property
9. Client + Requirements
10. Matching
11. Deal + Stage
12. Showing
13. NextAction
14. Search
15. Notifications
16. Messenger
17. Documents/Media
18. Publication
19. Extension
20. Automation
21. Analytics
22. Achievement
23. Billing
24. Observability hardening
```

Do not build UI-first around unfinished domain commands.

------------------------------------------------------------------------

# 60. Command Registry

Every command must be registered explicitly.

Example:

``` text
CLAIM_OPPORTUNITY
REFRESH_OPPORTUNITY_CLAIM
RELEASE_OPPORTUNITY_CLAIM
ARCHIVE_OPPORTUNITY
RESTORE_OPPORTUNITY
RECORD_OPPORTUNITY_CONTACT
CONVERT_OPPORTUNITY_TO_PROPERTY

CREATE_OWNER
UPDATE_OWNER
MERGE_OWNER
MERGE_PROPERTY

CREATE_PROPERTY
UPDATE_PROPERTY
CHANGE_PROPERTY_PRICE
ASSIGN_PROPERTY
ARCHIVE_PROPERTY
RESTORE_PROPERTY

CREATE_CLIENT
UPDATE_CLIENT
CREATE_CLIENT_REQUIREMENT
UPDATE_CLIENT_REQUIREMENT

CREATE_MATCH
INVALIDATE_MATCH

REQUEST_PROPERTY_COLLABORATION

CREATE_DEAL
CHANGE_DEAL_STAGE
CLOSE_DEAL_WON
CLOSE_DEAL_LOST

SCHEDULE_SHOWING
COMPLETE_SHOWING
CANCEL_SHOWING

CREATE_NEXT_ACTION
COMPLETE_NEXT_ACTION
RESCHEDULE_NEXT_ACTION
CANCEL_NEXT_ACTION

IMPORT_SOURCE_LISTING

PREPARE_PUBLICATION
CONFIRM_PUBLICATION

CREATE_MESSAGE
MARK_MESSAGE_READ
ADD_MESSAGE_REACTION
SHARE_CRM_CARD

CREATE_DOCUMENT
SHARE_DOCUMENT
CREATE_DOCUMENT_VERSION
ARCHIVE_DOCUMENT

MARK_NOTIFICATION_READ
MARK_ALL_NOTIFICATIONS_READ

ASSIGN_USER_ROLE
SUSPEND_USER
GRANT_SUPPORT_ACCESS
REVOKE_SUPPORT_ACCESS

EXECUTE_AUTOMATION
```

Unknown commands are rejected.

------------------------------------------------------------------------

# 61. Secondary Domain Commands

## Messaging

```text
MARK_MESSAGE_READ
ADD_MESSAGE_REACTION
SHARE_CRM_CARD
```

Each command validates conversation membership and CRM entity access where applicable. Events:

```text
message.read
message.reaction_added
crm_card.shared
```

## Documents

```text
CREATE_DOCUMENT_VERSION
ARCHIVE_DOCUMENT
```

Events:

```text
document.version_created
document.archived
```

## Notifications

```text
MARK_NOTIFICATION_READ
MARK_ALL_NOTIFICATIONS_READ
```

Events:

```text
notification.read
```

## Security / Administration

```text
ASSIGN_USER_ROLE
SUSPEND_USER
GRANT_SUPPORT_ACCESS
REVOKE_SUPPORT_ACCESS
```

These commands require the corresponding RBAC permissions, same-company target validation (except platform-scoped support operations), explicit confirmation where required, and audit. Events:

```text
user.role_assigned
user.suspended
support_access.granted
support_access.revoked
```

---

# 62. Domain Service Rules

Domain services may coordinate multiple repositories only when the
business operation genuinely spans aggregates.

Examples:

``` text
OpportunityConversionService
EntityResolutionService
MatchingService
PublicationPreparationService
DealClosingService
AchievementQualificationService
```

Services must: - receive AuthContext; - validate authorization; - use
transactions; - emit events; - remain deterministic where possible.

------------------------------------------------------------------------

# 63. Repository Contract

Repositories abstract persistence.

Example:

``` ts
interface PropertyRepository {
  findById(ctx, propertyId): Promise<Property | null>
  create(ctx, input): Promise<Property>
  update(ctx, propertyId, patch, expectedVersion): Promise<Property>
}
```

Repository must not decide: - whether a user is allowed to publish; -
whether owner consent exists; - whether a deal should be won.

Those belong to domain/application services.

------------------------------------------------------------------------

# 64. Query vs Command Separation

Queries: - must not mutate business state; - may use optimized read
models; - must enforce tenant + permission filtering.

Commands: - may mutate; - must create relevant events; - must be
idempotent where required.

CQRS is logical separation, not necessarily separate databases in MVP.

------------------------------------------------------------------------

# 65. Read Models

Recommended read models:

``` text
TodayReadModel
OpportunityFeedReadModel
GlobalSearchIndex
AnalyticsDailyReadModel
TeamLeaderboardReadModel
NotificationInboxReadModel
```

Read models are disposable/rebuildable.

They are never the source of truth.

------------------------------------------------------------------------

# 66. Caching

Cache only derived/read data.

Never cache authorization decisions beyond safe session policy.

Never use stale cache to decide: - ownership; - permission; -
publication confirmation; - tenant access.

------------------------------------------------------------------------

# 67. API Contract Freeze

Version 1.0 is considered frozen when:

-   command registry is implemented;
-   DTO schemas are versioned;
-   error codes are documented;
-   authorization matrix is tested;
-   event schemas are versioned;
-   idempotency behavior is tested;
-   critical E2E chains pass;
-   extension contract tests pass;
-   collector adapter contract tests pass.

Changes to domain semantics require a version review.

------------------------------------------------------------------------

# 68. Final System Contract

KleeKto API is not a CRUD wrapper around PostgreSQL.

It is a controlled command interface over a domain system.

The authoritative lifecycle is:

``` text
SOURCE
  ↓
OBSERVATION
  ↓
OPPORTUNITY
  ↓
OWNER CONTACT
  ↓
CONSENT
  ↓
PROPERTY
  ↓
CLIENT REQUIREMENT
  ↓
MATCH
  ↓
DEAL
  ↓
SHOWING
  ↓
DEAL OUTCOME
  ↓
ANALYTICS
  ↓
ACHIEVEMENT
```

Every meaningful mutation follows:

``` text
Authenticated Context
        ↓
Validated Command
        ↓
Authorization
        ↓
Domain Invariants
        ↓
Atomic State Change
        ↓
Immutable Event
        ↓
Outbox
        ↓
Derived Consumers
```

And the fundamental product boundary remains:

> **The market can be observed automatically; a CRM Property is created
> only through an explicit business transition after owner consent, with
> provenance and history preserved.**

**This document is the KleeKto API & Domain Commands Specification v1.0
implementation baseline.**
