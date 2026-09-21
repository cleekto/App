# KleeKto --- Event Catalog & Event Contracts v1.0

**Document status:** FROZEN EVENT CONTRACT BASELINE\
**Version:** 1.0\
**Purpose:** Canonical catalog of domain events, event envelopes,
payload contracts, producers, consumers, idempotency, correlation,
ordering, retry behavior, and compatibility rules for KleeKto MVP 1.0.

------------------------------------------------------------------------

# 1. Purpose

This document defines the event contract of KleeKto.

It establishes:

-   which business events exist;
-   what each event means;
-   who is allowed to emit it;
-   exact payload structure;
-   event versioning;
-   correlation and causation;
-   idempotency;
-   ordering guarantees;
-   consumer responsibilities;
-   retry and dead-letter behavior;
-   compatibility rules.

The Event Catalog is the contract between KleeKto domain modules.

The database schema remains the source of truth for persisted state.

The Domain Commands Specification defines what the system is asked to
do.

This document defines what the system announces happened.

------------------------------------------------------------------------

# 2. Fundamental Rule

A command is an intention.

An event is a fact.

Example:

``` text
COMMAND:
CHANGE_PROPERTY_PRICE

FACT:
property.price_changed
```

Consumers must react to facts.

They must never reinterpret an event as permission to perform arbitrary
database updates.

------------------------------------------------------------------------

# 3. Canonical Architecture

``` text
Domain Command
      ↓
Authorization
      ↓
Domain Invariants
      ↓
Transaction
 ├── State Change
 ├── Event
 └── Outbox Record
      ↓
Event Bus
      ↓
Consumers
 ├── Audit
 ├── Notification Engine
 ├── NextAction Engine
 ├── Matching Engine
 ├── Analytics Engine
 ├── Achievement Engine
 ├── Search Indexer
 ├── Messenger
 ├── Automation Engine
 └── Integration Workers
```

The event must be written atomically with the state change.

If the state change succeeds and event persistence fails, the
transaction must fail.

The Outbox guarantees eventual delivery after commit.

------------------------------------------------------------------------

# 4. Event Envelope

Every event uses a common envelope.

Conceptual TypeScript:

``` ts
type DomainEvent<TPayload> = {
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

------------------------------------------------------------------------

# 5. Event Metadata Rules

## id

Globally unique immutable event identifier.

Recommended:

``` text
UUID / ULID
```

## type

Stable machine-readable event name.

Example:

``` text
property.price_changed
```

## schemaVersion

Integer.

Initial version:

``` text
1
```

Breaking payload changes require a new schema version.

## companyId

Mandatory tenant boundary.

No event may cross companies.

## actor

Identifies who or what caused the business event.

Actor ID may be absent for infrastructure-level system events where no
persistent actor exists.

## entity

Primary entity affected by the event.

## occurredAt

Timestamp of the business event.

Not necessarily the time a consumer processes it.

## source

Origin of the action.

## correlationId

Groups a complete business operation.

Example:

``` text
IMPORT_SOURCE_LISTING
→ PROPERTY_CREATED
→ MATCH_CREATED
→ NOTIFICATION_CREATED
```

All may share one correlation ID.

## causationId

Identifies the direct preceding event or command responsible.

Example:

``` text
property.price_changed
caused by
CHANGE_PROPERTY_PRICE
```

## idempotencyKey

Used where duplicate external delivery is possible.

## payload

Required business fact payload. The payload contract is versioned by
`schemaVersion` and contains the fields consumers need to reproduce the
meaning of the event.

## metadata

Optional non-authoritative contextual metadata. Metadata must never
replace required business facts that belong in `payload`.

------------------------------------------------------------------------

# 6. Event Naming Convention

Format:

``` text
<aggregate>.<past_tense_fact>
```

Examples:

``` text
owner.created
opportunity.claimed
property.price_changed
deal.stage_changed
showing.completed
```

Events describe facts.

Avoid command language:

Bad:

``` text
property.change_price
```

Good:

``` text
property.price_changed
```

------------------------------------------------------------------------

# 7. Event Payload Principles

Payload must contain enough information for consumers to act without
immediately querying the source aggregate for ordinary decisions.

However:

-   payload is not a replacement for source-of-truth data;
-   large documents/images must not be embedded;
-   secrets never appear;
-   unnecessary PII should be excluded;
-   derived values should be clearly marked;
-   immutable identifiers should be preferred over names.

------------------------------------------------------------------------

# 8. Base Payload Conventions

Identifiers:

``` text
UUID / ULID string
```

Money:

``` json
{
  "amount": 250000,
  "currency": "USD"
}
```

Date/time:

``` text
ISO-8601 UTC
```

Actor reference:

``` json
{
  "type": "AGENT",
  "id": "..."
}
```

Entity reference:

``` json
{
  "type": "PROPERTY",
  "id": "..."
}
```

------------------------------------------------------------------------

# 9. Source and Collector Events

## 9.1 source.observed

**Producer:** Cloud Collector

Meaning:

A source listing was observed.

Payload:

``` json
{
  "provider": "SS_GE",
  "externalListingId": "...",
  "sourceUrl": "...",
  "observedAt": "...",
  "contentHash": "...",
  "adapterVersion": "...",
  "parserVersion": "...",
  "ownerIndicator": {
    "present": true,
    "type": "OWNER"
  }
}
```

Consumers: - Source Listing processor; - Opportunity processor; -
Collector analytics; - monitoring.

------------------------------------------------------------------------

## 9.2 source.changed

Meaning:

A previously observed source listing changed.

Payload:

``` json
{
  "provider": "SS_GE",
  "externalListingId": "...",
  "changedFields": [
    "price",
    "description"
  ],
  "previousHash": "...",
  "currentHash": "..."
}
```

Consumers: - Opportunity; - analytics; - notification; - matching if
linked Property exists.

------------------------------------------------------------------------

# 10. Owner Events

## 10.1 owner.created

Payload:

``` json
{
  "ownerId": "...",
  "displayName": "...",
  "source": "WEB"
}
```

Consumers: - search index; - analytics; - history.

------------------------------------------------------------------------

## 10.2 owner.updated

Payload:

``` json
{
  "ownerId": "...",
  "changedFields": [
    "displayName",
    "phone"
  ]
}
```

Audit stores before/after values separately.

------------------------------------------------------------------------

## 10.3 owner.merged

Payload:

``` json
{
  "survivingOwnerId": "...",
  "mergedOwnerIds": ["..."],
  "reason": "...",
  "reviewedBy": "..."
}
```

Consumers: - search; - analytics; - history; - notifications where
configured.

High-risk event.

------------------------------------------------------------------------

# 11. Opportunity Events

## 11.1 opportunity.created

Meaning:

A source listing satisfying Opportunity Feed eligibility was discovered.

Payload:

``` json
{
  "opportunityId": "...",
  "sourceListingId": "...",
  "provider": "SS_GE",
  "ownerVerified": true,
  "price": {
    "amount": 250000,
    "currency": "USD"
  },
  "propertyType": "APARTMENT",
  "district": "Saburtalo",
  "firstSeenAt": "..."
}
```

Consumers: - Opportunity Feed; - notifications; - search; - analytics; -
automation.

Important:

`opportunity.created` does not mean `property.created`.

------------------------------------------------------------------------

## 11.2 opportunity.updated

Payload:

``` json
{
  "opportunityId": "...",
  "changedFields": [
    "views",
    "description",
    "area"
  ]
}
```

Consumers: - feed; - search; - analytics.

------------------------------------------------------------------------

## 11.3 opportunity.claimed

Payload:

``` json
{
  "opportunityId": "...",
  "agentId": "...",
  "claimedAt": "...",
  "expiresAt": null
}
```

Consumers: - feed; - history; - notifications; - NextAction; -
analytics.

------------------------------------------------------------------------

## 11.4 opportunity.claim_refreshed

Payload:

``` json
{
  "opportunityId": "...",
  "agentId": "...",
  "activityAt": "..."
}
```

Usually low-priority for analytics.

------------------------------------------------------------------------

## 11.5 opportunity.claim_released

Payload:

``` json
{
  "opportunityId": "...",
  "agentId": "...",
  "releasedAt": "...",
  "reason": "..."
}
```

------------------------------------------------------------------------

## 11.6 opportunity.contact_recorded

Payload:

``` json
{
  "opportunityId": "...",
  "ownerId": "...",
  "agentId": "...",
  "outcome": "CALLBACK",
  "occurredAt": "...",
  "nextActionRequired": true
}
```

Consumers: - team contact marker; - NextAction; - history; -
analytics; - automation.

------------------------------------------------------------------------

## 11.7 opportunity.consent_confirmed

Payload:

``` json
{
  "opportunityId": "...",
  "ownerId": "...",
  "agentId": "...",
  "confirmedAt": "...",
  "confirmationMethod": "CALL"
}
```

This event is the business boundary crossing from market opportunity
toward CRM property.

------------------------------------------------------------------------

## 11.8 opportunity.converted

Payload:

``` json
{
  "opportunityId": "...",
  "propertyId": "...",
  "ownerId": "...",
  "convertedBy": "...",
  "convertedAt": "..."
}
```

Consumers: - history; - analytics; - automation; - matching; - search.

------------------------------------------------------------------------

## 11.9 opportunity.off_market

Payload:

``` json
{
  "opportunityId": "...",
  "sourceListingId": "...",
  "detectedAt": "...",
  "reason": "NOT_SEEN"
}
```

Off-market does not mean delete.

------------------------------------------------------------------------

## 11.10 opportunity.archived

Payload:

``` json
{
  "opportunityId": "...",
  "agentId": "...",
  "archivedAt": "...",
  "reason": "..."
}
```

Archive is personal.

------------------------------------------------------------------------

## 11.11 opportunity.restored

Payload:

``` json
{
  "opportunityId": "...",
  "agentId": "...",
  "restoredAt": "..."
}
```

------------------------------------------------------------------------

# 12. Property Events

## 12.1 property.created

Payload:

``` json
{
  "propertyId": "...",
  "ownerId": "...",
  "responsibleAgentId": "...",
  "sourceListingId": "...",
  "createdFrom": "OPPORTUNITY_CONVERSION"
}
```

Consumers: - search; - matching; - analytics; - notification; -
publication readiness; - automation.

------------------------------------------------------------------------

## 12.2 property.updated

Payload:

``` json
{
  "propertyId": "...",
  "changedFields": [
    "description",
    "balcony"
  ],
  "version": 15
}
```

------------------------------------------------------------------------

## 12.3 property.price_changed

Payload:

``` json
{
  "propertyId": "...",
  "oldPrice": {
    "amount": 260000,
    "currency": "USD"
  },
  "newPrice": {
    "amount": 245000,
    "currency": "USD"
  },
  "absoluteChange": -15000,
  "percentageChange": -5.77,
  "changedAt": "...",
  "source": "WEB"
}
```

Consumers: - matching; - notifications; - analytics; - search; -
automation.

------------------------------------------------------------------------

## 12.4 property.assigned

Payload:

``` json
{
  "propertyId": "...",
  "previousAgentId": "...",
  "newAgentId": "...",
  "assignedAt": "...",
  "reason": "..."
}
```

------------------------------------------------------------------------

## 12.5 property.archived

Payload:

``` json
{
  "propertyId": "...",
  "archivedAt": "...",
  "reason": "..."
}
```

------------------------------------------------------------------------

## 12.6 property.restored

Payload:

``` json
{
  "propertyId": "...",
  "restoredAt": "..."
}
```

------------------------------------------------------------------------

# 13. Client Events

## 13.1 client.created

Payload:

``` json
{
  "clientId": "...",
  "responsibleAgentId": "..."
}
```

Consumers: - search; - matching; - analytics; - history.

------------------------------------------------------------------------

## 13.2 client.updated

Payload:

``` json
{
  "clientId": "...",
  "changedFields": [
    "phone",
    "email"
  ]
}
```

------------------------------------------------------------------------

# 14. Client Requirement Events

## 14.1 client_requirement.created

Payload:

``` json
{
  "requirementId": "...",
  "clientId": "...",
  "responsibleAgentId": "...",
  "active": true
}
```

Consumers: - matching engine; - notifications; - analytics.

------------------------------------------------------------------------

## 14.2 client_requirement.updated

Payload:

``` json
{
  "requirementId": "...",
  "clientId": "...",
  "changedFields": [
    "maxPrice",
    "districts"
  ]
}
```

Matching must be recalculated.

------------------------------------------------------------------------

## 14.3 client_requirement.deactivated

Payload:

``` json
{
  "requirementId": "...",
  "clientId": "...",
  "deactivatedAt": "...",
  "reason": "..."
}
```

Consumers may invalidate active matches according to policy.

------------------------------------------------------------------------

# 15. Matching Events

## 15.1 match.created

Payload:

``` json
{
  "matchId": "...",
  "propertyId": "...",
  "clientId": "...",
  "requirementId": "...",
  "score": 0.91,
  "explanation": {
    "price": "WITHIN_RANGE",
    "rooms": "EXACT",
    "district": "MATCH",
    "area": "WITHIN_RANGE"
  }
}
```

Consumers: - responsible agent notification; - Today; - analytics; -
automation.

------------------------------------------------------------------------

## 15.2 match.invalidated

Payload:

``` json
{
  "matchId": "...",
  "reason": "PROPERTY_PRICE_CHANGED"
}
```

------------------------------------------------------------------------

# 16. Collaboration Events

## 16.1 collaboration.requested

Payload:

``` json
{
  "propertyId": "...",
  "requestingAgentId": "...",
  "responsibleAgentId": "...",
  "message": "...",
  "requestedAt": "..."
}
```

Consumers: - Messenger; - Notifications; - NextAction; - history.

Responsible ownership remains unchanged.

------------------------------------------------------------------------

# 17. Deal Events

## 17.1 deal.created

Payload:

``` json
{
  "dealId": "...",
  "propertyId": "...",
  "clientId": "...",
  "responsibleAgentId": "...",
  "stageId": "..."
}
```

Consumers: - analytics; - notifications; - automation; - Today.

------------------------------------------------------------------------

## 17.2 deal.stage_changed

Payload:

``` json
{
  "dealId": "...",
  "propertyId": "...",
  "clientId": "...",
  "fromStageId": "...",
  "toStageId": "...",
  "changedAt": "..."
}
```

Consumers: - history; - analytics; - automation; - NextAction; -
notifications.

------------------------------------------------------------------------

## 17.3 deal.won

Payload:

``` json
{
  "dealId": "...",
  "propertyId": "...",
  "clientId": "...",
  "responsibleAgentId": "...",
  "closedAt": "...",
  "price": {
    "amount": 250000,
    "currency": "USD"
  },
  "commission": {
    "amount": 5000,
    "currency": "USD"
  }
}
```

Consumers: - analytics; - achievement; - notifications; - automation; -
property lifecycle.

This event is financially significant and must be immutable.

------------------------------------------------------------------------

## 17.4 deal.lost

Payload:

``` json
{
  "dealId": "...",
  "propertyId": "...",
  "clientId": "...",
  "responsibleAgentId": "...",
  "reason": "...",
  "closedAt": "..."
}
```

Client requirement remains preserved.

------------------------------------------------------------------------

# 18. Showing Events

## 18.1 showing.scheduled

Payload:

``` json
{
  "showingId": "...",
  "dealId": "...",
  "propertyId": "...",
  "clientId": "...",
  "agentId": "...",
  "scheduledAt": "..."
}
```

Consumers: - Today; - notifications; - analytics; - history.

------------------------------------------------------------------------

## 18.2 showing.completed

Payload:

``` json
{
  "showingId": "...",
  "dealId": "...",
  "result": "POSITIVE",
  "completedAt": "...",
  "notes": "..."
}
```

Consumers: - analytics; - achievements; - automation; - NextAction.

------------------------------------------------------------------------

## 18.3 showing.cancelled

Payload:

``` json
{
  "showingId": "...",
  "dealId": "...",
  "reason": "...",
  "cancelledAt": "..."
}
```

------------------------------------------------------------------------

# 19. Next Action Events

## 19.1 next_action.created

Payload:

``` json
{
  "nextActionId": "...",
  "assigneeId": "...",
  "type": "CALL_OWNER",
  "priority": "HIGH",
  "dueAt": "...",
  "entityType": "OPPORTUNITY",
  "entityId": "...",
  "generated": true
}
```

Consumers: - Today; - notifications; - analytics.

------------------------------------------------------------------------

## 19.2 next_action.completed

Payload:

``` json
{
  "nextActionId": "...",
  "assigneeId": "...",
  "completedAt": "...",
  "result": "..."
}
```

------------------------------------------------------------------------

## 19.3 next_action.rescheduled

Payload:

``` json
{
  "nextActionId": "...",
  "previousDueAt": "...",
  "newDueAt": "...",
  "rescheduledAt": "..."
}
```

------------------------------------------------------------------------

## 19.4 next_action.cancelled

Payload:

``` json
{
  "nextActionId": "...",
  "cancelledAt": "...",
  "reason": "..."
}
```

------------------------------------------------------------------------

## 19.5 next_action.overdue

Payload:

```json
{
  "nextActionId": "...",
  "assigneeId": "...",
  "dueAt": "...",
  "detectedAt": "..."
}
```

Generated once when an open action crosses its deadline. Duplicate scheduler deliveries are idempotent.

------------------------------------------------------------------------

# 20. Publication Events

## 20.1 publication.prepared

Payload:

``` json
{
  "publicationId": "...",
  "propertyId": "...",
  "provider": "SS_GE",
  "status": "READY",
  "missingFields": []
}
```

------------------------------------------------------------------------

## 20.2 publication.confirmed

Payload:

``` json
{
  "publicationId": "...",
  "propertyId": "...",
  "provider": "SS_GE",
  "confirmedBy": "...",
  "confirmedAt": "..."
}
```

This event proves explicit human confirmation.

------------------------------------------------------------------------

## 20.3 publication.published

Payload:

``` json
{
  "publicationId": "...",
  "propertyId": "...",
  "provider": "SS_GE",
  "externalListingId": "...",
  "publishedAt": "..."
}
```

------------------------------------------------------------------------

## 20.4 publication.failed

Payload:

``` json
{
  "publicationId": "...",
  "propertyId": "...",
  "provider": "SS_GE",
  "errorCode": "...",
  "retryable": true,
  "failedAt": "..."
}
```

Never expose marketplace credentials.

------------------------------------------------------------------------

## 20.5 publication.unpublished

Payload:

``` json
{
  "publicationId": "...",
  "propertyId": "...",
  "provider": "SS_GE",
  "unpublishedAt": "...",
  "reason": "..."
}
```

------------------------------------------------------------------------

# 21. Messenger Events

## 21.1 message.sent

Payload:

``` json
{
  "messageId": "...",
  "conversationId": "...",
  "senderId": "...",
  "hasAttachments": true,
  "crmReferences": [
    {
      "type": "PROPERTY",
      "id": "..."
    }
  ],
  "sentAt": "..."
}
```

Message body itself may be stored separately and must respect
privacy/logging policy.

------------------------------------------------------------------------

## 21.2 message.reaction_added

Payload:

``` json
{
  "messageId": "...",
  "conversationId": "...",
  "userId": "...",
  "reaction": "👍"
}
```

------------------------------------------------------------------------

## 21.3 message.read

Payload:

```json
{
  "messageId": "...",
  "conversationId": "...",
  "userId": "...",
  "readAt": "..."
}
```

------------------------------------------------------------------------

## 21.4 crm_card.shared

Payload:

```json
{
  "messageId": "...",
  "conversationId": "...",
  "entityType": "PROPERTY",
  "entityId": "...",
  "sharedBy": "..."
}
```

------------------------------------------------------------------------

# 22. Document Events

## 22.1 document.created

Payload:

``` json
{
  "documentId": "...",
  "ownerType": "PROPERTY",
  "ownerId": "...",
  "uploadedBy": "...",
  "version": 1
}
```

------------------------------------------------------------------------

## 22.2 document.shared

Payload:

``` json
{
  "documentId": "...",
  "sharedBy": "...",
  "recipientType": "USER",
  "recipientId": "...",
  "sharedAt": "..."
}
```

------------------------------------------------------------------------

## 22.3 document.version_created

Payload:

``` json
{
  "documentId": "...",
  "version": 2,
  "createdBy": "...",
  "createdAt": "..."
}
```


---

## 22.4 document.archived

Payload:

```json
{
  "documentId": "...",
  "archivedBy": "...",
  "reason": "...",
  "archivedAt": "..."
}
```

---

# 23. Notification Events

## 23.1 notification.created

Payload:

``` json
{
  "notificationId": "...",
  "recipientId": "...",
  "category": "MATCH",
  "priority": "NORMAL",
  "entityType": "PROPERTY",
  "entityId": "...",
  "action": {
    "type": "OPEN_ENTITY"
  }
}
```

Notifications are derived outputs.

Business modules should normally emit business events, not directly
create notifications.

------------------------------------------------------------------------

## 23.2 notification.read

Payload:

``` json
{
  "notificationId": "...",
  "userId": "...",
  "readAt": "..."
}
```

------------------------------------------------------------------------

## 23.3 notification.delivered

Payload:

```json
{
  "notificationId": "...",
  "recipientId": "...",
  "channel": "IN_APP",
  "deliveredAt": "..."
}
```

Delivery is not a sales KPI.

------------------------------------------------------------------------

# 24. Automation Events

## 24.1 automation.executed

Payload:

``` json
{
  "executionId": "...",
  "ruleId": "...",
  "triggerEventId": "...",
  "actionsExecuted": [
    "CREATE_NEXT_ACTION",
    "SEND_NOTIFICATION"
  ],
  "executedAt": "..."
}
```

------------------------------------------------------------------------

## 24.2 automation.failed

Payload:

``` json
{
  "executionId": "...",
  "ruleId": "...",
  "triggerEventId": "...",
  "errorCode": "...",
  "retryable": true,
  "failedAt": "..."
}
```

------------------------------------------------------------------------

# 25. Achievement Events

## 25.1 achievement.awarded

Payload:

``` json
{
  "awardId": "...",
  "achievementTypeId": "...",
  "userId": "...",
  "periodType": "MONTH",
  "periodStart": "...",
  "periodEnd": "...",
  "rank": "GOLD",
  "score": 18.4,
  "evidence": {
    "dealsWon": 12,
    "showings": 31,
    "conversionRate": 0.38
  }
}
```

Award evidence must be reproducible from event-backed facts.

------------------------------------------------------------------------

# 26. Audit Events

Audit is generated from important domain events and explicit security
actions.

Recommended:

``` text
audit.recorded
```

This is normally an internal event and should not be treated as a
business fact consumed by business modules.

Audit records are immutable.

------------------------------------------------------------------------

# 27. Analytics Consumption

Analytics consumes business events.

Examples:

``` text
property.created
property.price_changed
opportunity.created
opportunity.contact_recorded
deal.created
deal.stage_changed
deal.won
deal.lost
showing.completed
next_action.completed
match.created
```

Analytics must be idempotent.

If the same event is delivered twice:

``` text
fact_count = 1
```

not:

``` text
fact_count = 2
```

Use event ID as a uniqueness key in fact processing.

------------------------------------------------------------------------

# 28. Achievement Consumption

Achievement qualification must consume validated facts.

It must not count raw UI actions.

Examples:

``` text
deal.won
showing.completed
next_action.created
```

are valid business evidence.

Opening a Property page is not an achievement event.

------------------------------------------------------------------------

# 29. Search Consumption

Search index consumers:

``` text
property.created
property.updated
property.archived
owner.created
owner.updated
client.created
client.updated
opportunity.created
opportunity.updated
deal.created
deal.stage_changed
```

Search index is rebuildable.

If index processing fails, source business data remains intact.

------------------------------------------------------------------------

# 30. Notification Consumption

Notification Engine consumes selected business events.

Example:

``` text
property.price_changed
        ↓
Matching
        ↓
match.created
        ↓
Notification Engine
        ↓
notification.created
```

This prevents business modules from knowing notification delivery
details.

------------------------------------------------------------------------

# 31. Automation Consumption

Automation Engine listens to eligible events.

Example:

``` text
property.price_changed
        ↓
Rule:
price reduction > 5%
        ↓
CREATE_MATCH
        ↓
match.created
        ↓
SEND_NOTIFICATION
        ↓
notification.created
```

Automation actions invoke domain commands.

They never perform arbitrary database writes.

------------------------------------------------------------------------

# 32. Event Ordering

Global ordering is not required.

Ordering is required within a logical aggregate/correlation stream where
business semantics depend on it.

Example:

``` text
property.created
→ property.price_changed
→ property.assigned
```

A consumer must not process:

``` text
property.price_changed
```

before observing the required property creation state if the consumer
depends on that state.

Recommended ordering key:

``` text
companyId + entityType + entityId
```

For cross-entity workflows, use:

``` text
correlationId
```

------------------------------------------------------------------------

# 33. At-Least-Once Delivery

KleeKto event delivery is:

``` text
AT-LEAST-ONCE
```

Therefore every consumer must be idempotent.

Exactly-once processing is not assumed.

------------------------------------------------------------------------

# 34. Consumer Idempotency

Recommended consumer table:

``` text
ProcessedEvent {
  consumerName
  eventId
  processedAt
}
```

Unique constraint:

``` text
consumerName + eventId
```

Consumer algorithm:

``` text
BEGIN
  check event already processed
  if yes → return success
  process
  mark processed
COMMIT
```

------------------------------------------------------------------------

# 35. Transactional Outbox

State and event creation:

``` text
BEGIN TRANSACTION

update aggregate
insert event
insert outbox record

COMMIT
```

Publisher:

``` text
Outbox
→ Event Bus
```

After successful delivery:

``` text
outbox.status = PUBLISHED
```

Failures:

``` text
retry
→ backoff
→ DLQ
```

------------------------------------------------------------------------

# 36. Dead Letter Queue

An event enters DLQ when retry policy is exhausted or the event is
permanently invalid.

DLQ record must include:

``` text
eventId
eventType
consumer
companyId
errorCode
attemptCount
firstFailedAt
lastFailedAt
correlationId
```

Admin/Platform operations can: - inspect; - retry; - quarantine; -
resolve.

No silent dropping.

------------------------------------------------------------------------

# 37. Retry Policy

Suggested:

``` text
attempt 1: immediate
attempt 2: 5 sec
attempt 3: 30 sec
attempt 4: 2 min
attempt 5: 10 min
attempt 6: 30 min
```

Actual values remain configurable.

External 429: - honor Retry-After where available.

------------------------------------------------------------------------

# 38. Poison Event Protection

An event repeatedly failing because of malformed data must not block an
entire partition/queue.

Move poison events to DLQ after policy threshold.

Continue processing independent events.

------------------------------------------------------------------------

# 39. Correlation Example --- Opportunity Conversion

``` text
COMMAND:
CONVERT_OPPORTUNITY_TO_PROPERTY

correlationId = C123
```

Events:

``` text
opportunity.consent_confirmed
  correlationId=C123

property.created
  correlationId=C123
  causationId=<consent-event>

opportunity.converted
  correlationId=C123

match.created
  correlationId=C123

notification.created
  correlationId=C123
```

This allows the complete operation to be reconstructed.

------------------------------------------------------------------------

# 40. Correlation Example --- Price Change

``` text
CHANGE_PROPERTY_PRICE
        ↓
property.price_changed
        ↓
Matching
        ↓
match.created
        ↓
notification.created
        ↓
next_action.created
```

All events share one correlation ID.

------------------------------------------------------------------------

# 41. Event → Consumer Matrix

  -----------------------------------------------------------------------------------------------------------------------------
  Event                          Audit   Search   Matching   Notification   NextAction   Analytics   Achievement   Automation
  ------------------------------ ------- -------- ---------- -------------- ------------ ----------- ------------- ------------
  opportunity.created            ✓       ✓        ---        ✓              optional     ✓           ---           ✓

  opportunity.contact_recorded   ✓       ---      ---        ✓              ✓            ✓           ---           ✓

  opportunity.converted          ✓       ✓        ✓          ✓              ---          ✓           ---           ✓

  property.created               ✓       ✓        ✓          optional       optional     ✓           ---           ✓

  property.updated               ✓       ✓        ✓          optional       ---          ✓           ---           ✓

  property.price_changed         ✓       ✓        ✓          ✓              ✓            ✓           ---           ✓

  client_requirement.created     ✓       ✓        ✓          optional       ---          ✓           ---           ✓

  client_requirement.updated     ✓       ✓        ✓          optional       ---          ✓           ---           ✓

  match.created                  ✓       ---      ---        ✓              optional     ✓           ---           ✓

  deal.created                   ✓       ✓        ---        optional       ✓            ✓           ---           ✓

  deal.stage_changed             ✓       ✓        ---        ✓              ✓            ✓           ---           ✓

  deal.won                       ✓       ✓        ---        ✓              ---          ✓           ✓             ✓

  deal.lost                      ✓       ✓        ---        optional       ✓            ✓           ---           ✓

  showing.completed              ✓       ---      ---        optional       optional     ✓           ✓             ✓

  next_action.created          ✓       ---      ---        optional       ---          ✓           ✓             ✓

  publication.published          ✓       ✓        ---        optional       ---          ✓           ---           ✓

  message.sent                   ✓       ---      ---        ✓              optional     optional    ---           ---
  -----------------------------------------------------------------------------------------------------------------------------

The matrix is directional.

A checkmark means a consumer is permitted/expected to react, not that it
must perform work for every event.

------------------------------------------------------------------------

# 42. Business vs Technical Events

Business events:

``` text
property.created
deal.won
showing.completed
```

Technical events:

``` text
collector.job.failed
worker.dead_lettered
integration.timeout
```

Business analytics must not be polluted by technical retry events.

Technical observability consumes both.

------------------------------------------------------------------------

# 43. Collector Technical Events

Recommended internal events:

``` text
collector.job.started
collector.job.completed
collector.job.failed
collector.adapter_degraded
collector.adapter_recovered
```

Payload:

``` json
{
  "jobId": "...",
  "provider": "SS_GE",
  "durationMs": 1820,
  "itemsObserved": 430,
  "itemsChanged": 22,
  "errors": 3
}
```

These belong primarily to platform observability.

------------------------------------------------------------------------

# 44. Integration Events

Recommended:

``` text
integration.requested
integration.succeeded
integration.failed
integration.rate_limited
```

These are technical events.

Never put: - API key; - cookies; - authorization header; - session
token; - secret URL parameters

into payloads.

------------------------------------------------------------------------

# 45. Schema Versioning

Events are immutable.

If payload evolves compatibly:

``` text
schemaVersion = 2
```

may add optional fields.

Breaking changes require: - new schema version; - consumer
compatibility; - migration strategy.

Never change the meaning of an existing field without versioning.

------------------------------------------------------------------------

# 46. Backward Compatibility

Preferred compatibility:

``` text
v1 producer
→ v1 consumer
```

During migration:

``` text
v2 producer
→ v1-compatible payload
```

or:

``` text
v1 + v2 consumers
```

Avoid long-lived dual semantics.

------------------------------------------------------------------------

# 47. Event Retention

Domain events should be retained long enough to support:

-   audit;
-   analytics rebuild;
-   achievement recalculation;
-   incident investigation;
-   historical timeline.

Exact infrastructure retention may vary by environment.

Critical business events should not be automatically purged under
ordinary operational retention.

------------------------------------------------------------------------

# 48. Privacy and PII

Event payloads must minimize PII.

Do not put: - full phone numbers unless operationally necessary; -
passwords; - access tokens; - payment credentials; - source cookies; -
private document contents.

Prefer:

``` json
{
  "ownerId": "..."
}
```

instead of repeating personal data.

Audit may store sensitive before/after values under stricter
authorization.

------------------------------------------------------------------------

# 49. Event Security

Every event is tenant-scoped.

Consumers must verify:

``` text
event.companyId == processingContext.companyId
```

Cross-tenant event consumption is forbidden.

Event Bus credentials are service-scoped.

Consumers receive only required permissions.

------------------------------------------------------------------------

# 50. Event Replay

Events may be replayed for:

-   rebuilding search;
-   rebuilding analytics;
-   repairing derived notifications;
-   reconstructing read models.

Replay must not blindly re-run irreversible business actions.

Therefore event consumers must distinguish:

``` text
REPLAYABLE_DERIVATION
```

from:

``` text
LIVE_SIDE_EFFECT
```

Examples:

Search indexing: - replayable.

Analytics: - replayable.

Sending an external marketplace publication: - not replayable
automatically.

Sending a real notification: - not replayable automatically unless
explicitly requested.

------------------------------------------------------------------------

# 51. Replay Safety

Each consumer must declare:

``` text
supportsReplay: true | false
```

and:

``` text
sideEffectPolicy:
  DERIVED_ONLY
  IDEMPOTENT_EXTERNAL
  HUMAN_CONFIRMATION_REQUIRED
  NEVER_REPLAY
```

------------------------------------------------------------------------

# 52. Event Contract Testing

For every event:

1.  validate schema;
2.  validate required envelope fields;
3.  validate payload;
4.  validate producer;
5.  validate consumer compatibility;
6.  validate idempotency;
7.  validate tenant isolation.

Contract tests must run in CI.

------------------------------------------------------------------------

# 53. Domain Command → Event Mapping

Minimum canonical mapping:

``` text
REFRESH_OPPORTUNITY_CLAIM
→ opportunity.claim_refreshed

RELEASE_OPPORTUNITY_CLAIM
→ opportunity.claim_released

ARCHIVE_OPPORTUNITY
→ opportunity.archived

RESTORE_OPPORTUNITY
→ opportunity.restored

CREATE_OWNER
→ owner.created

UPDATE_OWNER
→ owner.updated

MERGE_OWNER
→ owner.merged

PROCESS_SOURCE_OBSERVATION
→ source.observed
→ source.changed (when applicable)

CLAIM_OPPORTUNITY
→ opportunity.claimed

RECORD_OPPORTUNITY_CONTACT
→ opportunity.contact_recorded

RECORD_OPPORTUNITY_CONTACT (outcome=CONSENT_GIVEN)
→ opportunity.contact_recorded
→ opportunity.consent_confirmed

CONVERT_OPPORTUNITY_TO_PROPERTY
→ property.created
→ opportunity.converted

CREATE_PROPERTY
→ property.created

UPDATE_PROPERTY
→ property.updated

CHANGE_PROPERTY_PRICE
→ property.price_changed

ASSIGN_PROPERTY
→ property.assigned

ARCHIVE_PROPERTY
→ property.archived

RESTORE_PROPERTY
→ property.restored

CREATE_CLIENT
→ client.created

UPDATE_CLIENT
→ client.updated

CREATE_CLIENT_REQUIREMENT
→ client_requirement.created

UPDATE_CLIENT_REQUIREMENT
→ client_requirement.updated

CREATE_MATCH
→ match.created

INVALIDATE_MATCH
→ match.invalidated

REQUEST_PROPERTY_COLLABORATION
→ collaboration.requested

CREATE_DEAL
→ deal.created

CHANGE_DEAL_STAGE
→ deal.stage_changed

CLOSE_DEAL_WON
→ deal.won

CLOSE_DEAL_LOST
→ deal.lost

SCHEDULE_SHOWING
→ showing.scheduled

COMPLETE_SHOWING
→ showing.completed

CANCEL_SHOWING
→ showing.cancelled

CREATE_NEXT_ACTION
→ next_action.created

COMPLETE_NEXT_ACTION
→ next_action.completed

RESCHEDULE_NEXT_ACTION
→ next_action.rescheduled

CANCEL_NEXT_ACTION
→ next_action.cancelled

IMPORT_SOURCE_LISTING
→ source.observed

PREPARE_PUBLICATION
→ publication.prepared

CONFIRM_PUBLICATION
→ publication.confirmed

CREATE_MESSAGE
→ message.sent

MARK_MESSAGE_READ
→ message.read

ADD_MESSAGE_REACTION
→ message.reaction_added

SHARE_CRM_CARD
→ crm_card.shared

CREATE_DOCUMENT
→ document.created

SHARE_DOCUMENT
→ document.shared

CREATE_DOCUMENT_VERSION
→ document.version_created

ARCHIVE_DOCUMENT
→ document.archived

MARK_NOTIFICATION_READ
→ notification.read

MARK_ALL_NOTIFICATIONS_READ
→ notification.read (one event per affected notification)

ASSIGN_USER_ROLE
→ user.role_assigned

SUSPEND_USER
→ user.suspended

GRANT_SUPPORT_ACCESS
→ support_access.granted

REVOKE_SUPPORT_ACCESS
→ support_access.revoked

EXECUTE_AUTOMATION
→ automation.executed
```

------------------------------------------------------------------------

# 54. Forbidden Event Patterns

Do not create events such as:

``` text
button.clicked
page.opened
modal.opened
mouse.moved
form.focused
```

unless required strictly for technical telemetry.

These are not domain events.

The business event system records meaningful facts.

------------------------------------------------------------------------

# 55. Forbidden Consumer Patterns

Never:

``` text
Event Consumer
→ arbitrary SQL UPDATE
```

Never:

``` text
Notification module
→ directly mutate Property
```

Never:

``` text
Analytics
→ mutate Deal
```

Never:

``` text
Automation
→ arbitrary database operation
```

Correct:

``` text
Consumer
→ authorized Domain Command
→ Domain Service
→ State Change
→ Event
```

------------------------------------------------------------------------

# 56. Circular Event Protection

Example danger:

``` text
property.updated
→ automation
→ UPDATE_PROPERTY
→ property.updated
→ automation
→ ...
```

Protection mechanisms:

-   correlation ID;
-   causation ID;
-   execution depth;
-   idempotency key;
-   rule execution record;
-   max chain depth;
-   duplicate action detection.

Automation must declare whether it can react to events it creates.

------------------------------------------------------------------------

# 57. Event Chain Limits

Default:

``` text
max automation depth = configurable
```

Suggested initial maximum:

``` text
10
```

Exceeding limit:

``` text
automation.chain_limit_reached
```

and execution is stopped.

------------------------------------------------------------------------

# 58. Event Store vs Event Bus

KleeKto MVP does not require full event sourcing.

Use:

``` text
PostgreSQL
+
Event table
+
Transactional Outbox
+
Queue/Event Bus
```

The current entity state remains authoritative.

Events provide: - history; - integration; - derived processing; -
analytics; - automation.

------------------------------------------------------------------------

# 59. Eventual Consistency

Derived systems are eventually consistent.

Examples:

``` text
Property created
→ search index shortly afterward
→ matching shortly afterward
→ notification shortly afterward
→ analytics shortly afterward
```

UI should communicate processing states where necessary.

Core transactional state must remain immediately consistent.

------------------------------------------------------------------------

# 60. Failure Semantics

If domain transaction fails:

``` text
no state change
no event
no outbox
```

If transaction succeeds but consumer fails:

``` text
state remains correct
event remains available
consumer retries
```

If consumer permanently fails:

``` text
DLQ
+
incident
+
operator action
```

Never roll back a successful business transaction because a derived
consumer failed.

------------------------------------------------------------------------

# 61. Incident Integration

Critical event-processing failures create platform incidents.

Example:

``` text
publication.failed
```

may create company-visible operational state.

Example:

``` text
analytics consumer failed
```

is primarily platform technical incident.

Severity must follow operational impact.

------------------------------------------------------------------------

# 62. Event Observability

Every event should be traceable by:

``` text
eventId
commandId
requestId
correlationId
causationId
companyId
entityType
entityId
```

A support/admin view should be able to reconstruct:

``` text
What happened?
Who caused it?
When?
From where?
What caused it?
What did it trigger?
Did any consumer fail?
```

------------------------------------------------------------------------

# 63. Critical Trace Example

``` text
requestId = R100
correlationId = C500

CHANGE_PROPERTY_PRICE
        ↓
property.price_changed
        ↓
Matching consumer
        ↓
match.created
        ↓
Notification consumer
        ↓
notification.created
        ↓
NextAction consumer
        ↓
next_action.created
```

All can be traced back to `R100 / C500`.

------------------------------------------------------------------------

# 64. API/Event Boundary

API response represents the immediate command result.

Events represent asynchronous consequences.

Example:

``` text
POST /properties/:id/change-price
```

Response:

``` json
{
  "data": {
    "propertyId": "...",
    "price": 245000
  }
}
```

The response does not wait for:

``` text
matching
notifications
analytics
achievements
```

unless a specific synchronous contract explicitly requires it.

------------------------------------------------------------------------

# 65. Extension Event Boundary

Extension-originated actions produce normal domain events.

The system must not create a separate parallel business history for
extension actions.

Example:

``` text
Extension
→ IMPORT_SOURCE_LISTING
→ property.created
```

Source:

``` text
EXTENSION
```

is sufficient to identify origin.

------------------------------------------------------------------------

# 66. Collector Event Boundary

Collector observations are source facts.

They do not represent human consent.

Therefore:

``` text
source.observed
```

can create:

``` text
opportunity.created
```

but cannot create:

``` text
property.created
```

unless a separate explicit consent/import workflow occurs.

This is a fundamental KleeKto invariant.

------------------------------------------------------------------------

# 67. Publication Event Boundary

Publication events must never imply human consent to property ownership.

Separate concepts:

``` text
owner consent
publication confirmation
```

Both are explicit business facts.

------------------------------------------------------------------------

# 68. Achievement Integrity

Achievement calculations must use immutable event-backed facts.

No agent can increase an achievement score by: - opening screens; -
manually editing counters; - changing a derived statistic.

If an underlying Deal is corrected, a new business event explains the
correction.

------------------------------------------------------------------------

# 69. Analytics Integrity

Analytics facts are derived.

If an event is corrected:

``` text
original event
+
correction event
```

not mutation of historical event.

Analytics processor recalculates derived facts according to correction
policy.

------------------------------------------------------------------------

# 70. Correction Events

For exceptional corrections, use explicit facts such as:

``` text
deal.corrected
property.corrected
analytics.adjustment_recorded
```

Never edit the original immutable domain event.

Correction must include:

``` json
{
  "originalEventId": "...",
  "reason": "...",
  "approvedBy": "..."
}
```

------------------------------------------------------------------------

# 71. Event Contract Freeze Rules

Version 1.0 is frozen when:

-   every MVP domain command has a mapped event;
-   every MVP business event has a schema;
-   all events have tenant context;
-   event envelope is implemented;
-   Outbox is transactional;
-   consumer idempotency is implemented;
-   critical event chains pass integration tests;
-   replay policy exists;
-   DLQ exists;
-   contract tests run in CI.

------------------------------------------------------------------------

# 72. MVP Event Contract Checklist

## Core

-   [ ] Event envelope
-   [ ] Event table
-   [ ] Outbox table
-   [ ] Publisher
-   [ ] Consumer registry
-   [ ] Processed-event tracking
-   [ ] Correlation IDs
-   [ ] Causation IDs
-   [ ] Idempotency

## Business

-   [ ] Opportunity
-   [ ] Owner
-   [ ] Property
-   [ ] Client
-   [ ] Requirement
-   [ ] Matching
-   [ ] Deal
-   [ ] Showing
-   [ ] NextAction
-   [ ] Publication

## Platform

-   [ ] Notifications
-   [ ] Messenger
-   [ ] Documents
-   [ ] Automation
-   [ ] Search
-   [ ] Analytics
-   [ ] Achievement
-   [ ] Collector
-   [ ] Integrations

## Reliability

-   [ ] Retry
-   [ ] DLQ
-   [ ] Replay policy
-   [ ] Incident creation
-   [ ] Monitoring
-   [ ] Contract tests

------------------------------------------------------------------------

# 73. Final Event Graph

The primary KleeKto event graph is:

``` text
SOURCE
  │
  └── source.observed
          │
          ▼
   opportunity.created
          │
          ├── opportunity.claimed
          │        │
          │        └── opportunity.contact_recorded
          │                    │
          │                    └── opportunity.consent_confirmed
          │                               │
          │                               ▼
          │                         property.created
          │                               │
          │                ┌──────────────┼──────────────┐
          │                ▼              ▼              ▼
          │             matching       search        analytics
          │                │
          │                ▼
          │          match.created
          │                │
          │                ▼
          │          notification
          │
          ▼
       Property
          │
          ├── property.updated
          ├── property.price_changed
          │         │
          │         └── matching → notification → NextAction
          │
          └── Deal
                │
                ├── deal.created
                ├── deal.stage_changed
                │
                ├── showing.scheduled
                ├── showing.completed
                │
                ├── deal.won
                │      │
                │      ├── analytics
                │      └── achievement.awarded
                │
                └── deal.lost
```

------------------------------------------------------------------------

# 74. Security and Platform Event Contracts

Security events are first-class audit facts but are excluded from sales/achievement KPIs.

## user.login

```json
{
  "userId": "...",
  "sessionId": "...",
  "occurredAt": "..."
}
```

## user.logout

```json
{
  "userId": "...",
  "sessionId": "...",
  "occurredAt": "..."
}
```

## user.login_failed

```json
{
  "identifierType": "EMAIL",
  "reasonCode": "INVALID_CREDENTIALS",
  "occurredAt": "..."
}
```

Do not store passwords, tokens, or raw credentials.

## user.session_revoked

```json
{
  "userId": "...",
  "sessionId": "...",
  "reason": "...",
  "occurredAt": "..."
}
```

## user.role_assigned

```json
{
  "userId": "...",
  "roleId": "...",
  "assignedBy": "...",
  "occurredAt": "..."
}
```

## user.suspended

```json
{
  "userId": "...",
  "suspendedBy": "...",
  "reason": "...",
  "occurredAt": "..."
}
```

## security.authorization_denied

```json
{
  "action": "property.assign",
  "resourceType": "PROPERTY",
  "resourceId": "...",
  "reason": "OWNERSHIP_DENIED",
  "occurredAt": "..."
}
```

## security.sensitive_action_confirmed

```json
{
  "action": "publication.confirm",
  "resourceType": "PUBLICATION",
  "resourceId": "...",
  "confirmedBy": "...",
  "occurredAt": "..."
}
```

## support_access.granted

## support_access.revoked

Payload:

```json
{
  "supportSessionId": "...",
  "companyId": "...",
  "scope": ["..."],
  "reason": "...",
  "occurredAt": "..."
}
```

These events are immutable and subject to stricter access than ordinary business history.

---

# 75. Final Contract

KleeKto's event architecture follows five immutable principles:

### 1. Events are facts

They describe what happened, not what should happen.

### 2. State and event are atomic

A successful business transaction creates its event in the same
transaction.

### 3. Delivery is at-least-once

Every consumer is idempotent.

### 4. Derived modules react through events

Notifications, Matching, Analytics, Achievement, Search and Automation
do not become tightly coupled to business modules.

### 5. History is never rewritten

Corrections create new facts.

------------------------------------------------------------------------

# 76. Final KleeKto Contract

The complete architecture is:

``` text
COMMAND
  ↓
AUTHORIZATION
  ↓
DOMAIN INVARIANTS
  ↓
TRANSACTION
  ├── STATE
  ├── EVENT
  └── OUTBOX
        ↓
     EVENT BUS
        ↓
 ┌──────┼────────┬──────────┬───────────┐
 ▼      ▼        ▼          ▼           ▼
AUDIT  MATCH   NOTIFY   ANALYTICS   AUTOMATION
 │      │        │          │           │
 ▼      ▼        ▼          ▼           ▼
HISTORY      NEXT ACTION  ACHIEVEMENT  COMMAND
```

And the central product invariant remains:

> **KleeKto automatically observes the market, but only explicit
> business actions create CRM state. Every meaningful state transition
> produces an immutable, traceable event that can safely drive the rest
> of the operating system.**

**This document is the KleeKto Event Catalog & Event Contracts v1.0
implementation baseline.**
