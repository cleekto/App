# KleeKto --- Authorization & RBAC Specification v1.0

**Document status:** FROZEN AUTHORIZATION BASELINE\
**Version:** 1.0\
**Purpose:** Canonical specification for authentication context,
multi-tenancy, RBAC, permissions, ownership, collaboration, sensitive
actions, authorization enforcement, audit, and security boundaries in
KleeKto MVP 1.0.

------------------------------------------------------------------------

# 1. Purpose

This document defines who may access, view, create, modify, assign,
archive, publish, merge, export, administer, and otherwise operate on
KleeKto data.

It separates five concepts that must never be conflated:

``` text
Identity
Permission
Role
Ownership
Collaboration
```

The system must never use:

``` text
"is the responsible agent"
```

as a universal authorization rule.

Likewise:

``` text
"is a manager"
```

must not automatically mean:

``` text
"can do everything"
```

Permissions are explicit.

------------------------------------------------------------------------

# 2. Security Model

KleeKto is a multi-tenant SaaS.

Primary boundary:

``` text
Company = Tenant
```

Every tenant-scoped resource must be associated with exactly one
`companyId`.

Canonical authorization flow:

``` text
Request
  ↓
Authenticate identity
  ↓
Resolve Company
  ↓
Build AuthContext
  ↓
Resolve permission
  ↓
Resolve resource
  ↓
Tenant check
  ↓
Ownership / visibility check
  ↓
Permission check
  ↓
Domain invariant check
  ↓
Execute command
  ↓
Audit
```

------------------------------------------------------------------------

# 3. Identity ≠ Permission ≠ Ownership

## Identity

Answers:

> Who is this person/system?

Example:

``` text
User(id=U123)
```

## Permission

Answers:

> What actions may this actor perform?

Example:

``` text
property.update_own
property.update_company
```

## Role

Answers:

> Which permissions are normally assigned to this actor?

Example:

``` text
AGENT
```

## Ownership

Answers:

> Who is responsible for this business entity?

Example:

``` text
Property.responsibleAgentId = U123
```

## Collaboration

Answers:

> Who may participate in another agent's work without becoming
> responsible owner?

Example:

``` text
Collaborator = U456
Responsible Agent = U123
```

------------------------------------------------------------------------

# 4. Tenant Isolation

Every request must resolve exactly one company context.

Client-provided:

``` json
{
  "companyId": "..."
}
```

must never be trusted as authorization.

The server derives:

``` text
companyId ← authenticated session / service identity
```

Every repository query must be tenant-scoped.

Bad:

``` sql
SELECT * FROM Property WHERE id = $1;
```

Good:

``` sql
SELECT *
FROM Property
WHERE id = $1
AND company_id = $companyId;
```

------------------------------------------------------------------------

# 5. AuthContext

Canonical context:

``` ts
type AuthContext = {
  userId: string
  companyId: string

  roleIds: string[]
  permissionSet: Set<string>

  sessionId: string
  requestId: string
  correlationId: string

  source:
    | "WEB"
    | "EXTENSION"
    | "COLLECTOR"
    | "SYSTEM"
    | "AUTOMATION"
    | "INTEGRATION"
}
```

Service actors may have:

``` text
userId = null
```

but must use a scoped service identity.

------------------------------------------------------------------------

# 6. Platform vs Company Administration

KleeKto has two separate administrative levels.

## Platform Admin

Operates the SaaS platform.

May manage: - companies; - subscriptions; - infrastructure; - support
access; - platform incidents; - integration configuration.

Platform Admin is not automatically a member of every company.

## Company Admin / Main Manager

Operates one company.

May manage: - users; - roles; - teams; - company configuration; -
analytics; - achievements; - automation; - documents; - company-wide
workflow.

The two authority layers must remain separate.

------------------------------------------------------------------------

# 7. MVP Roles

Initial built-in roles:

``` text
ADMIN
MANAGER
AGENT
VIEWER
```

These are defaults, not the ultimate authorization model.

Custom roles are architecturally supported.

------------------------------------------------------------------------

# 8. ADMIN

Admin is the highest company-level role.

Typical built-in permissions:

```text
company.read
company.update

user.read
user.create
user.update
user.suspend
user.invite
role.read
role.create
role.update
role.assign
team.read
team.create
team.update

opportunity.read
opportunity.claim
opportunity.contact
opportunity.archive
opportunity.restore

owner.read
owner.create
owner.update
owner.merge
owner.export

property.read
property.create
property.update_company
property.update_own
property.archive
property.restore
property.assign
property.merge
property.export

client.read
client.create
client.update_company
client.update_own
client.export

deal.read
deal.create
deal.update_company
deal.update_own
deal.stage.change_company
deal.stage.change_own
deal.close
deal.export

showing.read
showing.create
showing.update_company
showing.update_own

next_action.read
next_action.manage_company
next_action.manage_own

messenger.read
messenger.send
document.read
document.upload
document.share
document.archive

publication.prepare
publication.confirm
collaboration.request

analytics.company.read_full
analytics.company.export
analytics.company.financial
analytics.company.agent_performance
analytics.team.read

achievement.read
achievement.admin.read
achievement.manage

automation.read
automation.manage
audit.read
security.read

billing.read
billing.manage
```

Admin does not bypass platform-level controls.

------------------------------------------------------------------------

# 9. MANAGER

Manager manages daily company operations.

Typical built-in permissions:

```text
opportunity.read
opportunity.claim
opportunity.contact
opportunity.archive
opportunity.restore

owner.read
owner.create
owner.update

property.read
property.create
property.update_company
property.update_own
property.assign
property.archive
property.restore

client.read
client.create
client.update_company
client.update_own

deal.read
deal.create
deal.update_company
deal.update_own
deal.stage.change_company
deal.stage.change_own
deal.close

showing.read
showing.create
showing.update_company
showing.update_own

next_action.read
next_action.manage_company
next_action.manage_own

messenger.read
messenger.send
document.read
document.upload
document.share

publication.prepare
publication.confirm
collaboration.request

analytics.team.read
achievement.read
automation.read
```

Full company analytics, billing, role administration, and high-risk merges remain separate elevated permissions.

------------------------------------------------------------------------

# 10. AGENT

Agent operates assigned and company-visible business data.

Typical permissions:

``` text
opportunity.read
opportunity.claim
opportunity.contact

owner.read
owner.create
owner.update

property.read
property.create
property.update_own
property.archive
property.restore

client.read
client.create
client.update_own

deal.read
deal.create
deal.update_own
deal.stage.change_own
deal.close

showing.read
showing.create
showing.update_own

next_action.read
next_action.manage_own

messenger.read
messenger.send

document.read
document.upload

collaboration.request

publication.prepare
publication.confirm
```

The exact built-in role-to-permission matrix is configurable by
deployment policy.

------------------------------------------------------------------------

# 11. VIEWER

Viewer is read-oriented.

Typical permissions:

``` text
opportunity.read
property.read
owner.read
client.read
deal.read
showing.read
next_action.read
messenger.read
document.read
achievement.read
```

No default mutation of core CRM entities.

------------------------------------------------------------------------

# 12. Permission Naming

Canonical format:

``` text
<resource>.<action>
```

Examples:

``` text
property.read
property.create
property.update_own
property.update_company
property.assign
property.archive
```

For scope-sensitive operations:

``` text
property.update_own
property.update_company
deal.stage.change_own
deal.stage.change_company
```

For sensitive administration:

``` text
analytics.company.read_full
billing.manage
audit.read
security.manage
```

Permissions are machine-readable identifiers.

------------------------------------------------------------------------

# 13. Permission Families

Minimum families:

``` text
company
user
role
team

owner
opportunity
property
client
requirement
match
collaboration

deal
deal_stage
showing
next_action

messenger
notification
document

publication
integration
collector

automation
analytics
achievement
audit

billing
security
```

------------------------------------------------------------------------

# 14. Permission Evaluation

Canonical function:

``` ts
authorize(
  context,
  permission,
  resource?
): AuthorizationDecision
```

Decision:

``` ts
{
  allowed: boolean
  reason:
    | "ALLOWED"
    | "UNAUTHENTICATED"
    | "NO_PERMISSION"
    | "WRONG_TENANT"
    | "VISIBILITY_DENIED"
    | "OWNERSHIP_DENIED"
    | "COLLABORATION_REQUIRED"
    | "SENSITIVE_ACTION_REQUIRES_CONFIRMATION"
    | "RESOURCE_STATE_FORBIDS_ACTION"
}
```

------------------------------------------------------------------------

# 15. Authorization Layers

Authorization is evaluated in layers.

## Layer 1 --- Authentication

Is the actor authenticated?

## Layer 2 --- Tenant

Does the resource belong to the actor's company?

## Layer 3 --- Permission

Does the actor possess the required permission?

## Layer 4 --- Visibility

Is the resource visible to this actor?

## Layer 5 --- Ownership

Does the operation require ownership?

## Layer 6 --- Collaboration

Is the actor an authorized collaborator?

## Layer 7 --- State

Does the current entity state permit the action?

All applicable layers must pass.

------------------------------------------------------------------------

# 16. Visibility Modes

KleeKto supports:

``` text
COMPANY
TEAM
PRIVATE
```

## COMPANY

Visible to authorized company users.

Default for core market/CRM entities in MVP.

## TEAM

Visible to members of designated team.

## PRIVATE

Visible only to owner and explicitly authorized participants.

Visibility does not automatically grant edit permission.

------------------------------------------------------------------------

# 17. Ownership Model

Ownership is explicit.

Recommended fields:

``` text
responsibleAgentId
```

where relevant.

For some entities:

``` text
ownerId
```

means business Owner entity, not application User.

These must never be confused.

Example:

``` text
Property.ownerId
→ Owner entity

Property.responsibleAgentId
→ User entity
```

------------------------------------------------------------------------

# 18. Responsible Agent

Responsible Agent is the primary company user accountable for a CRM
entity.

Responsible Agent can: - work the entity; - receive relevant
NextActions; - receive relevant notifications; - coordinate
collaboration.

Responsible Agent does not automatically gain: - company admin
privileges; - permission to delete history; - permission to merge
entities; - billing permissions.

------------------------------------------------------------------------

# 19. Collaborators

Collaboration allows other agents to participate without reassignment.

Example:

``` text
Property:
Responsible = Anna
Collaborator = David
```

David may: - view allowed details; - communicate; - request/show
cooperation; - perform explicitly permitted collaborative actions.

David does not become responsible agent.

------------------------------------------------------------------------

# 20. Collaboration Request

Command:

``` text
REQUEST_PROPERTY_COLLABORATION
```

Authorization:

``` text
collaboration.request
```

The responsible agent retains ownership.

Events:

``` text
collaboration.requested
notification.created
```

Future approval/decline can be modeled without changing ownership
semantics.

------------------------------------------------------------------------

# 21. Opportunity Feed Access

Default:

``` text
Company-wide read
```

All authorized agents see the same shared Opportunity Feed.

Claim does not remove the Opportunity from other agents.

Claim creates:

``` text
inWorkBy
claimedAt
lastClaimActivity
```

Other agents may see:

``` text
В работе у Анны · 12 мин назад
```

unless visibility policy says otherwise.

------------------------------------------------------------------------

# 22. Opportunity Claim Authorization

Required:

``` text
opportunity.claim
```

Additional state checks: - opportunity belongs to company; - not
permanently unavailable; - not archived in a way that forbids work.

Claim is soft.

A stale claim may expire according to configurable policy.

------------------------------------------------------------------------

# 23. Team Contact Marker

If another company agent contacted an owner:

``` text
teamContacted = true
```

The marker is informational.

It does not permanently block another agent.

Historical contact remains visible according to permissions.

Marker may expire after a configurable period.

------------------------------------------------------------------------

# 24. Personal Archive

Opportunity archive is personal.

When Agent A archives:

``` text
OpportunityArchive(
  opportunityId,
  userId = A
)
```

Agent B may still see the opportunity.

Therefore:

``` text
archive ≠ delete
```

Restore is allowed by the archiving agent and authorized managers
according to policy.

------------------------------------------------------------------------

# 25. Property Read Authorization

Default:

``` text
Company-visible
```

if the user has:

``` text
property.read
```

The responsible agent does not have exclusive read access.

------------------------------------------------------------------------

# 26. Property Update Authorization

Possible policies:

``` text
property.update_own
property.update_company
```

Agent default:

``` text
own + explicitly collaborative
```

Manager/Admin:

``` text
company
```

All updates remain audited.

------------------------------------------------------------------------

# 27. Property Assignment

Permission:

``` text
property.assign
```

Normally: - Manager; - Admin.

Agent cannot silently reassign another agent's Property.

Collaboration is preferred where reassignment is unnecessary.

Event:

``` text
property.assigned
```

------------------------------------------------------------------------

# 28. Owner Authorization

Owner is company-wide CRM history.

Authorized users may view an Owner according to:

``` text
owner.read
```

Sensitive contact data may require additional field-level authorization
in future.

Owner merge is always high-risk.

------------------------------------------------------------------------

# 29. Owner Merge

Permission:

``` text
owner.merge
```

Requirements:

``` text
explicit confirmation
+
merge reason
+
audit
```

Ambiguous duplicates:

``` text
NEVER silently merge
```

Merge preserves: - historical relationships; - interactions; -
Opportunities; - Properties; - Deals; - audit trail.

------------------------------------------------------------------------

# 30. Property Merge

Permission:

``` text
property.merge
```

Same high-risk policy as Owner merge.

Automatic merge is permitted only under an explicitly approved
high-confidence resolution policy.

Ambiguous candidates produce:

``` text
DUPLICATE_REVIEW_REQUIRED
```

------------------------------------------------------------------------

# 31. Client Authorization

Client data is company-scoped.

Default:

``` text
client.read → company
client.update_own → responsible agent
client.update_company → manager/admin
```

Company-wide visibility is preferred for matching and collaboration,
while edits remain permission-controlled.

------------------------------------------------------------------------

# 32. Client Requirement Authorization

Requirement follows Client visibility.

Responsible agent can: - create; - update; - deactivate.

Manager/Admin can manage company-wide.

Matching can read active requirements through a service identity.

------------------------------------------------------------------------

# 33. Matching Authorization

Matching Engine is a system service.

It may read: - Property; - Client; - Requirements.

It may create Match records through its scoped service permission.

It cannot: - reassign Property; - reassign Client; - change Deal
ownership; - alter user permissions.

------------------------------------------------------------------------

# 34. Deal Authorization

Deal visibility follows:

``` text
Company / Team / Permission
```

Deal mutation requires appropriate permission.

Own deal:

``` text
deal.update_own
```

Company-wide manager action:

``` text
deal.update_company
```

Stage changes must be authorized independently.

------------------------------------------------------------------------

# 35. Deal Stage Configuration

Permissions:

``` text
deal_stage.read
deal_stage.manage
```

Manager/Admin may: - create; - rename; - reorder; - deactivate.

Existing historical stage references must remain understandable.

Removing a stage from active configuration must not destroy history.

------------------------------------------------------------------------

# 36. Showing Authorization

``` text
showing.read
showing.create
showing.update_own
showing.update_company
```

Responsible agent can manage own showings.

Managers may manage company showings.

Showing history is immutable after completion except through explicit
correction workflow.

------------------------------------------------------------------------

# 37. Next Action Authorization

Agent:

``` text
next_action.read
next_action.manage_own
```

Manager:

``` text
next_action.manage_company
```

An agent may complete an action assigned to them.

A manager may reassign or intervene according to policy.

System-generated NextActions are attributed to:

``` text
SYSTEM / AUTOMATION
```

but assigned to a real user.

------------------------------------------------------------------------

# 38. Today Authorization

Today aggregates only entities the user is authorized to see.

It must never become a permission bypass.

Example:

``` text
Today
→ overdue actions
→ only authorized actions
```

Company match:

``` text
→ only authorized Property/Client references
```

------------------------------------------------------------------------

# 39. Search Authorization

Search must apply permission filtering before result exposure.

Pipeline:

``` text
query
→ parse
→ retrieve candidates
→ tenant filter
→ permission filter
→ visibility filter
→ ranking
→ return
```

Never:

``` text
retrieve everything
→ hide unauthorized rows in UI
```

------------------------------------------------------------------------

# 40. Global Search

Global search can search:

``` text
Property
Client
Owner
Opportunity
Deal
NextAction
```

Future:

``` text
Publication
Showing
Interaction
Documents
```

The search index is not trusted for authorization.

Source entities are checked.

------------------------------------------------------------------------

# 41. Messenger Authorization

Conversation visibility is membership-based.

A user may read a conversation only if:

``` text
company member
AND
conversation participant
```

Company-wide announcement channels are separate.

CRM-context messages must additionally validate access to referenced CRM
entities.

------------------------------------------------------------------------

# 42. Messenger CRM Cards

A message can contain:

``` text
Property card
Client card
Owner card
Opportunity card
Deal card
```

The referenced entity must be permission-checked when displayed.

If access is revoked later:

``` text
card remains historical
but entity content may be hidden
```

------------------------------------------------------------------------

# 43. Documents Authorization

Document access is controlled by:

``` text
visibility
+
ownership
+
share permissions
+
CRM entity access
```

Personal Library:

``` text
PRIVATE by default
```

Company Library:

``` text
COMPANY visible
```

Attached business documents follow corporate access policy.

------------------------------------------------------------------------

# 44. Signed URL Authorization

Never return permanent object-storage URLs.

Flow:

``` text
request document
→ authorize
→ generate short-lived signed URL
→ return
```

If authorization fails:

``` text
do not generate URL
```

------------------------------------------------------------------------

# 45. Publication Authorization

Preparation:

``` text
publication.prepare
```

Final confirmation:

``` text
publication.confirm
```

Publication confirmation is a sensitive action.

The extension cannot elevate its own permissions.

The server must verify: - authenticated user; - company; - property
access; - publication permission; - valid property state; - human
confirmation.

------------------------------------------------------------------------

# 46. Publication Confirmation

Final publish requires:

``` text
explicit human confirmation
```

Event:

``` text
publication.confirmed
```

The confirmation must include: - actor; - property; - publication; -
provider; - timestamp; - correlation ID.

Automation cannot silently bypass this boundary.

------------------------------------------------------------------------

# 47. Extension Authorization

Extension is treated as a separate client.

Required: - authenticated session; - scoped API access; - supported
extension version; - company context; - user context.

Extension may not: - access arbitrary companies; - change role; - read
platform secrets; - publish without confirmation; - reveal hidden source
phone.

------------------------------------------------------------------------

# 48. Collector Authorization

Cloud Collector is a service identity.

It may: - read configured external sources; - create/update
SourceObservation; - create/update SourceListing; - create/update
Opportunity according to collector policy; - emit source events.

It may not: - create CRM Property from market observation; - assign
agents arbitrarily; - act as a human owner-consent actor; - bypass
tenant policy.

------------------------------------------------------------------------

# 49. Automation Authorization

Automation executes as:

``` text
AUTOMATION
```

with a scoped service identity.

Every action must map to an allowed Domain Command.

Automation may not: - execute arbitrary SQL; - change permissions; -
bypass human confirmation; - merge ambiguous entities; - silently
reassign ownership; - publish externally without required confirmation.

------------------------------------------------------------------------

# 50. System Actor

System actions are explicit.

Actor:

``` text
SYSTEM
```

or specialized:

``` text
CLOUD_COLLECTOR
AUTOMATION
INTEGRATION
```

This allows history to answer:

> Was this done by an employee or by the system?

------------------------------------------------------------------------

# 51. Sensitive Actions

Sensitive actions require:

``` text
permission
+
state validation
+
explicit confirmation
+
audit
```

Examples:

``` text
owner.merge
property.merge
property.assign
publication.confirm
billing.manage
support_access.grant
role.assign
user.suspend
company.suspend
document.archive
```

------------------------------------------------------------------------

# 52. Support Access

Platform support access to a company is exceptional.

Requirements:

``` text
explicit authorization
+
time limit
+
reason
+
audit
```

Recommended:

``` text
SUPPORT_SESSION
```

with: - support actor; - company; - start; - expiration; - scope; -
reason.

No permanent hidden access.

------------------------------------------------------------------------

# 53. Role Management

Company Admin may:

``` text
role.create
role.update
role.assign
```

but cannot grant permissions beyond platform policy if those permissions
are reserved for Platform Admin.

Example:

``` text
billing.platform_manage
security.platform_manage
```

cannot be granted by a company admin.

------------------------------------------------------------------------

# 54. Permission Deny by Default

If permission is absent:

``` text
DENY
```

There is no implicit allow because: - user is a manager; - user is
responsible agent; - user knows the owner; - user is in the same
company.

All privileged actions must have an explicit permission path.

------------------------------------------------------------------------

# 55. Permission Hierarchy

Avoid automatic wildcard semantics such as:

``` text
admin.*
```

unless implemented as a deliberate policy abstraction.

Recommended:

``` text
explicit permissions
+
role bundles
```

This makes authorization auditable.

------------------------------------------------------------------------

# 56. Role Assignment

Changing a user's role is itself a privileged action.

Command:

``` text
ASSIGN_USER_ROLE
```

Requirements: - authorized admin; - target user same company; - role
valid; - actor may grant that role; - audit.

Event:

``` text
user.role_assigned
```

------------------------------------------------------------------------

# 57. User Suspension

Command:

``` text
SUSPEND_USER
```

Requirements: - admin permission; - same company unless platform
action; - reason; - audit.

Effects: - invalidate active sessions; - revoke extension access; - stop
new authenticated commands; - preserve historical records.

Never delete user-linked history.

------------------------------------------------------------------------

# 58. Session Security

Sessions must support: - secure expiration; - revocation; - logout; -
suspicious session detection; - rotation where appropriate.

When user is suspended:

``` text
all active sessions → revoked
```

------------------------------------------------------------------------

# 59. Authentication Abstraction

Auth provider is abstracted.

Application should not depend directly on one identity provider.

Concept:

``` ts
interface IdentityProvider {
  authenticate(...)
  refresh(...)
  revoke(...)
  resolveIdentity(...)
}
```

------------------------------------------------------------------------

# 60. API Middleware

Every protected API route must pass:

``` text
authenticate()
→ resolveTenant()
→ authorize()
```

Do not rely only on UI visibility.

A hidden button is not authorization.

------------------------------------------------------------------------

# 61. Server-Side Enforcement

All authorization is enforced server-side.

Frontend checks are UX optimizations only.

Never trust:

``` text
disabled button
hidden menu
client-side role
```

as security controls.

------------------------------------------------------------------------

# 62. Database-Level Isolation

Where appropriate, PostgreSQL RLS must enforce:

``` text
company_id = current tenant
```

Application-level tenant filtering remains mandatory.

Defense in depth:

``` text
API
+
Domain
+
Repository
+
Database
```

------------------------------------------------------------------------

# 63. Repository Authorization Boundary

Repositories must accept tenant context.

Preferred:

``` ts
repository.findProperty(ctx, propertyId)
```

Not:

``` ts
repository.findProperty(propertyId)
```

This reduces accidental cross-tenant access.

------------------------------------------------------------------------

# 64. Domain Authorization Boundary

Domain commands must authorize before mutation.

Example:

``` text
UPDATE_PROPERTY
→ property.update_own
property.update_company
→ ownership/collaboration
→ state validation
→ mutation
```

Do not rely solely on API route authorization.

------------------------------------------------------------------------

# 65. Authorization and Automation

Automation must use the same authorization policy as human commands.

Example:

``` text
Automation:
ASSIGN_AGENT
```

must be checked against: - rule scope; - company; - allowed command; -
target entity; - assignment policy.

Automation is not a superuser.

------------------------------------------------------------------------

# 66. Authorization and Event Consumers

Event consumers use scoped service permissions.

Example:

``` text
MatchingService:
matching.read_property
matching.read_requirements
matching.create_match
```

It does not receive:

``` text
property.assign
billing.manage
user.suspend
```

least privilege applies to services.

------------------------------------------------------------------------

# 67. Field-Level Protection

Architecture must allow field-level authorization for future sensitive
data.

Examples: - financial information; - private notes; - sensitive owner
contact information; - billing data; - support metadata.

At MVP, implement coarse-grained resource permissions first, but do not
make the model incapable of field-level restrictions.

------------------------------------------------------------------------

# 68. Private Notes

Private notes must be explicitly scoped.

Possible:

``` text
PRIVATE_TO_AUTHOR
TEAM
COMPANY
```

A private note must never leak through: - global search; - analytics; -
notifications; - messenger cards; - exports.

------------------------------------------------------------------------

# 69. Export Authorization

Exports are sensitive.

Permissions:

``` text
property.export
client.export
owner.export
deal.export
analytics.company.export
```

Export must: - be audited; - be tenant-scoped; - respect field
visibility; - respect user permission; - have rate/size limits.

------------------------------------------------------------------------

# 70. Bulk Actions

Bulk mutations must authorize each target.

Do not assume:

``` text
permission on first item = permission on all items
```

Preferred:

``` text
validate batch
→ calculate allowed targets
→ reject unsafe partial mutation unless explicitly supported
→ execute
→ emit per-entity events
```

------------------------------------------------------------------------

# 71. Bulk Assignment

Example:

``` text
ASSIGN_PROPERTIES_BULK
```

Requires:

``` text
property.assign
```

for every target.

Audit should record: - actor; - number of records; - target agent; -
individual entity references where required.

------------------------------------------------------------------------

# 72. Cross-Entity Access

Access to a Deal may expose: - Property; - Client; - Owner.

Each referenced entity must obey its own authorization rules.

However, a user authorized for a Deal should not normally see a broken
interface because they lack irrelevant fields.

Therefore the UI/API should return an authorized projection:

``` text
PropertySummary
ClientSummary
```

rather than leaking full records.

------------------------------------------------------------------------

# 73. Authorization-Aware DTOs

Never return unrestricted entity objects.

Examples:

``` text
PropertyDetailDTO
PropertySummaryDTO
ClientSummaryDTO
OwnerContactDTO
```

The projection depends on: - permission; - visibility; - relationship; -
context.

------------------------------------------------------------------------

# 74. Audit Requirements

Every sensitive authorization decision must be auditable.

Record:

``` text
actor
company
action
resource
decision
reason
timestamp
requestId
correlationId
```

Denied sensitive actions must also be recorded where policy requires.

------------------------------------------------------------------------

# 75. Example Audit Record

``` json
{
  "actorId": "U123",
  "companyId": "C1",
  "action": "publication.confirm",
  "resourceType": "PUBLICATION",
  "resourceId": "P456",
  "decision": "ALLOWED",
  "timestamp": "...",
  "requestId": "R1",
  "correlationId": "C9"
}
```

------------------------------------------------------------------------

# 76. Authorization Decision Cache

Caching authorization decisions is dangerous.

If used: - very short TTL; - invalidation on role/permission changes; -
never cache across tenants; - never use stale decision for critical
actions.

For MVP, prefer deterministic server-side evaluation over aggressive
authorization caching.

------------------------------------------------------------------------

# 77. Role / Permission Change Propagation

When role or permission changes:

``` text
role.updated
role.assigned
permission.changed
```

must invalidate relevant sessions/caches as needed.

Existing sessions must not retain unauthorized privileges indefinitely.

------------------------------------------------------------------------

# 78. Team Authorization

Teams are organizational grouping, not a universal security boundary.

Team membership may affect:

``` text
team visibility
team analytics
team assignment
team notifications
```

But team membership does not automatically grant every company
permission.

------------------------------------------------------------------------

# 79. Manager Visibility

Manager may have company-wide operational visibility.

However:

``` text
company-wide visibility ≠ unrestricted modification
```

For example: - Manager can read Property; - Manager can assign
Property; - Manager may not manage billing unless granted.

------------------------------------------------------------------------

# 80. Analytics Authorization

Full company analytics requires:

``` text
analytics.company.read_full
```

This should normally be assigned to: - Admin; - designated main manager.

Agent analytics may be limited to: - own performance; - permitted team
leaderboard; - public achievements.

------------------------------------------------------------------------

# 81. Achievement Authorization

Agent:

``` text
achievement.read
```

can see: - own achievements; - permitted team leaderboard.

Admin:

``` text
achievement.admin.read
```

can see: - qualification evidence; - full company ranking; - historical
awards.

------------------------------------------------------------------------

# 82. Billing Authorization

Billing is company administration.

Permissions:

``` text
billing.read
billing.manage
```

No Agent access by default.

No raw payment credentials are ever exposed through API.

------------------------------------------------------------------------

# 83. Integration Credential Authorization

Only authorized administrators/services may access integration
configuration.

Credentials: - encrypted; - scoped; - rotatable; - revocable; - audited.

API responses must never return secret values.

------------------------------------------------------------------------

# 84. Collector Credential Authorization

Collector credentials are platform/service secrets.

Agents cannot access them.

Company users may see: - adapter status; - health; - last successful
collection;

but not: - source credentials; - cookies; - secret headers.

------------------------------------------------------------------------

# 85. Security Events

Recommended security event types:

``` text
user.login
user.logout
user.login_failed
user.session_revoked
user.role_assigned
user.suspended

permission.granted
permission.revoked

support_access.granted
support_access.revoked

security.authorization_denied
security.sensitive_action_confirmed
```

These belong to security/audit streams.

------------------------------------------------------------------------

# 86. Authorization Denied

Example:

``` text
Agent A
→ tries to assign Property owned by Agent B
```

Result:

``` text
403 FORBIDDEN
```

Code:

``` text
OWNERSHIP_DENIED
```

Audit/security event:

``` text
security.authorization_denied
```

where required by policy.

Do not reveal unnecessary information about the protected resource.

------------------------------------------------------------------------

# 87. Preventing IDOR

Every resource lookup must verify tenant and authorization.

Never:

``` text
GET /properties/{id}
→ return by ID
```

without authorization.

IDs are not access credentials.

Opaque IDs do not replace authorization.

------------------------------------------------------------------------

# 88. Preventing Privilege Escalation

User cannot: - edit their own permission set; - assign themselves
Admin; - modify role permissions without authorization; - change
companyId; - impersonate another agent; - invoke service-only commands.

All role/permission mutations require explicit authorization.

------------------------------------------------------------------------

# 89. Preventing Tenant Escape

Reject: - foreign entity IDs; - foreign team IDs; - foreign user IDs; -
foreign document IDs; - foreign conversation IDs.

Never silently attach foreign resources.

------------------------------------------------------------------------

# 90. API Error Semantics

For unauthorized access:

Prefer:

``` text
404 NOT_FOUND
```

when revealing resource existence would itself be sensitive.

Use:

``` text
403 FORBIDDEN
```

when resource existence is already legitimately known and the user lacks
action permission.

Policy must be consistent.

------------------------------------------------------------------------

# 91. Authorization Test Matrix

Every protected command requires tests for:

``` text
unauthenticated
wrong company
no permission
wrong ownership
authorized owner
authorized collaborator
manager
admin
viewer
system actor
automation actor
```

Sensitive commands additionally test: - confirmation; - audit; - session
validity.

------------------------------------------------------------------------

# 92. Critical RBAC E2E Tests

## Agent

``` text
read opportunity ✓
claim opportunity ✓
contact owner ✓
create property ✓
update own property ✓
update another agent property ✗
assign property ✗
view company properties ✓
request collaboration ✓
confirm publication ✓
manage billing ✗
read full company analytics ✗
```

## Manager

``` text
company property read ✓
assign property ✓
manage deal stages ✓
company operational analytics ✓
billing depending on permission
```

## Admin

``` text
user management ✓
role management ✓
company analytics ✓
automation ✓
billing ✓
audit ✓
```

------------------------------------------------------------------------

# 93. Service Authorization Test Matrix

## Collector

Allowed:

``` text
source observation
source listing
opportunity
collector health
```

Forbidden:

``` text
property creation from observation
human consent
user role management
billing
```

## Matching

Allowed:

``` text
read property
read requirements
create match
invalidate match
```

Forbidden:

``` text
reassignment
billing
publication
permission management
```

## Automation

Allowed:

``` text
configured domain commands
```

Forbidden:

``` text
arbitrary DB
permission escalation
silent publication
ambiguous merge
```

------------------------------------------------------------------------

# 94. Frontend Authorization

Frontend should use permission state for UX:

``` ts
can("property.assign")
```

This controls: - buttons; - menus; - command palette; - contextual
actions.

But server authorization remains mandatory.

------------------------------------------------------------------------

# 95. Command Surface

Command palette must show only commands the actor can potentially
execute.

Example:

Agent:

``` text
Добавить объект
Создать клиента
Запланировать показ
Опубликовать
```

Manager additionally:

``` text
Назначить объект
Настроить этапы
```

Admin additionally:

``` text
Пользователи
Роли
Аналитика
Billing
```

This is UX filtering, not security.

------------------------------------------------------------------------

# 96. Navigation Authorization

Navigation modules must be permission-aware.

Example:

``` text
Analytics
```

is visible only when:

``` text
analytics.company.read_full
```

exists.

But direct URL access must still be server-protected.

------------------------------------------------------------------------

# 97. Mobile Authorization

Mobile clients use the same domain/API authorization model.

No mobile-specific bypass.

------------------------------------------------------------------------

# 98. API Keys

If API keys are introduced later:

-   company-scoped;
-   user/service-scoped;
-   permission-scoped;
-   rotatable;
-   revocable;
-   hashed where possible;
-   audited.

API keys never inherit unrestricted Admin access by default.

------------------------------------------------------------------------

# 99. Webhooks

Webhook identity is integration-scoped.

Validate: - signature; - provider; - endpoint; - timestamp/replay
protection where supported; - idempotency.

Webhook cannot act as arbitrary company user.

------------------------------------------------------------------------

# 100. Impersonation

Impersonation is not a normal feature.

If introduced for support: - explicit permission; - explicit reason; -
time limit; - visible UI state; - audit; - no hidden actions.

------------------------------------------------------------------------

# 101. Data Deletion

Core CRM data should normally use lifecycle/archive semantics.

Hard deletion requires: - explicit policy; - elevated permission; -
dependency analysis; - audit; - legal/data-retention compliance.

Historical events must not be silently deleted merely because an entity
is archived.

------------------------------------------------------------------------

# 102. Company Lifecycle

Company states:

``` text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
DELETED
```

Authorization must include company state.

Examples:

``` text
SUSPENDED
→ read may be restricted
→ mutation blocked
→ billing/admin recovery remains available
```

Data remains preserved according to retention policy.

------------------------------------------------------------------------

# 103. Feature Flags vs Permissions

These are separate.

Permission:

``` text
may this user do it?
```

Feature flag:

``` text
is this capability enabled for this company/environment?
```

Effective access:

``` text
Authenticated
AND Tenant Active
AND Feature Enabled
AND Permission Granted
AND Resource Allowed
```

A feature flag must not be used as a replacement for authorization.

------------------------------------------------------------------------

# 104. Plan Entitlements vs Permissions

Billing entitlement answers:

``` text
Does this company have the module?
```

RBAC answers:

``` text
May this user use it?
```

Both must pass.

Example:

``` text
advanced_analytics entitlement
+
analytics.company.read_full
```

required for full analytics.

------------------------------------------------------------------------

# 105. Authorization Decision Example

Request:

``` text
Agent A
→ confirm publication for Property P
```

Evaluation:

``` text
authenticated?          YES
company matches?        YES
publication feature?    YES
property visible?       YES
publication.confirm?    YES
property valid?         YES
human confirmation?     YES
→ ALLOW
```

Otherwise:

``` text
→ DENY
```

------------------------------------------------------------------------

# 106. Complete Authorization Formula

For a normal operation:

``` text
ALLOW =
  authenticated
  AND tenant_match
  AND company_active
  AND feature_enabled
  AND permission_granted
  AND visibility_allowed
  AND ownership_or_collaboration_allowed
  AND entity_state_allows
  AND confirmation_if_required
```

Not every operation needs every term, but no applicable control may be
skipped.

------------------------------------------------------------------------

# 107. Frozen Invariants

The following are mandatory:

1.  Company is the tenant boundary.
2.  `companyId` comes from trusted auth context.
3.  Identity, permission, role, ownership, and collaboration remain
    separate.
4.  Server-side authorization is mandatory.
5.  UI hiding is not security.
6.  Permission is deny-by-default.
7.  Responsible Agent is not Admin.
8.  Collaboration does not transfer ownership.
9.  Opportunity Feed is company-wide by default.
10. Personal archive does not hide an Opportunity from others.
11. Collector cannot create CRM Property merely by observing a listing.
12. Owner consent is a business boundary.
13. Extension cannot reveal hidden phone.
14. Extension cannot silently publish.
15. Automation cannot bypass sensitive human confirmation.
16. Ambiguous merges require review.
17. Sensitive actions are audited.
18. Cross-tenant access is forbidden.
19. Historical data is preserved.
20. Service identities use least privilege.

------------------------------------------------------------------------

# 108. Implementation Blueprint

Recommended modules:

``` text
/auth
  IdentityProvider
  SessionService
  AuthContextFactory

/authorization
  AuthorizationService
  PermissionRegistry
  RoleService
  PolicyEvaluator
  VisibilityService
  OwnershipPolicy

/security
  SecurityEventService
  SensitiveActionService
  SupportAccessService

/tenant
  TenantContext
  TenantGuard

/audit
  AuditService
```

Domain modules call authorization through application/domain boundaries,
not directly from UI.

------------------------------------------------------------------------

# 109. Permission Registry

All permissions should be centrally registered.

Example:

``` ts
export const PERMISSIONS = {
  OPPORTUNITY_READ: "opportunity.read",
  OPPORTUNITY_CLAIM: "opportunity.claim",
  OPPORTUNITY_CONTACT: "opportunity.contact",

  PROPERTY_READ: "property.read",
  PROPERTY_CREATE: "property.create",
  PROPERTY_UPDATE_OWN: "property.update_own",
  PROPERTY_UPDATE_COMPANY: "property.update_company",
  PROPERTY_ASSIGN: "property.assign",

  ANALYTICS_COMPANY_READ_FULL:
    "analytics.company.read_full",

  PUBLICATION_CONFIRM:
    "publication.confirm"
} as const
```

Unknown permission identifiers are rejected.

------------------------------------------------------------------------

# 110. Built-In Role Bundles

Roles should be stored as permission bundles.

Conceptually:

``` text
ADMIN
  → broad company permissions

MANAGER
  → operational company permissions

AGENT
  → operational own/collaborative permissions

VIEWER
  → read permissions
```

Do not hardcode authorization checks such as:

``` ts
if (user.role === "ADMIN")
```

inside domain logic.

Use:

``` ts
authorize(ctx, "property.assign")
```

------------------------------------------------------------------------

# 111. Custom Roles

Architecture supports:

``` text
Sales Manager
Senior Agent
Marketing
Analyst
Accountant
Office Manager
```

without changing domain code.

Custom role creation is controlled by:

``` text
role.create
role.update
role.assign
```

------------------------------------------------------------------------

# 112. Permission Deprecation

Permissions must be versionable.

If a permission is retired:

``` text
deprecated → migration → removed
```

Do not silently reinterpret an old permission as a different privilege.

------------------------------------------------------------------------

# 113. Authorization Documentation

Every new domain command must document:

``` text
required permission
resource scope
ownership policy
collaboration policy
sensitivity
confirmation requirement
audit requirement
```

Example:

``` text
CHANGE_PROPERTY_PRICE

permission:
property.update_own
property.update_company

ownership:
responsible agent or authorized manager

sensitive:
NO

audit:
YES
```

------------------------------------------------------------------------

# 114. New Command Review Gate

A new command cannot enter production without answering:

1.  Who can invoke it?
2.  On which tenant?
3.  On which entities?
4.  Is ownership relevant?
5.  Is collaboration relevant?
6.  Is explicit confirmation required?
7.  What event is emitted?
8.  What audit record is produced?
9.  Can automation invoke it?
10. Can extension invoke it?
11. Is it replay-safe?
12. What happens when permission is denied?

------------------------------------------------------------------------

# 115. Final RBAC Matrix --- High Level

  Capability                  Agent      Manager   Admin   Viewer   System
  ------------------------- ------- ------------ ------- -------- --------
  View opportunities              ✓            ✓       ✓        ✓   scoped
  Claim opportunity               ✓            ✓       ✓      ---      ---
  Contact owner                   ✓            ✓       ✓      ---      ---
  Create property                 ✓            ✓       ✓      ---   scoped
  Update own property             ✓            ✓       ✓      ---      ---
  Update company property       ---            ✓       ✓      ---   scoped
  Assign property               ---            ✓       ✓      ---   scoped
  Create client                   ✓            ✓       ✓      ---      ---
  Create requirement              ✓            ✓       ✓      ---   scoped
  Create deal                     ✓            ✓       ✓      ---      ---
  Change own deal stage           ✓            ✓       ✓      ---      ---
  Manage company stages         ---            ✓       ✓      ---      ---
  Schedule showing                ✓            ✓       ✓      ---      ---
  Manage own NextActions          ✓            ✓       ✓     read   scoped
  Collaboration request           ✓            ✓       ✓      ---      ---
  Prepare publication             ✓            ✓       ✓      ---      ---
  Confirm publication             ✓            ✓       ✓      ---      ---
  Full company analytics        ---   designated       ✓      ---      ---
  Manage automation             ---     ✓/policy       ✓      ---   scoped
  Manage users                  ---       policy       ✓      ---      ---
  Manage roles                  ---   ---/policy       ✓      ---      ---
  Manage billing                ---       policy       ✓      ---      ---
  Read audit                    ---       policy       ✓      ---      ---

`designated`, `policy`, and `scoped` are deliberate placeholders for
deployment-specific permission bundles, not implicit access.

------------------------------------------------------------------------

# 116. End-to-End Authorization Example

Scenario:

> Agent David finds a Property belonging to Anna and wants to work with
> the client.

Correct flow:

``` text
David
 ↓
property.read
 ↓
Property visible
 ↓
David sees responsibleAgent = Anna
 ↓
David requests collaboration
 ↓
collaboration.requested
 ↓
Anna receives notification
 ↓
Anna remains responsible
```

David does not:

``` text
take ownership
```

unless a separately authorized reassignment occurs.

------------------------------------------------------------------------

# 117. Final Security Contract

KleeKto authorization is based on:

``` text
IDENTITY
   +
TENANT
   +
PERMISSION
   +
VISIBILITY
   +
OWNERSHIP / COLLABORATION
   +
ENTITY STATE
   +
CONFIRMATION
```

The system must never rely on a single role check as a substitute.

------------------------------------------------------------------------

# 118. Final Principle

> **KleeKto does not ask only "Who are you?" It asks "Who are you, in
> which company, with which permission, accessing which entity, under
> which visibility and ownership rules, and is this action allowed in
> the entity's current state?"**

That is the authorization boundary for the KleeKto operating system.

**This document is the KleeKto Authorization & RBAC Specification v1.0
implementation baseline.**
