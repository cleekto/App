> **АРХИВ. Это не инструкция и не требование.**
>
> Документ лежал в проекте как `docs/CLAUDE.md` и описывал другой продукт — «AI Real Estate OS»: серверные скраперы вместо расширения, Python/FastAPI вместо TypeScript, Redis и Celery, AI как ядро продукта, своя терминология и своя нумерация фаз. Решением владельца от 2026-08-30 (вопрос Q16, пункты C-01..C-03) главными признаны спецификация и мастер-промпт; рабочий `CLAUDE.md` в корне репозитория — производный от них.
>
> Документ сохранён по двум причинам: в нём есть материал для фаз после MVP (история цены, жизненный цикл объявления, сигналы качества данных, `before`/`after` в аудите — см. `docs/analysis/contradictions.md`, раздел «Что стоит забрать»), и в нём же зафиксирована альтернативная продуктовая рамка, к которой можно вернуться осознанно.
>
> **Claude Code: этот файл не читается в начале сессии и не является источником требований.** Брать из него что-либо можно только через явный ADR.

---

# CLAUDE.md — Real Estate AI Operating System

## 0. Project Identity

This repository is for a multi-tenant SaaS platform for real-estate agencies.

Working product concept:

> **AI Real Estate OS — CRM + Property Intelligence + AI Sales Copilot**

The system is not intended to be "just another CRM". Its differentiating layer is a unified property-data engine that collects listings from multiple real-estate sources, normalizes them, detects duplicates, tracks price history, matches properties to clients, and feeds structured data into an AI-assisted sales workflow.

### Primary target customer

Initial ICP:

- Real-estate agencies with approximately 5–50 agents.
- Agencies that use multiple external listing portals.
- Agencies with meaningful inbound lead volume.
- Agencies where property data, leads, calls, messaging, and sales activity are currently fragmented across spreadsheets, messengers, listing portals, and separate systems.

### Core product thesis

> All agency clients, leads, properties, listings, communications, tasks and deals should exist in one operational system, with the property market continuously enriched by external data and AI.

---

# 1. Product Principles

These principles are mandatory architectural guidance.

1. **Data quality before AI.**
   AI is only useful when the underlying property and CRM data is structured, normalized, current and trustworthy.

2. **CRM + Property Intelligence are the core product.**
   AI is an enhancement layer, not a substitute for a robust domain model.

3. **Deterministic logic before LLM logic.**
   Do not use an LLM for tasks that can be solved reliably with SQL, rules, parsers, regular expressions, or deterministic algorithms.

4. **Modular monolith first.**
   Do not introduce microservices unless there is a demonstrated operational need.

5. **Multi-tenancy from day one.**
   Every organization-owned resource must be isolated by tenant.

6. **Provider independence.**
   Telephony, messaging, AI models, maps and external listing sources must be abstracted behind interfaces/adapters where practical.

7. **API-first domain design.**
   Business logic belongs in backend services, not duplicated inside UI components.

8. **Tests are part of implementation.**
   Every meaningful backend feature must include appropriate unit/integration tests.

9. **Small, reviewable changes.**
   AI agents should modify only the requested scope and should not refactor unrelated code without an explicit reason.

10. **Security and auditability are first-class requirements.**
    Sensitive actions and tenant boundaries must be observable and enforceable.

---

# 2. Product Scope

## 2.1 Core domains

The platform should contain these domains:

### CRM
- Organizations
- Offices
- Teams
- Users
- Roles
- Contacts
- Leads
- Deals
- Pipelines
- Pipeline stages
- Tasks
- Activities
- Appointments
- Notes
- Tags
- Lead sources

### Property intelligence
- Properties
- Listings
- Listing sources
- Property media
- Property changes
- Price history
- Property matching
- Duplicate detection
- Market statistics
- Search and filters
- Property watchlists

### Communication
- Calls
- Call recordings
- Call transcriptions
- WhatsApp
- SMS
- Email
- Unified communication timeline
- Click-to-call
- Messaging provider adapters

### AI
- Property extraction
- Lead summarization
- Lead qualification
- Semantic search
- Client/property matching
- Sales copilot
- Call intelligence
- AI market analysis
- CRM natural-language assistant
- Automated next-best-action suggestions

### Organization management
- Permissions
- Office hierarchy
- Teams
- Commission rules
- Audit log
- Billing
- Usage
- Feature flags

---

# 3. Product Positioning

Avoid positioning the product simply as:

> "A CRM for real-estate agencies."

Preferred positioning:

> **AI operating system for real-estate agencies.**

The three primary killer features are:

1. **Unified Property Database**
   - Multiple property portals
   - One canonical property record
   - Duplicate detection
   - Source aggregation
   - Price history
   - New-listing alerts

2. **AI Buyer Matching**
   - Client requirements become structured search criteria
   - AI ranks suitable properties
   - AI explains why a property matches
   - Continuous matching/watch mode

3. **AI Sales Copilot**
   - Understands CRM activity
   - Summarizes calls and communications
   - Suggests next actions
   - Detects stalled deals
   - Highlights overdue work and opportunities

---

# 4. Initial MVP

Do not overbuild the first release.

## MVP v0.1

### Authentication
- Login
- Organization membership
- Basic role support

### CRM
- Organizations
- Users
- Contacts
- Leads
- Properties
- Listings
- Pipeline
- Deals
- Tasks
- Activities

### Property engine
- One listing source initially
- Scraper
- Parser
- Normalizer
- Validation
- Persistence
- Basic duplicate detection

### Search
- Property search
- Client search
- Lead search

### Dashboard
- Lead count
- Pipeline value/count
- Open tasks
- Deal count
- Basic agent performance

## MVP v0.2

- 2–5 listing sources
- Property price history
- Advanced deduplication
- AI property extraction
- Semantic property search
- AI client/property matching
- Notifications
- Property watch

## MVP v0.3

- Telephony
- Incoming call lookup
- Click-to-call
- Call history
- Call recording
- Transcription
- AI call summary
- AI next-action extraction
- WhatsApp integration

## MVP v0.4

- Market analytics
- Agent performance intelligence
- AI Sales Copilot
- Automated property recommendations
- "What needs attention today?" dashboard
- Price-drop intelligence

## v1.0

- Multi-office support
- Billing
- White-label
- Public API
- Advanced integrations
- Advanced analytics
- Usage-based AI and communication billing

---

# 5. Explicit Non-Goals for MVP

Do not implement these unless specifically requested:

- Full ERP/accounting system
- Full mobile apps
- Custom map infrastructure
- Mortgage system
- Electronic signature platform
- AI voice agent
- Enterprise-grade BI suite
- 50+ scrapers
- Marketplace for property consumers
- International telephony abstraction covering every carrier

---

# 6. Recommended Technology Stack

## Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy or equivalent typed ORM/data layer

## Database

- PostgreSQL
- PostGIS
- pgvector

## Backend infrastructure

- Redis
- Celery or equivalent background-job infrastructure

For workflow-heavy orchestration at larger scale, evaluate Temporal. Do not introduce Temporal merely for the first MVP.

## Scraping

- Playwright
- Cloudflare Browser Run where cloud browser execution is useful
- Apify as optional infrastructure/fallback, not as the only architectural dependency

## Auth / storage

- Supabase Auth or equivalent
- Supabase Storage or S3-compatible storage

## AI

Use a model-routing architecture.

### GPT-5.6 Sol
Use for:
- Complex reasoning
- Difficult coding problems
- Architecture review
- Complex document analysis
- Advanced agent workflows
- High-value reasoning tasks

### GPT-5.6 Terra
Primary production AI model for:
- Structured extraction
- CRM assistant
- Lead summarization
- Matching
- General business workflows
- Moderate-complexity reasoning

### GPT-5.6 Luna
Use for:
- High-volume classification
- Mass enrichment
- Short summaries
- Background normalization
- Candidate deduplication
- Low-cost bulk processing

Never use the most expensive model by default when a cheaper model is sufficient.

## Maps

Evaluate:
- Mapbox
- Google Maps

Use an abstraction layer so map vendors can be replaced.

## Telephony

Design provider-independent adapters.

Initial candidates:
- Twilio
- SIP-compatible providers
- Local SIP/telephony providers

## Observability

- Sentry
- PostHog
- Structured application logs
- Audit logs

## CI/CD

- GitHub
- GitHub Actions
- Docker

## Hosting

A pragmatic starting architecture:

- Cloudflare for DNS/CDN/browser services
- Vercel or equivalent for Next.js
- Supabase for PostgreSQL/Auth/Storage
- VPS / Railway / Render / equivalent for FastAPI + workers

Do not introduce Kubernetes for MVP.

---

# 7. Recommended High-Level Architecture

Use a modular monolith.

```text
                    FRONTEND
                Next.js / TypeScript
                         |
                         v
                     API LAYER
                       FastAPI
                         |
          +--------------+---------------+
          |              |               |
          v              v               v
         CRM            DATA            AI
          |              |               |
          |           Scrapers        AI Router
          |           ETL             LLM
          |           Listings        Embeddings
          |           Matching        Agents
          |
          +--------------+---------------+
                         |
                  PostgreSQL
                 + PostGIS
                 + pgvector
                         |
                +--------+--------+
                |                 |
              Redis             Storage
```

---

# 8. Repository Structure

Recommended structure:

```text
realestate-crm/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── scraping/
│   ├── ai/
│   └── operations/
├── frontend/
├── backend/
├── scrapers/
├── ai/
├── database/
├── infra/
├── tests/
├── scripts/
└── .github/
```

Keep domain boundaries explicit.

---

# 9. Domain Model

Important entities:

```text
Organization
Office
Team
User
Role

Contact
Lead
LeadSource

Property
Listing
ListingSource
PropertyMedia
PropertyChange
PropertyPrice

Pipeline
PipelineStage
Deal

Activity
Task
Appointment

Call
Message
Email

Document
Commission
Transaction

AiTask
AiOutput

ScraperSource
ScraperRun

AuditLog
```

## Critical distinction

**Property != Listing**

A `Property` is the canonical real-world property.

A `Listing` is a source-specific representation of that property.

Example:

```text
Property:
  3 rooms
  85 m²
  Vake
  Floor 7

Listings:
  MyHome listing
  SS listing
  Agency website listing
  Facebook listing
```

This distinction is mandatory because the product is expected to aggregate multiple sources.

---

# 10. Multi-Tenancy

Every organization-owned business record must be associated with an `organization_id`.

Conceptually:

```text
Organization A
  ├── users
  ├── contacts
  ├── leads
  ├── properties
  └── deals

Organization B
  ├── users
  ├── contacts
  ├── leads
  ├── properties
  └── deals
```

Use PostgreSQL Row-Level Security where appropriate.

Never rely only on frontend filtering for tenant isolation.

Every backend query involving tenant-owned data must be scoped through a trusted tenant context.

---

# 11. Suggested Database Conventions

## IDs

Prefer UUIDs or another collision-resistant identifier.

## Timestamps

Store:
- `created_at`
- `updated_at`

Use timezone-aware timestamps.

## Soft deletion

Use soft-delete fields where business recovery/audit requires it.

## Auditing

Business-critical mutations should generate audit records.

Example:

```text
16:43
Agent David

Property status:
ACTIVE -> SOLD
```

Audit log should capture:
- organization
- actor
- entity
- entity id
- action
- before state where appropriate
- after state where appropriate
- timestamp
- source/request context when useful

---

# 12. Property Data Engine

The property data engine is one of the most important subsystems.

Recommended flow:

```text
SOURCE
  |
  v
FETCH
  |
  v
PARSE
  |
  v
NORMALIZE
  |
  v
VALIDATE
  |
  v
ENRICH
  |
  v
DEDUPLICATE
  |
  v
CANONICAL PROPERTY
  |
  v
SEARCH / MATCHING / ANALYTICS
```

## Use source adapters

Do not build one universal scraper.

Recommended:

```text
scrapers/
  myhome/
    scraper.py
    parser.py
    mapper.py
  ss/
    scraper.py
    parser.py
    mapper.py
  korter/
    scraper.py
    parser.py
    mapper.py
```

Every adapter must map source-specific data into a canonical internal schema.

Example conceptual canonical record:

```json
{
  "source": "myhome",
  "source_id": "123456",
  "url": "https://...",
  "title": "...",
  "price": 147000,
  "currency": "USD",
  "area": 92,
  "rooms": 3,
  "floor": 8,
  "total_floors": 12,
  "district": "Saburtalo",
  "address": "...",
  "lat": 41.72,
  "lng": 44.75,
  "photos": [],
  "description": "...",
  "agent": {}
}
```

---

# 13. Scraping Rules

Never assume that all sources can be scraped identically.

Possible source characteristics:
- static HTML
- client-rendered pages
- embedded JSON
- JSON-LD
- API calls
- authentication
- pagination
- anti-bot systems
- changing DOM structures

Preferred extraction order:

```text
Embedded structured data / API response
        ->
Deterministic DOM parser
        ->
Fallback selectors
        ->
LLM-assisted extraction only where ambiguity remains
```

Do not make LLM extraction the primary parser unless there is a concrete need.

### Legal/operational rule

For every new external source:
- review terms of use
- review robots.txt
- understand rate limits
- avoid bypassing access controls
- respect applicable privacy and copyright requirements
- store only what the product is permitted to store/use

Document source-specific restrictions in `docs/scraping/`.

---

# 14. Scraper Job Architecture

Scraping must be asynchronous.

Do not perform long scraping jobs inside a normal API request.

Use:

```text
API / Scheduler
      |
      v
JOB QUEUE
      |
      v
WORKER
      |
      v
SCRAPER
      |
      v
PARSER
      |
      v
NORMALIZER
      |
      v
VALIDATOR
      |
      v
DATABASE
```

Every scraper execution should be observable.

Track:
- start time
- end time
- source
- pages attempted
- listings discovered
- listings changed
- failures
- rate-limit events
- parsing errors

Create a `scraper_runs` record for every execution.

---

# 15. Property Deduplication

Duplicate detection should be layered.

## Stage 1 — deterministic

Use:
- source id
- canonical URL
- exact external identifiers
- trusted phone/owner identifier where permitted
- exact coordinates when meaningful

## Stage 2 — fuzzy/rule-based

Compare:
- address similarity
- coordinate distance
- area
- room count
- floor
- price
- title/description similarity
- photo fingerprints where legally/operationally appropriate

Conceptual scoring:

```text
address similarity      25%
coordinates             25%
area                    15%
rooms                   10%
floor                    5%
photos                  10%
description             10%
```

Suggested initial thresholds:

```text
> 0.92      automatic merge
0.75–0.92   human review
< 0.75      separate
```

These thresholds are starting points only. Validate them on real data before production use.

## Stage 3 — semantic/AI support

Use embeddings or LLM assistance for ambiguous candidates.

Never use AI to blindly merge records.

A false merge can corrupt the canonical dataset.

---

# 16. Property Price History

Track every meaningful price change.

Conceptual timeline:

```text
04.05    $159,000
21.05    $154,000
17.06    $149,000
02.08    $147,000
```

Derived metrics:
- absolute change
- percentage change
- days on market where calculable
- number of reductions
- current vs initial price
- listing reactivation
- source changes

---

# 17. CRM Pipeline

Pipelines must be configurable by organization.

Example default:

```text
NEW LEAD
   ->
CONTACTED
   ->
QUALIFIED
   ->
NEEDS DEFINED
   ->
PROPERTIES SENT
   ->
VIEWING SCHEDULED
   ->
VIEWING COMPLETED
   ->
NEGOTIATION
   ->
RESERVATION
   ->
DEAL
   ->
CLOSED
```

Do not hard-code this pipeline into business logic.

---

# 18. Lead / Client Qualification

The system should gradually structure client requirements:

```text
budget
location
property type
rooms
minimum area
maximum area
floor preference
building age
new build / resale
purpose
financing
timeline
special requirements
```

Source inputs may include:
- CRM forms
- manual agent input
- WhatsApp
- calls
- email
- imported lead data

AI may convert unstructured conversation into structured fields, but extracted values must remain reviewable.

---

# 19. AI Property Matching

Example client:

```text
Budget: <$150k
District: Saburtalo
Rooms: 2–3
Area: >70 m²
Floor: not first
New building preferred
```

System should return ranked results:

```text
98% match
94% match
93% match
91% match
```

Every ranking should have explainable features.

Example:

> 94% match. Meets budget, district, area and room requirements. Floor is acceptable. Building type differs from stated preference.

Avoid "black-box" ranking where the agent cannot understand why something was recommended.

---

# 20. Property Watch

A client can have a persistent property search:

```text
Client: Giorgi
District: Saburtalo
2–3 rooms
60 m²+
Budget < $160k
```

When a new property matches:
- store the match
- score it
- notify responsible agent
- optionally queue a client recommendation

Example:

```text
NEW MATCH
87% match
$145,000
82 m²
3 rooms
Saburtalo
```

---

# 21. AI Layer

Do not put all AI logic in one large prompt.

Use explicit AI capabilities.

Recommended modules:

```text
ai/
  router/
  extraction/
  classification/
  embeddings/
  matching/
  summarization/
  sales_copilot/
  call_intelligence/
  analytics/
```

Each module should have:
- input schema
- output schema
- model selection
- validation
- error handling
- observability
- cost tracking

---

# 22. AI Model Routing

Conceptual routing:

```text
                    AI ROUTER
                        |
          +-------------+-------------+
          |             |             |
         SOL          TERRA         LUNA
          |             |             |
     high-value      primary        bulk/high-
     reasoning      production       volume
```

Use:
- Sol for difficult reasoning/coding/architecture
- Terra for general production AI workflows
- Luna for high-volume low-cost tasks

Do not hardcode model names throughout the application.

Create a centralized model configuration.

Example conceptual interface:

```python
class AIProvider:
    def generate(...)
    def generate_structured(...)
    def embed(...)
```

The exact implementation may evolve.

---

# 23. AI Tasks

Initial AI capabilities:

## Property Parser
Input:
- listing text
- images/screenshots where applicable
- structured source content

Output:
- rooms
- area
- address
- district
- floor
- building type
- amenities
- condition
- extracted claims

## Lead Summary
Input:
- contact history
- activity history
- messages
- notes

Output:
- needs
- budget
- timing
- objections
- next action

## Lead Qualification
Generate structured lead fields from unstructured communication.

## Matching
Rank properties for a client.

## Sales Copilot
Answer:
- What should I do next?
- Which leads are at risk?
- Which clients have not been followed up?
- Which properties should I send?
- Which deals are stalled?

## Call Intelligence
Pipeline:

```text
Call
  ->
Transcript
  ->
Summary
  ->
Intent
  ->
Objections
  ->
Next action
  ->
CRM update
```

## Market Intelligence
Analyze:
- median/average price per m²
- price movement
- listing activity
- district-level changes
- price-drop frequency
- time-on-market where data supports it

---

# 24. "Ask Your CRM"

The platform should eventually support natural-language operational queries.

Examples:

> "Why are David's deals below last month's level?"

> "Show me buyers in Vake looking under $200k."

> "Which clients haven't received a suitable property in 7 days?"

> "What properties under $150k were added in Saburtalo today?"

> "Which deals are inactive for more than a week?"

This should use a controlled agent/tool architecture rather than direct unrestricted database access.

AI must only use explicitly permitted tools and scoped data.

---

# 25. Sales Copilot

A key dashboard section:

> **What needs attention today?**

Example:

```text
7 leads have not been contacted.

4 clients are waiting for property selection.

3 deals have been inactive for >7 days.

2 agents have overdue tasks.

5 new properties match high-priority buyers.

3 properties have dropped in price.
```

This should be based on deterministic CRM queries first, with AI used for summarization and prioritization.

---

# 26. Telephony Architecture

Do not bind the CRM to one provider.

Use an adapter/interface model.

```text
Telephony abstraction
      |
  +---+-----+------+
  |         |      |
Twilio    SIP     Local provider
```

Core events:
- incoming call
- outgoing call
- call connected
- call ended
- recording available
- transcription available

Desired workflow:

```text
Incoming call
      ->
Phone lookup
      ->
Contact match
      ->
Open CRM profile
      ->
Log activity
      ->
Recording
      ->
Transcription
      ->
AI summary
      ->
Extract next task
```

Make provider webhooks idempotent.

Never process the same telephony event twice.

---

# 27. Messaging

Unified communication timeline should normalize:

```text
Call
WhatsApp
SMS
Email
Note
Meeting
Task
```

Example:

```text
12:31 WhatsApp
13:02 Call
13:17 Email
14:22 WhatsApp
```

Store provider-specific identifiers separately from internal IDs.

---

# 28. Security

Mandatory requirements:

## Authentication
- Secure password/auth handling
- Session management
- MFA readiness
- OAuth where needed

## Authorization
Use roles and organization-level permissions.

Do not assume:
"logged in" = "authorized".

## Tenant isolation
Enforce server-side and preferably database-level isolation.

## Secrets
Never commit:
- API keys
- passwords
- JWT secrets
- provider credentials

Use environment variables / secret managers.

## Personal data
Treat:
- names
- phone numbers
- email
- call recordings
- messages
- client preferences

as sensitive operational data.

Define retention and access rules.

## Audit
Track security-sensitive and business-sensitive mutations.

---

# 29. Testing Strategy

Testing must exist at multiple levels.

## Unit tests
For:
- parsers
- normalizers
- scoring
- duplicate algorithms
- domain services
- permission checks

## Integration tests
For:
- API endpoints
- database access
- tenant isolation
- job execution
- external adapter mocks

## End-to-end
For critical flows:
- login
- create lead
- create property
- move deal
- search property
- assign lead
- create task

## Scraper tests
Keep representative fixtures from each source where legally and operationally permissible.

Test:
- DOM changes
- missing fields
- malformed values
- pagination
- duplicate listings

## AI tests
Use deterministic structured-output validation.

Do not assert exact natural-language wording.

Validate:
- schema
- required fields
- allowed enums
- business constraints

---

# 30. Development Workflow with AI

The project will be developed AI-assisted.

Do NOT ask an AI coding agent:

> "Build the whole CRM."

Instead use:

```text
PRD
 ->
Architecture
 ->
Schema
 ->
API contract
 ->
One module
 ->
Tests
 ->
Implementation
 ->
Review
 ->
Integration
```

Every task should be small and explicit.

Example task:

> Implement `POST /api/leads` according to the current API contract. Add Pydantic validation, repository/service layers, unit tests, integration tests, and do not modify unrelated modules.

---

# 31. Repository-Level AI Instructions

Maintain this `CLAUDE.md` as the primary project context.

Also consider:

```text
docs/
  architecture/
  api/
  database/
  scraping/
  ai/
```

The AI agent should read the relevant documentation before making changes to that subsystem.

When a major architectural decision changes:
1. Update the documentation.
2. Update the implementation.
3. Add/modify tests.
4. Update migration notes when needed.

---

# 32. Git Rules

Preferred behavior:

- One logical change per branch/commit where practical.
- Avoid unrelated formatting changes.
- Never rewrite history unless explicitly requested.
- Do not delete tests to make a change pass.
- Do not disable linting/type checking to bypass an issue.
- Do not commit secrets.
- Commit messages should describe intent.

Before creating a PR/merge:
- run tests
- run lint
- run type checks
- run relevant integration tests

---

# 33. API Conventions

Use predictable REST-style endpoints unless a specific domain requires another pattern.

Example:

```text
GET    /api/properties
POST   /api/properties
GET    /api/properties/{id}
PATCH  /api/properties/{id}
DELETE /api/properties/{id}

GET    /api/leads
POST   /api/leads
GET    /api/leads/{id}
PATCH  /api/leads/{id}
```

Do not put business rules into route handlers.

Preferred:

```text
Router
  ->
Schema validation
  ->
Service
  ->
Repository
  ->
Database
```

---

# 34. Background Jobs

Potential periodic jobs:

```text
scrape source every N minutes
refresh stale listing
detect listing changes
update price history
run deduplication candidates
process embeddings
process AI summaries
process call recordings
send notifications
calculate metrics
```

Jobs must be:
- idempotent
- retryable
- observable
- bounded
- rate-limit aware

---

# 35. Observability

Track system health from the beginning.

Minimum:
- request latency
- error rate
- job failures
- scraper failures
- AI request count
- AI cost
- model usage
- DB latency
- queue depth
- authentication failures

Product analytics:
- active users
- searches
- property views
- lead creation
- task completion
- deal movement
- property matches
- AI feature usage

---

# 36. Cost Control

AI cost can become substantial.

Rules:

1. Use cheaper models for bulk operations.
2. Cache where outputs are stable.
3. Avoid repeated processing of unchanged listings.
4. Hash normalized listing content.
5. Store embeddings and reuse them.
6. Queue background processing.
7. Batch suitable jobs.
8. Track cost by organization.
9. Set usage budgets.
10. Do not invoke LLMs when deterministic rules are enough.

---

# 37. Data Freshness

Properties are time-sensitive.

Each listing should track:

- last_seen_at
- first_seen_at
- last_scraped_at
- source_updated_at if available
- status
- stale_at/expiration logic

The system should distinguish:

```text
ACTIVE
STALE
REMOVED
SOLD
RENTED
UNKNOWN
```

Do not automatically infer SOLD merely because a listing disappeared unless there is sufficient evidence. Use states conservatively.

---

# 38. Data Quality

Create a data-quality framework.

Potential checks:
- impossible area
- impossible floor
- malformed phone
- invalid price
- missing location
- inconsistent rooms
- duplicate source ids
- stale listing
- conflicting source information

Record quality signals instead of silently corrupting data.

---

# 39. Analytics

Initial analytics:

### CRM
- leads
- contacted leads
- qualification rate
- viewing rate
- offer rate
- close rate
- sales cycle

### Agents
- leads assigned
- response time
- activities
- overdue tasks
- conversion
- deals
- revenue

### Sources
- leads by source
- conversion by source
- deal value by source
- listing volume by source

### Property market
- listings by district
- price/m²
- price changes
- new listings
- stale listings
- price reductions
- time-on-market where supportable

---

# 40. Monetization

Recommended SaaS model:

### Starter
~$49–99/month

### Agency
~$199–399/month

### Pro
$500+/month depending on seats, data and integrations

Additional usage-based billing may apply to:
- AI
- phone minutes
- WhatsApp
- data sources
- storage
- premium data feeds

These numbers are hypotheses, not fixed pricing. Validate them with the market.

---

# 41. Longer-Term Business Opportunity

Do not limit the platform to CRM.

Potential second product:

## Real Estate Market Intelligence

Sell access to a structured market-data layer:

```text
50,000 properties
12 sources
price history
duplicate resolution
market trends
new listings
price drops
listing activity
```

This transforms the business from:

> CRM software

into:

> Real Estate Data Platform

That can materially strengthen defensibility.

---

# 42. Product Defensibility

Potential moats:

1. Canonical property database
2. Historical property/price graph
3. Duplicate-resolution dataset
4. Agency workflow data
5. Client-to-property preference data
6. Matching quality
7. Call/communication intelligence
8. Operational analytics
9. Source integrations
10. Proprietary market intelligence

The goal is for the platform to improve as customers use it.

---

# 43. Recommended Development Sequence

## Phase 1 — Product Specification

Before coding:
- Product Vision
- ICP
- Personas
- User Stories
- Functional Requirements
- Non-functional Requirements
- Module map
- Data model
- Permission model
- API architecture
- Scraper architecture
- AI architecture
- Security model
- MVP scope
- Roadmap
- Testing strategy
- Deployment architecture

## Phase 2 — Database Architecture

Create:
- ERD
- table definitions
- indexes
- tenant isolation
- migrations
- audit structure
- property/listing relationships

## Phase 3 — Repository

Set up:
- GitHub
- frontend
- backend
- scraper layer
- AI layer
- infra
- tests
- docs

## Phase 4 — Development Environment

Install/configure:
- Git
- GitHub
- VS Code/Cursor or equivalent
- Python
- Node.js
- Docker
- PostgreSQL / Supabase
- Redis

## Phase 5 — Core CRM

Build:
- auth
- organization
- users
- contacts
- leads
- properties
- listings
- pipeline
- tasks
- activities

## Phase 6 — Multi-Tenancy

Implement:
- organization scoping
- RLS
- permission checks
- audit logging

## Phase 7 — First Scraper

Build only one source first.

Flow:

```text
fetch
 ->
parse
 ->
normalize
 ->
validate
 ->
persist
```

## Phase 8 — Deduplication

Build:
- deterministic matching
- fuzzy matching
- candidate review
- merge rules

## Phase 9 — AI

Add:
- extraction
- embeddings
- semantic search
- matching
- summaries

## Phase 10 — Telephony

Add:
- click-to-call
- inbound
- call history
- recordings
- transcription
- AI analysis

## Phase 11 — Dashboard

Add:
- pipeline
- lead performance
- agent performance
- property intelligence
- daily attention feed

## Phase 12 — Pilot Customer

Use 1 agency with 3–5 agents.

Observe:
- workflows
- feature usage
- search behavior
- data quality
- scraper reliability
- friction points

Build based on actual usage.

---

# 44. First Implementation Backlog

A practical first backlog:

### Foundation
- [ ] Initialize monorepo/repository
- [ ] Add CLAUDE.md
- [ ] Configure linting
- [ ] Configure formatting
- [ ] Configure type checking
- [ ] Configure tests
- [ ] Configure CI
- [ ] Configure environment management

### Database
- [ ] Create organizations migration
- [ ] Create users/memberships
- [ ] Create roles/permissions
- [ ] Create contacts
- [ ] Create leads
- [ ] Create properties
- [ ] Create listings
- [ ] Create listing sources
- [ ] Create pipelines
- [ ] Create deals
- [ ] Create tasks
- [ ] Create activities
- [ ] Create audit log
- [ ] Add tenant isolation
- [ ] Add indexes
- [ ] Add PostGIS
- [ ] Add pgvector

### Backend
- [ ] Auth middleware
- [ ] Tenant context
- [ ] Contacts API
- [ ] Leads API
- [ ] Properties API
- [ ] Listings API
- [ ] Pipeline API
- [ ] Tasks API
- [ ] Search API

### Frontend
- [ ] Login
- [ ] Organization shell
- [ ] Dashboard
- [ ] Contacts
- [ ] Leads
- [ ] Lead detail
- [ ] Properties
- [ ] Property detail
- [ ] Pipeline
- [ ] Tasks

### Scraper
- [ ] Source adapter interface
- [ ] First source adapter
- [ ] Parser
- [ ] Normalizer
- [ ] Validation
- [ ] Scraper job
- [ ] Run tracking
- [ ] Error tracking

### AI
- [ ] AI provider abstraction
- [ ] Model router
- [ ] Structured extraction
- [ ] Embedding pipeline
- [ ] Semantic search
- [ ] Matching
- [ ] Lead summary

---

# 45. Acceptance Criteria for the First Usable MVP

The first MVP should allow an agency to:

1. Create an organization.
2. Add users/agents.
3. Create and manage leads.
4. Define pipeline stages.
5. Assign leads to agents.
6. Add and manage properties.
7. Import scraped listings.
8. Search properties.
9. Detect likely duplicates.
10. Track basic listing changes.
11. Match properties to client criteria.
12. Create tasks.
13. See a simple dashboard.
14. Preserve an audit trail.
15. Prevent cross-tenant data access.

Do not call the MVP complete until these workflows are functional end-to-end.

---

# 46. AI Coding Agent Rules

When modifying the repository:

### Before coding
- Read `CLAUDE.md`.
- Read relevant docs.
- Inspect existing code.
- Identify affected modules.
- Check tests.
- Confirm conventions already used.

### During coding
- Make the smallest coherent change.
- Reuse existing abstractions.
- Do not duplicate business logic.
- Do not introduce new libraries without a concrete reason.
- Do not silently change public APIs.
- Validate all external input.

### After coding
- Run relevant tests.
- Run lint/type checks where applicable.
- Review migration impact.
- Review tenant isolation.
- Review security implications.
- Report changed files and test results.

### Forbidden behavior
- Do not expose secrets.
- Do not bypass authorization.
- Do not delete tests to make them pass.
- Do not disable security mechanisms for convenience.
- Do not make unrelated refactors.
- Do not use an LLM when deterministic logic is sufficient.
- Do not create microservices without a documented reason.

---

# 47. Decision-Making Framework

When choosing between two implementations, prefer the option that:

1. Minimizes long-term complexity.
2. Preserves modularity.
3. Keeps domain logic testable.
4. Supports multi-tenancy.
5. Preserves vendor independence.
6. Is easy for AI coding agents to understand.
7. Has strong observability.
8. Can scale without premature distributed-system complexity.

---

# 48. Architecture Evolution Rule

Start with:

> **Modular monolith + PostgreSQL + background workers**

Evolve to services only when:
- a subsystem has independent scaling requirements,
- deployment independence is genuinely useful,
- operational isolation is justified,
- or a clear team boundary exists.

Do not split by fashion.

---

# 49. Important Product Insight

The most important long-term distinction is:

> **CRM software stores agency activity. Property Intelligence understands the market.**

The combination of these two datasets creates much more value than either one alone.

The system should ultimately understand:

```text
CLIENT
   |
   +---- preferences
   |
   +---- communications
   |
   +---- activities
   |
   +---- deals
   |
   +---- property views
   |
   +---- matched properties
                 |
                 v
              MARKET
                 |
      +----------+----------+
      |          |          |
   listings   prices     changes
      |
   sources
```

This relationship graph is one of the strongest potential sources of defensibility.

---

# 50. Final Strategic Direction

Build the product in this order:

```text
CRM foundation
      ->
Property data engine
      ->
Deduplication + history
      ->
Search + matching
      ->
AI assistance
      ->
Communication intelligence
      ->
Market intelligence
      ->
Data platform
```

Do not reverse the order.

The ultimate product vision is:

> **A real-estate agency's operating system that knows the agency's clients, the agency's properties, the external market, the communication history, and the next best action — and continuously connects all of them.**
