# KleeKto --- Database & Domain Schema v1.0

**Document status:** FROZEN DATA MODEL BASELINE\
**Version:** 1.0\
**Purpose:** Concrete PostgreSQL/Prisma-oriented database and domain
schema for KleeKto MVP 1.0.

------------------------------------------------------------------------

# 1. Data Architecture Rules

PostgreSQL is the transactional source of truth.

The schema must preserve: - tenant isolation; - domain relationships; -
source provenance; - immutable history; - auditability; - idempotency; -
deduplication; - configurable workflows; - historical analytics.

Core rule:

> No schema shortcut may destroy an existing relationship, historical
> fact, source snapshot, or audit trail.

Use opaque IDs, preferably UUID/UUID-like IDs.

Use UTC timestamps in storage.

All tenant-scoped records must carry `companyId` directly or be safely
tenant-derived through a mandatory parent relationship.

------------------------------------------------------------------------

# 2. Naming Conventions

Database: - snake_case

Application/Prisma: - camelCase

Primary key: - `id`

Foreign key: - `<entity>Id`

Timestamps: - `createdAt` - `updatedAt`

Historical/event timestamp: - `occurredAt`

Soft lifecycle fields: - `archivedAt` - `deletedAt` only where true
deletion is permitted by policy

Never use physical deletion for immutable business history.

------------------------------------------------------------------------

# 3. Core Enums

## CompanyStatus

``` text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
DELETED
```

## UserStatus

``` text
INVITED
ACTIVE
SUSPENDED
DEACTIVATED
```

## RoleCode

``` text
ADMIN
MANAGER
AGENT
VIEWER
```

## OpportunityStatus

``` text
AVAILABLE
IN_WORK
CONTACTED
CONSENTED
CONVERTED
OFF_MARKET
ARCHIVED
```

## ClaimStatus

``` text
ACTIVE
RELEASED
EXPIRED
```

## OwnerContactOutcome

``` text
NO_ANSWER
CALLBACK
INTERESTED
CONSENT_GIVEN
DECLINED
WRONG_NUMBER
NOT_OWNER
OTHER
```

## PropertyStatus

``` text
ACTIVE
RESERVED
SOLD
RENTED
OFF_MARKET
ARCHIVED
```

## DealOutcome

``` text
OPEN
WON
LOST
```

## ShowingResult

``` text
COMPLETED
CANCELLED
NO_SHOW
POSITIVE
NEGATIVE
FOLLOW_UP
```

## NextActionStatus

``` text
OPEN
IN_PROGRESS
COMPLETED
CANCELLED
```

## Priority

``` text
LOW
NORMAL
HIGH
URGENT
```

## PublicationStatus

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

## MarketplaceProvider

``` text
SS_GE
MYHOME_GE
```

## PublicationProvider

`PublicationProvider` uses the same current values as `MarketplaceProvider` in MVP 1.0. Keep the concepts separate so future source-only or publication-only providers can be added without changing the domain model.

## DocumentVisibility

``` text
PRIVATE
COMPANY
SHARED
```

## EventActorType

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

## EventSource

``` text
WEB
EXTENSION
COLLECTOR
SYSTEM
AUTOMATION
IMPORT
INTEGRATION
```

## IncidentSeverity

``` text
INFO
WARNING
ERROR
CRITICAL
```

## IncidentStatus

``` text
OPEN
INVESTIGATING
MITIGATED
RESOLVED
```

------------------------------------------------------------------------

# 4. Company and Identity

## 4.1 Company

``` text
Company
-------
id                  PK
name
status              CompanyStatus
timezone
defaultLocale
createdAt
updatedAt
```

Indexes: - status - createdAt

------------------------------------------------------------------------

## 4.2 User

``` text
User
----
id                  PK
companyId           FK Company
identityProvider
identitySubject
email
name
status              UserStatus
createdAt
updatedAt
lastLoginAt
```

Constraints: - `(identityProvider, identitySubject)` unique where
applicable - `(companyId, email)` unique

Indexes: - companyId - companyId + status - companyId + email

------------------------------------------------------------------------

## 4.3 Role

``` text
Role
----
id                  PK
companyId?          FK Company
code
name
isSystem
createdAt
updatedAt
```

System roles may have null companyId.

Unique: - `(companyId, code)`

------------------------------------------------------------------------

## 4.4 Permission

``` text
Permission
----------
id                  PK
code                UNIQUE
description
createdAt
```

------------------------------------------------------------------------

## 4.5 RolePermission

``` text
RolePermission
--------------
roleId              FK Role
permissionId        FK Permission
PRIMARY KEY(roleId, permissionId)
```

------------------------------------------------------------------------

## 4.6 UserRole

``` text
UserRole
--------
userId              FK User
roleId              FK Role
PRIMARY KEY(userId, roleId)
```

------------------------------------------------------------------------

## 4.7 Team

``` text
Team
----
id                  PK
companyId           FK Company
name
createdAt
updatedAt
```

------------------------------------------------------------------------

## 4.8 TeamMember

``` text
TeamMember
----------
teamId              FK Team
userId              FK User
createdAt

PRIMARY KEY(teamId, userId)
```

------------------------------------------------------------------------

# 5. Owner Domain

## 5.1 Owner

``` text
Owner
-----
id                  PK
companyId           FK Company
displayName
notes
status
createdAt
updatedAt
archivedAt?
```

Indexes: - companyId - companyId + displayName

------------------------------------------------------------------------

## 5.2 OwnerPhone

``` text
OwnerPhone
----------
id                  PK
companyId           FK Company
ownerId             FK Owner
phoneRaw
phoneNormalized
isPrimary
isVerified
source
createdAt
updatedAt
```

Unique within one Owner: - `(ownerId, phoneNormalized)` where
`phoneNormalized` is non-null.

Index for resolution: - `(companyId, phoneNormalized)`.

The same normalized phone may legitimately resolve to multiple Owners
inside one company (for example shared/family/business numbers).
Therefore phone is strong resolution evidence but not an unconditional
company-wide uniqueness constraint. Multiple candidates require explicit
resolution/review; no silent merge is allowed.

Normalization is performed before persistence.

------------------------------------------------------------------------

## 5.3 OwnerEmail

``` text
OwnerEmail
----------
id                  PK
ownerId             FK Owner
companyId           FK Company
emailRaw
emailNormalized
isPrimary
isVerified
createdAt
updatedAt
```

Unique: - `(companyId, emailNormalized)`

------------------------------------------------------------------------

## 5.4 OwnerSourceReference

``` text
OwnerSourceReference
--------------------
id                  PK
ownerId             FK Owner
companyId           FK Company
provider            MarketplaceProvider
externalOwnerId
metadata JSONB
createdAt
updatedAt
```

Unique: - `(companyId, provider, externalOwnerId)`

------------------------------------------------------------------------

# 6. Source / Market Domain

## 6.1 SourceListing

Represents an external marketplace listing.

``` text
SourceListing
-------------
id                  PK
companyId           FK Company
provider            MarketplaceProvider
externalId
sourceUrl
currentStatus
firstSeenAt
lastSeenAt
lastObservedAt
currentSnapshotId?
createdAt
updatedAt
```

Unique: - `(companyId, provider, externalId)`

------------------------------------------------------------------------

## 6.2 SourceObservation

Immutable observation.

``` text
SourceObservation
-----------------
id                  PK
companyId           FK Company
sourceListingId     FK SourceListing
observedAt
rawPayload JSONB
normalizedPayload JSONB
contentHash
parserVersion
adapterVersion
ownerIndicator
price
currency
views
title
description
locationData JSONB
propertyData JSONB
mediaData JSONB
createdAt
```

Indexes: - sourceListingId + observedAt - companyId + observedAt -
companyId + contentHash

Never update historical observations.

### 6.3 Platform collector cache boundary

An implementation may maintain a separate platform-scoped cache of
public marketplace facts to deduplicate external collection across
companies. That cache is infrastructure and is outside the tenant CRM
business schema defined above.

Company `SourceListing` / `SourceObservation` records remain tenant
projections for the purposes of this schema and may contain only source
facts/provenance. Company-private claims, contacts, consent, notes,
archives, Clients, Deals, or other work state must never be copied into
a platform-global cache or exposed across tenants.

------------------------------------------------------------------------

# 7. Opportunity Domain

## 7.1 Opportunity

``` text
Opportunity
-----------
id                  PK
companyId           FK Company
sourceListingId     FK SourceListing
ownerId?            FK Owner
status              OpportunityStatus
ownerVerified       Boolean
title
description
price
currency
area
rooms
propertyType
propertySubtype
district
addressText
views
firstSeenAt
lastSeenAt
lastPriceChangeAt?
claimedById?
claimedAt?
lastClaimActivityAt?
convertedPropertyId?
archivedAt?
createdAt
updatedAt
```

Constraints: - companyId must equal SourceListing.companyId; -
convertedPropertyId, if present, must belong to same company; -
ownerVerified must be true for Feed eligibility.

Indexes: - companyId + status - companyId + firstSeenAt - companyId +
lastSeenAt - companyId + price - companyId + district - companyId +
ownerVerified - companyId + claimedById

------------------------------------------------------------------------

## 7.2 OpportunityClaim

``` text
OpportunityClaim
----------------
id                  PK
companyId           FK Company
opportunityId       FK Opportunity
userId              FK User
status              ClaimStatus
claimedAt
lastActivityAt
releasedAt?
expiresAt?
```

Index: - companyId + opportunityId + status

Only one active claim should normally exist per Opportunity.

------------------------------------------------------------------------

## 7.3 OpportunityContact

``` text
OpportunityContact
------------------
id                  PK
companyId           FK Company
opportunityId       FK Opportunity
ownerId?
agentId             FK User
channel
outcome             OwnerContactOutcome
occurredAt
notes
createdAt
```

Indexes: - companyId + opportunityId + occurredAt - companyId +
agentId + occurredAt

This is historical. Never overwrite previous contacts.

------------------------------------------------------------------------

## 7.4 OpportunityArchive

``` text
OpportunityArchive
------------------
id                  PK
companyId           FK Company
opportunityId       FK Opportunity
userId              FK User
archivedAt
restoredAt?
```

Archive is personal unless company policy explicitly changes visibility.

------------------------------------------------------------------------

# 8. Property Domain

## 8.1 Property

``` text
Property
--------
id                  PK
companyId           FK Company
ownerId             FK Owner
responsibleAgentId  FK User
status              PropertyStatus

propertyType
propertySubtype
title
description

price
currency
area
rooms

country
city
district
subdistrict
street
addressText
latitude?
longitude?

condition

createdAt
updatedAt
archivedAt?
```

Indexes: - companyId + status - companyId + responsibleAgentId -
companyId + ownerId - companyId + district - companyId + propertyType -
companyId + rooms - companyId + price - companyId + area

------------------------------------------------------------------------

## 8.2 PropertyCharacteristic

Use a normalized flexible structure for MVP characteristics.

``` text
PropertyCharacteristic
----------------------
id                  PK
companyId           FK Company
propertyId          FK Property
key
valueBoolean?
valueNumber?
valueText?
valueCode?
createdAt
updatedAt
```

Unique: - `(propertyId, key)`

Examples: - balcony - elevator - furniture - parking - heating -
airConditioning

------------------------------------------------------------------------

## 8.3 PropertySourceReference

``` text
PropertySourceReference
-----------------------
id                  PK
companyId           FK Company
propertyId          FK Property
sourceListingId     FK SourceListing
provider            MarketplaceProvider
externalId
sourceUrl
linkedAt
```

Unique: - `(companyId, provider, externalId)`

------------------------------------------------------------------------

## 8.4 PropertySourceSnapshot

Immutable original snapshot.

``` text
PropertySourceSnapshot
----------------------
id                  PK
companyId           FK Company
propertyId          FK Property
sourceListingId?
capturedAt
payload JSONB
contentHash
createdAt
```

------------------------------------------------------------------------

## 8.5 PropertyPriceHistory

Although price changes are event-backed, an optimized query model is
recommended.

``` text
PropertyPriceHistory
--------------------
id                  PK
companyId           FK Company
propertyId          FK Property
oldPrice
newPrice
currency
changedAt
eventId             FK Event
```

------------------------------------------------------------------------

# 9. Media Domain

## 9.1 MediaAsset

``` text
MediaAsset
----------
id                  PK
companyId           FK Company
ownerType
ownerId
storageKey
originalFilename
mimeType
sizeBytes
checksum
width?
height?
status
createdById?
createdAt
updatedAt
```

`ownerType` must be a controlled enum/domain discriminator, not
arbitrary user input.

------------------------------------------------------------------------

## 9.2 PropertyMedia

``` text
PropertyMedia
-------------
id                  PK
companyId           FK Company
propertyId          FK Property
mediaAssetId        FK MediaAsset
sortOrder
isPrimary
createdAt
```

Unique: - `(propertyId, mediaAssetId)`

------------------------------------------------------------------------

# 10. Client Domain

## 10.1 Client

``` text
Client
------
id                  PK
companyId           FK Company
responsibleAgentId  FK User
name
phone?
email?
status
notes
createdAt
updatedAt
archivedAt?
```

Indexes: - companyId + responsibleAgentId - companyId + status -
companyId + name - companyId + phone - companyId + email

------------------------------------------------------------------------

## 10.2 ClientRequirement

``` text
ClientRequirement
-----------------
id                  PK
companyId           FK Company
clientId            FK Client
status
title

minPrice?
maxPrice?
currency?

minArea?
maxArea?

roomsMin?
roomsMax?

propertyType?
propertySubtype?

districts JSONB
subdistricts JSONB

mustHave JSONB
niceToHave JSONB
exclusions JSONB

activeFrom?
activeUntil?

createdAt
updatedAt
```

Indexes: - companyId + clientId - companyId + status - companyId +
minPrice/maxPrice - companyId + roomsMin/roomsMax - companyId +
updatedAt

------------------------------------------------------------------------

# 11. Matching Domain

## 11.1 Match

``` text
Match
-----
id                  PK
companyId           FK Company
propertyId          FK Property
clientId             FK Client
requirementId        FK ClientRequirement
status
score
explanation JSONB
matchedCriteria JSONB
createdAt
updatedAt
invalidatedAt?
```

Unique candidate: - `(propertyId, requirementId)`

Index: - companyId + propertyId - companyId + clientId - companyId +
status - companyId + score

Matching does not transfer Property ownership.

------------------------------------------------------------------------

# 12. Deal Domain

## 12.1 DealStage

``` text
DealStage
---------
id                  PK
companyId           FK Company
name
code
sortOrder
isActive
createdAt
updatedAt
```

Unique: - `(companyId, code)`

------------------------------------------------------------------------

## 12.2 Deal

``` text
Deal
----
id                  PK
companyId           FK Company
propertyId          FK Property
clientId            FK Client
responsibleAgentId  FK User
stageId             FK DealStage

price?
currency?
commission?
commissionCurrency?

outcome              DealOutcome
openedAt
closedAt?

createdAt
updatedAt
```

Indexes: - companyId + propertyId - companyId + clientId - companyId +
responsibleAgentId - companyId + stageId - companyId + outcome -
companyId + openedAt

------------------------------------------------------------------------

## 12.3 DealStageHistory

``` text
DealStageHistory
----------------
id                  PK
companyId           FK Company
dealId              FK Deal
fromStageId?
toStageId           FK DealStage
changedById?
changedAt
eventId             FK Event
```

Immutable.

------------------------------------------------------------------------

# 13. Showing Domain

## Showing

``` text
Showing
-------
id                  PK
companyId           FK Company
dealId              FK Deal
propertyId          FK Property
clientId            FK Client
agentId             FK User

scheduledAt
completedAt?

result?
notes?

createdAt
updatedAt
```

Indexes: - companyId + dealId - companyId + agentId + scheduledAt -
companyId + propertyId - companyId + clientId

Completed showing counts must derive from completed records/events.

------------------------------------------------------------------------

# 14. Next Action Domain

## NextAction

``` text
NextAction
----------
id                  PK
companyId           FK Company
assigneeId          FK User

type
title
description

priority             Priority
status               NextActionStatus

dueAt

entityType?
entityId?

generatedBy
sourceEventId?
automationExecutionId?

createdAt
updatedAt
completedAt?
```

Indexes: - companyId + assigneeId + status - companyId + assigneeId +
dueAt - companyId + priority + status - companyId + entityType +
entityId

Next Action may link polymorphically to: - Opportunity - Owner -
Property - Client - Deal - Showing - Conversation

Application layer must validate target existence and tenant.

------------------------------------------------------------------------

# 15. Publication Domain

## Publication

``` text
Publication
-----------
id                  PK
companyId           FK Company
propertyId          FK Property
provider             PublicationProvider
status               PublicationStatus

preparedPayload JSONB
externalId?
externalUrl?

extensionVersion?
adapterVersion?

failureCode?
failureMessage?

createdAt
updatedAt
publishedAt?
unpublishedAt?
```

Unique active publication: - `(companyId, propertyId, provider)` where
policy allows one active publication per provider.

------------------------------------------------------------------------

## 15.1 PublicationMedia

``` text
PublicationMedia
----------------
id                  PK
companyId           FK Company
publicationId       FK Publication
mediaAssetId        FK MediaAsset
sortOrder
createdAt
```

------------------------------------------------------------------------

## 15.2 PublicationExternalReference

``` text
PublicationExternalReference
-----------------------------
id                  PK
companyId           FK Company
publicationId       FK Publication
provider             PublicationProvider
externalId
externalUrl
capturedAt
metadata JSONB
```

Unique: - `(companyId, provider, externalId)`

------------------------------------------------------------------------

# 16. Event Domain

## Event

``` text
Event
-----
id                  PK
companyId           FK Company
eventType
schemaVersion

actorId?
actorType            EventActorType

entityType
entityId

occurredAt
source               EventSource

correlationId
causationId?
idempotencyKey?

payload JSONB
metadata JSONB?

createdAt
```

Indexes: - companyId + occurredAt - companyId + entityType + entityId +
occurredAt - companyId + eventType + occurredAt - correlationId
- unique `(companyId, eventType, idempotencyKey)` where idempotencyKey is non-null

Append-only.

------------------------------------------------------------------------

# 17. Outbox

## OutboxEvent

``` text
OutboxEvent
-----------
id                  PK
eventId             FK Event
companyId           FK Company
eventType
payload JSONB
occurredAt

status
attempts
availableAt
lastError?
processedAt?

createdAt
updatedAt
```

Indexes: - status + availableAt - companyId + status

The business transaction and outbox insertion must be atomic.

## ProcessedEvent

``` text
ProcessedEvent
-------------
id                  PK
companyId           FK Company
consumerName
eventId             FK Event
processedAt
createdAt
```

Unique: - `(consumerName, eventId)`

This table is required because event delivery is at-least-once and every consumer must be idempotent.

------------------------------------------------------------------------

# 18. Audit Domain

## AuditEntry

``` text
AuditEntry
----------
id                  PK
companyId           FK Company

actorId?
actorType

action
entityType
entityId

before JSONB
after JSONB

source
correlationId

result
occurredAt
createdAt
```

Indexes: - companyId + occurredAt - companyId + entityType + entityId +
occurredAt - companyId + actorId + occurredAt - correlationId

Append-only.

------------------------------------------------------------------------

# 19. Notification Domain

## Notification

``` text
Notification
------------
id                  PK
companyId           FK Company
recipientId          FK User

type
priority
title
body

entityType?
entityId?
action?

groupKey?
channel

createdAt
readAt?
deliveredAt?
```

Indexes: - companyId + recipientId + readAt - companyId + recipientId +
createdAt - companyId + groupKey

------------------------------------------------------------------------

## NotificationPreference

``` text
NotificationPreference
----------------------
id                  PK
companyId           FK Company
userId              FK User
notificationType
channel
enabled
quietHours JSONB
updatedAt
```

Unique: - `(userId, notificationType, channel)`

------------------------------------------------------------------------

## NotificationSubscription

``` text
NotificationSubscription
------------------------
id                  PK
companyId           FK Company
userId              FK User
subscriptionType
entityType?
entityId?
enabled
createdAt
updatedAt
```

------------------------------------------------------------------------

# 20. Messenger Domain

## Conversation

``` text
Conversation
------------
id                  PK
companyId           FK Company
type
title?
createdById
createdAt
updatedAt
```

Types: - COMPANY - DIRECT - GROUP - CONTEXTUAL

------------------------------------------------------------------------

## ConversationParticipant

``` text
ConversationParticipant
----------------------
conversationId       FK Conversation
userId               FK User
joinedAt
leftAt?
lastReadAt?

PRIMARY KEY(conversationId, userId)
```

------------------------------------------------------------------------

## Message

``` text
Message
-------
id                  PK
companyId            FK Company
conversationId       FK Conversation
senderId             FK User

body
replyToMessageId?

createdAt
editedAt?
deletedAt?
```

Historical deletion/edit semantics must preserve audit/history as
required.

------------------------------------------------------------------------

## MessageReaction

``` text
MessageReaction
---------------
id                  PK
messageId           FK Message
userId              FK User
reaction
createdAt

UNIQUE(messageId, userId, reaction)
```

------------------------------------------------------------------------

## MessageMention

``` text
MessageMention
--------------
id                  PK
messageId           FK Message
userId              FK User
createdAt
```

------------------------------------------------------------------------

## MessageAttachment

``` text
MessageAttachment
-----------------
id                  PK
messageId           FK Message
mediaAssetId?       FK MediaAsset
documentId?         FK Document
createdAt
```

------------------------------------------------------------------------

## CrmCardReference

``` text
CrmCardReference
----------------
id                  PK
messageId           FK Message
entityType
entityId
snapshot JSONB
createdAt
```

A CRM card may point to: - Property - Client - Owner - Opportunity -
Deal

------------------------------------------------------------------------

# 21. Document Domain

## Document

``` text
Document
--------
id                  PK
companyId           FK Company
ownerType
ownerId?
uploaderId           FK User

filename
mimeType
sizeBytes
storageKey

visibility           DocumentVisibility

createdAt
updatedAt
archivedAt?
```

For Personal Library, ownerType/ownerId must identify the personal
owner.

------------------------------------------------------------------------

## DocumentVersion

``` text
DocumentVersion
---------------
id                  PK
companyId           FK Company
documentId          FK Document
versionNumber
storageKey
checksum
sizeBytes
uploadedById         FK User
createdAt
```

Unique: - `(documentId, versionNumber)`

------------------------------------------------------------------------

## DocumentShare

``` text
DocumentShare
-------------
id                  PK
companyId           FK Company
documentId          FK Document
sharedWithUserId?
sharedWithTeamId?
permission
createdAt
expiresAt?
```

------------------------------------------------------------------------

## DocumentFolder

``` text
DocumentFolder
--------------
id                  PK
companyId           FK Company
ownerUserId?
parentFolderId?
name
visibility
createdAt
updatedAt
```

------------------------------------------------------------------------

## DocumentTag

``` text
DocumentTag
-----------
id                  PK
companyId           FK Company
name
createdAt

UNIQUE(companyId, name)
```

------------------------------------------------------------------------

## DocumentTagLink

``` text
DocumentTagLink
---------------
documentId
tagId

PRIMARY KEY(documentId, tagId)
```

------------------------------------------------------------------------

# 22. Automation Domain

## AutomationRule

``` text
AutomationRule
--------------
id                  PK
companyId?
scope
name

triggerEventType

conditions JSONB
actions JSONB

priority
enabled

executionPolicy JSONB

createdAt
updatedAt
```

System rules may have null companyId.

------------------------------------------------------------------------

## AutomationExecution

``` text
AutomationExecution
-------------------
id                  PK
companyId           FK Company
ruleId              FK AutomationRule

triggerEventId      FK Event
correlationId

status
attempts
depth

startedAt
completedAt?
lastError?

result JSONB
createdAt
```

Unique/idempotency: - `(ruleId, triggerEventId)` where appropriate.

------------------------------------------------------------------------

# 23. Search Model

Search is a derived index, not source of truth.

## SearchDocument

``` text
SearchDocument
--------------
id                  PK
companyId           FK Company
entityType
entityId

searchText
normalizedText
rankingData JSONB
facets JSONB

updatedAt
```

Unique: - `(companyId, entityType, entityId)`

Search implementation: - PostgreSQL FTS; - pg_trgm; - normalized
multilingual fields.

Future SearchProvider replacement must not affect domain tables.

------------------------------------------------------------------------

# 24. Achievement Domain

## AchievementType

``` text
AchievementType
---------------
id                  PK
companyId?
code
name
description
calculationKey
configuration JSONB
enabled
createdAt
updatedAt
```

System achievement types may have null companyId.

MVP codes:

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

------------------------------------------------------------------------

## AchievementPeriod

``` text
AchievementPeriod
-----------------
id                  PK
companyId           FK Company
type
startAt
endAt
status
createdAt
```

------------------------------------------------------------------------

## AchievementAward

``` text
AchievementAward
----------------
id                  PK
companyId           FK Company
achievementTypeId   FK AchievementType
periodId            FK AchievementPeriod
userId              FK User

rank
score
qualificationData JSONB

awardedAt
createdAt
```

Unique: - `(periodId, achievementTypeId, rank)` where appropriate.

Qualification data must explain how the award was calculated.

------------------------------------------------------------------------

# 25. Analytics Data Model

Analytics should not rely only on mutable domain tables.

## AnalyticsEventFact

``` text
AnalyticsEventFact
------------------
id                  PK
companyId           FK Company

eventId
eventType
occurredAt

actorId?
entityType
entityId

agentId?
district?
propertyType?
rooms?
area?
price?
commission?
source?

dimensions JSONB
measures JSONB

createdAt
```

Unique: - `(companyId, eventId)`

------------------------------------------------------------------------

## AnalyticsDailyFact

``` text
AnalyticsDailyFact
------------------
id                  PK
companyId           FK Company
date

agentId?
district?
propertyType?
source?

opportunities
contacts
ownerConsents
properties
matches
showings
dealsCreated
dealsWon
dealsLost

salesVolume
commission

averagePrice
medianPrice
pricePerSqm

createdAt
updatedAt
```

A composite unique key must cover all grouping dimensions.

------------------------------------------------------------------------

# 26. Collector Operations

## CollectorJob

``` text
CollectorJob
------------
id                  PK
companyId?          FK Company
provider
startedAt
finishedAt?
status
pagesProcessed
listingsObserved
opportunitiesCreated
opportunitiesUpdated
priceChanges
errorCount
lastError?
createdAt
```

------------------------------------------------------------------------

## CollectorCheckpoint

``` text
CollectorCheckpoint
-------------------
id                  PK
provider
scope
cursor
lastSuccessfulAt
metadata JSONB
updatedAt
```

------------------------------------------------------------------------

# 27. Integration Incident

## IntegrationIncident

``` text
IntegrationIncident
-------------------
id                  PK
companyId?
provider
component
severity
status

code
message
details JSONB

firstSeenAt
lastSeenAt
resolvedAt?

correlationId?
createdAt
updatedAt
```

Use for: - DOM drift; - parser failure; - publication failure; - source
unavailability; - rate limiting; - schema mismatch.

------------------------------------------------------------------------

# 28. Billing Foundation

## Plan

``` text
Plan
----
id                  PK
code
name
pricing JSONB
limits JSONB
features JSONB
active
createdAt
updatedAt
```

## Subscription

``` text
Subscription
------------
id                  PK
companyId           FK Company
planId              FK Plan
status
startedAt
trialEndsAt?
currentPeriodStart
currentPeriodEnd
cancelledAt?
createdAt
updatedAt
```

## UsageMeter

``` text
UsageMeter
----------
id                  PK
companyId           FK Company
meterType
periodStart
periodEnd
quantity
createdAt
updatedAt
```

Usage examples: - users - properties - opportunities - imports -
publications - storage - API calls - automation executions

------------------------------------------------------------------------

# 29. Invoice Foundation

## BillingAccount

``` text
BillingAccount
--------------
id                  PK
companyId           FK Company
provider
externalCustomerId
currency
createdAt
updatedAt
```

## Invoice

``` text
Invoice
-------
id                  PK
companyId           FK Company
externalId?
status
currency
subtotal
tax
total
issuedAt?
dueAt?
paidAt?
createdAt
updatedAt
```

## InvoiceItem

``` text
InvoiceItem
-----------
id                  PK
invoiceId            FK Invoice
description
quantity
unitPrice
amount
metadata JSONB
```

Never store raw card number/CVV.

------------------------------------------------------------------------

# 30. Global Referential Rules

All foreign keys should use explicit referential actions.

Recommended defaults:

### Business entities

Prefer: `ON DELETE RESTRICT`

### Join tables

`ON DELETE CASCADE` may be used only where deletion cannot destroy
business history.

### Historical/event tables

Never cascade-delete from the parent business entity.

Example: - deleting/archiving Property must not delete Event; -
deleting/archiving Deal must not delete Showing history; - deleting User
must not delete Audit/Event history.

User deactivation is preferred to deletion.

------------------------------------------------------------------------

# 31. Soft Delete / Archive Policy

Use lifecycle states instead of physical deletion for: - Opportunity -
Owner - Property - Client - Deal - Publication - Documents where
retention applies.

Hard deletion should be exceptional and policy-driven.

History/events/audit should remain immutable.

------------------------------------------------------------------------

# 32. Uniqueness and Duplicate Protection

## Source listing

``` text
UNIQUE(companyId, provider, externalId)
```

## Owner source reference

``` text
UNIQUE(companyId, provider, externalOwnerId)
```

## Publication external reference

``` text
UNIQUE(companyId, provider, externalId)
```

## Search

``` text
UNIQUE(companyId, entityType, entityId)
```

## Analytics event fact

``` text
UNIQUE(companyId, eventId)
```

## Requirement match

``` text
UNIQUE(propertyId, requirementId)
```

Additional phone/email uniqueness should be implemented on normalized
values.

------------------------------------------------------------------------

# 33. Normalization Requirements

Phone: - store raw value; - store normalized canonical value.

Email: - store raw value; - store normalized lowercase value.

Locations: - canonical code/value; - localized display labels.

Property types: - canonical enum/code; - localized UI labels.

Do not use localized text as the primary identity.

------------------------------------------------------------------------

# 34. JSONB Policy

JSONB is allowed for: - source raw payloads; - snapshots; - flexible
characteristics; - explanations; - configuration; - event metadata; -
analytical dimensions.

JSONB must not hide critical relational keys that need: - referential
integrity; - frequent joins; - unique constraints; - authorization
filtering.

If a field becomes operationally central, promote it to a typed column.

------------------------------------------------------------------------

# 35. Tenant Security at DB Layer

Where feasible, PostgreSQL RLS should enforce:

``` text
current_company_id = company_id
```

Application authorization remains mandatory.

RLS does not replace permission checks.

Sensitive analytics must have both: - tenant isolation; - permission
authorization.

------------------------------------------------------------------------

# 36. Transaction Boundaries

The following must be atomic:

### Opportunity claim

Claim state + event/outbox.

### Owner consent conversion

Consent + Property creation/link + provenance link + events.

### Property price change

Property state + PriceHistory + Event/Outbox.

### Deal stage change

Deal state + StageHistory + Event/Outbox.

### Deal won

Deal state + event/outbox.

### Publication confirmation

Publication state + confirmation event/outbox.

### Message send

Message + related CRM reference where applicable + event/outbox.

------------------------------------------------------------------------

# 37. Historical Integrity

Historical data must never depend on future mutable state.

Example:

If Property is:

`86 m² → 100 m²`

a previous DealWon fact must still report the historical area used for
the deal.

Therefore analytical facts should snapshot relevant dimensions at event
time.

------------------------------------------------------------------------

# 38. Critical Index Set

At minimum:

``` text
Opportunity:
(companyId, status)
(companyId, firstSeenAt)
(companyId, district)
(companyId, price)
(companyId, claimedById)

Property:
(companyId, status)
(companyId, responsibleAgentId)
(companyId, district)
(companyId, propertyType)
(companyId, rooms)
(companyId, price)
(companyId, area)

Client:
(companyId, responsibleAgentId)
(companyId, status)

Requirement:
(companyId, clientId)
(companyId, status)

Deal:
(companyId, propertyId)
(companyId, clientId)
(companyId, responsibleAgentId)
(companyId, stageId)
(companyId, outcome)

Showing:
(companyId, dealId)
(companyId, agentId, scheduledAt)

NextAction:
(companyId, assigneeId, status)
(companyId, assigneeId, dueAt)

Event:
(companyId, occurredAt)
(companyId, entityType, entityId, occurredAt)
(companyId, eventType, occurredAt)

Audit:
(companyId, entityType, entityId, occurredAt)

Notification:
(companyId, recipientId, readAt)
(companyId, recipientId, createdAt)
```

------------------------------------------------------------------------

# 39. Prisma Implementation Rules

Use: - explicit relations; - named relations where multiple foreign keys
point to the same model; - enums for stable finite states; - indexes
declared explicitly; - composite unique constraints; - migration files
reviewed before production.

Avoid: - implicit many-to-many where business metadata is required; -
arbitrary JSON for core relations; - cascading deletion of historical
data.

Example relationship requiring explicit naming:

``` text
Opportunity.claimedBy → User
Opportunity responsible agent → User
Property.responsibleAgent → User
Client.responsibleAgent → User
Deal.responsibleAgent → User
```

------------------------------------------------------------------------

# 40. Domain Aggregate Boundaries

Recommended aggregates:

### Opportunity Aggregate

Opportunity + active claim state + contact workflow references.

### Property Aggregate

Property + characteristics + source provenance + media references.

### Client Aggregate

Client + Requirements.

### Deal Aggregate

Deal + stage history + Showing references.

### Publication Aggregate

Publication + publication media + external references.

### Conversation Aggregate

Conversation + participants + messages.

Events cross aggregate boundaries asynchronously.

------------------------------------------------------------------------

# 41. Cross-Domain References

Prefer IDs over embedded duplicated objects.

Example:

Deal stores: - propertyId; - clientId; - responsibleAgentId.

It does not duplicate the full Property or Client.

Historical analytics/event facts may intentionally snapshot selected
fields.

------------------------------------------------------------------------

# 42. Data Access Rules

Repositories should expose domain-oriented methods.

Examples:

``` text
OpportunityRepository.findFeed(...)
OpportunityRepository.claim(...)
PropertyRepository.createFromConsent(...)
PropertyRepository.changePrice(...)
ClientRepository.findMatchingRequirements(...)
DealRepository.changeStage(...)
NextActionRepository.findToday(...)
```

Avoid generic repository methods becoming uncontrolled business logic.

------------------------------------------------------------------------

# 43. Database Migration Rules

Every migration must be: - versioned; - reviewed; - tested on staging; -
backwards-compatible where rolling deployment requires it.

Legacy backfill is evidence-preserving:

- never fabricate a consent event when historical consent cannot be
  proven;
- never map a legacy closed Property to `Deal WON` without evidence;
- preserve legacy IDs, timestamps, source references and raw facts where
  possible;
- represent unknown/legacy-unverified state explicitly;
- resolve shared-phone collisions through candidate review, not silent
  merge;
- validate row counts, relationships and derived aggregates before
  tightening constraints;
- never edit an already-applied production migration in place.

Use expand/contract:

1.  add new nullable structure;
2.  deploy compatible code;
3.  backfill;
4.  switch reads/writes;
5.  enforce constraints;
6.  remove legacy structure later.

Never manually edit production schema.

------------------------------------------------------------------------

# 44. Data Integrity Test Matrix

Required database/integration tests:

### Tenant

-   user cannot read another company's entity;
-   user cannot mutate another company's entity;
-   companyId cannot be client-controlled.

### Deduplication

-   duplicate source listing is rejected/linked;
-   duplicate owner phone is resolved;
-   ambiguous owner does not merge;
-   duplicate property candidate does not silently overwrite.

### History

-   Event is immutable;
-   Audit is immutable;
-   source snapshot is immutable;
-   Deal history remains after status changes.

### Relationships

-   Property supports multiple Deals;
-   Client supports multiple Deals;
-   Deal belongs to one Property and one Client;
-   Showing belongs to Deal;
-   Requirement belongs to Client.

### Publication

-   no valid phone evidence (`REVEALED_ON_SOURCE` or
    `MANUAL_AGENT_INPUT`) → import rejected;
-   no human confirmation → publication cannot become PUBLISHED.

### Analytics

-   duplicate event does not double-count;
-   historical DealWon facts remain stable after Property edits.

### Achievement

-   duplicate calculation does not create duplicate awards;
-   rankings use validated facts.

------------------------------------------------------------------------

# 45. Final Relationship Graph

``` text
Company
 ├── Users
 ├── Teams
 ├── Owners
 ├── Opportunities
 ├── Properties
 ├── Clients
 ├── Deals
 ├── Documents
 ├── Conversations
 ├── Events
 ├── Notifications
 └── Analytics
```

Business graph:

``` text
SourceListing
     │
     ├── SourceObservations
     │
     └── Opportunity
            │
            ├── Owner
            ├── Claims
            └── Contacts
                    │
                 Consent
                    │
                    ▼
                 Property
              ┌─────┼─────┐
              │     │     │
           Owner  Media  Source
              │
              ▼
           Property
              │
         ┌────┴────┐
         ▼         ▼
      Client     Publication
         │            │
   Requirement     Extension
         │            │
         ▼        ss.ge/myhome.ge
       Match
         │
         ▼
        Deal
         │
      ┌──┴───┐
      ▼      ▼
  Showing  NextAction
         │
         ▼
      DealWon
         │
         ▼
     Analytics
         │
         ▼
   Achievement
```

Cross-cutting:

``` text
All meaningful state changes
          ↓
        Event
       /  |  \
   Audit  |  Analytics
          |
   Notification
          |
      NextAction
          |
      Messenger
```

------------------------------------------------------------------------

# 46. Frozen Schema Rules

This schema is the MVP 1.0 database baseline.

Changes after freeze require: - explicit schema review; - migration
impact analysis; - backwards-compatibility analysis; - updated tests; -
updated technical specification where semantics change.

Implementation may optimize indexes, physical storage, partitioning, or
read models without changing domain semantics.

The following are architectural invariants and must not be casually
changed:

1.  Opportunity ≠ Property.
2.  Property ≠ Source Listing.
3.  Owner is independent.
4.  Client Requirement is independent.
5.  Property and Client can participate in multiple Deals.
6.  Showing is independent from pipeline stage.
7.  Next Action is a first-class operational entity.
8.  Event/Audit history is append-only.
9.  Analytics is derived.
10. Achievement is derived from validated business facts.
11. Publication is separate from Property.
12. External systems are represented through references/adapters.
13. Tenant isolation is mandatory.
14. Ambiguous merges are never silent.
15. Source provenance is immutable.
16. Final publication requires human confirmation.
17. Hidden source phone blocks extension import unless valid
    `MANUAL_AGENT_INPUT` evidence is provided.

------------------------------------------------------------------------

# 47. Schema Completion Definition

The database layer is considered MVP-complete only when:

-   all required models exist;
-   all tenant relationships are enforced;
-   all critical foreign keys are explicit;
-   required unique constraints exist;
-   critical indexes exist;
-   immutable historical tables are protected;
-   outbox/event transactionality works;
-   authorization tests pass;
-   duplicate protection works;
-   analytics facts are reproducible;
-   achievement calculations are reproducible;
-   migrations work from a clean database;
-   migrations work against the supported existing database path;
-   rollback/recovery strategy is documented for production migrations.

------------------------------------------------------------------------

# 48. Final Data Contract

The KleeKto data model must preserve this truth:

> **The database stores authoritative current business state, immutable
> source facts, immutable business history, and derived analytical facts
> as distinct layers.**

The canonical chain is:

``` text
MARKET FACT
   ↓
SOURCE OBSERVATION
   ↓
OPPORTUNITY
   ↓
OWNER CONTACT / CONSENT
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
DEAL WON/LOST
   ↓
ANALYTICS
   ↓
ACHIEVEMENT
```

And every significant mutation is traceable through:

``` text
COMMAND
 ↓
TRANSACTION
 ↓
EVENT / OUTBOX
 ↓
AUDIT + HISTORY + DERIVED CONSUMERS
```

**This is the KleeKto Database & Domain Schema v1.0 implementation
baseline.**
