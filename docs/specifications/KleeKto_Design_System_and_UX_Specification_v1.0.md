# KleeKto --- Design System & UX Specification v1.0

**Status:** FROZEN FOR MVP 1.0\
**Date:** 2026-09-20\
**Scope:** Web CRM and Chrome Extension user experience\
**Product direction:** Premium PropTech operating system for Georgian
real-estate agencies

## 1. Purpose

This document makes product-grade visual design and interaction quality
part of KleeKto MVP 1.0. It does not change the domain model,
authorization model, event contracts, consent boundary, publication
safety rules, or tenant isolation requirements.

KleeKto must not look or behave like a generic admin template. The
interface must feel like a focused professional operating system for
real-estate work: fast, dense, calm, predictable, keyboard-friendly, and
visually distinctive.

When this document conflicts with domain/security specifications,
domain/security invariants win. Visual design must never bypass
authorization, confirmation, consent, provenance, audit, or publication
rules.

## 2. Design principles

1.  **Action before decoration.** Every important screen exposes one
    obvious primary next action.
2.  **High information density without spreadsheet fatigue.**
    Professional users see enough context to decide without opening
    multiple pages.
3.  **Shallow navigation.** Prefer drawers, split views, contextual
    actions, command palette, and in-place inspection over deep page
    trees.
4.  **Minimal manual input.** Reuse known structured data, defaults,
    selectors, autocomplete, and one-click actions where domain rules
    permit.
5.  **Progressive disclosure.** Primary facts and actions first;
    secondary detail on demand.
6.  **Calm premium visual language.** Neutral graphite/dark surfaces
    dominate the reference expression. KleeKto Purple is a controlled
    brand/action accent, not a page background; glow is restrained and
    functional rather than decorative.
7.  **State is explicit.** Loading, saving, success, warning, error,
    empty, disabled, stale, offline, and permission-denied states are
    designed, not improvised.
8.  **Motion communicates causality.** Animation explains state
    transitions and hierarchy; it never blocks work.
9.  **Accessibility is structural.** Keyboard, focus, contrast,
    semantics, reduced motion, and readable density are MVP
    requirements.
10. **Design is token-driven.** No arbitrary component-local colors,
    radii, shadows, spacing, or typography values.

## 3. Product visual identity

### 3.1 Character

KleeKto is: - premium; - technological; - precise; - fast; -
data-rich; - calm; - professional.

KleeKto is not: - a generic Bootstrap/admin dashboard; -
neon/cyberpunk; - glassmorphism-heavy; - gradient-heavy; -
card-everything UI; - KPI-wall UI; - decorative at the expense of scan
speed.

### 3.2 Primary visual direction

The primary MVP visual reference is a **dark-first premium PropTech operating terminal**. This direction is binding for the core KleeKto workspace and refines the product character defined above.

The reference expression uses:

- a near-black / graphite application canvas;
- layered dark surfaces with subtle tonal separation;
- thin, precise borders instead of heavy shadows;
- compact, high-legibility typography;
- high information density with disciplined spacing;
- KleeKto Purple for primary actions, active navigation, focus, selection, and controlled brand emphasis;
- restrained purple/violet glow only for selected high-value brand or interaction moments;
- data visualization that is vivid enough to scan but subordinate to operational content;
- clear hierarchy created primarily through typography, spacing, borders, surface contrast, and state -- not decoration.

The intended impression is a professional real-estate operating system: technological, premium, focused, fast, and data-rich. It may borrow the visual confidence of modern analytics/operations software, but must not become a crypto dashboard, gaming interface, cyberpunk UI, or decorative analytics showcase.

The following are specifically prohibited as the dominant MVP visual language:

- generic white/light SaaS admin-template styling;
- large collections of interchangeable KPI cards;
- excessive neon, bloom, glow, or luminous borders;
- gradient-heavy backgrounds or controls;
- glassmorphism as a primary surface treatment;
- oversized decorative charts on operational screens;
- card-per-section composition where borders, rows, panes, or tables provide better information density;
- decorative effects that reduce contrast, scan speed, or perceived performance.

Dark mode is the **reference brand expression and primary visual QA baseline** for MVP 1.0. This does not remove the requirement for first-class `light` and `system` themes. Light mode must preserve the same hierarchy, density, component geometry, interaction model, and premium character rather than becoming a separate generic SaaS design.

Visual effects must remain token-driven. Any glow or gradient used in production must be represented by controlled design tokens or shared primitives and must not be introduced ad hoc at page/component level.

### 3.3 Brand accent

Canonical brand family:

``` text
KleeKto Purple 500  #7C3AED
Purple 400          #8B5CF6
Purple 600          #6D28D9
Purple 700          #5B21B6
```

Purple is used for: - primary actions; - active navigation; -
focus/selection emphasis; - brand moments; - selected data visualization
series when semantically neutral.

Purple must not replace semantic success/warning/error colors.

### 3.4 Semantic colors

Semantic roles are token names, not hardcoded component colors:

``` text
success
warning
danger
info
neutral
accent
```

Success is reserved for successful/positive state, danger for
destructive/error state, warning for attention/risk, info for neutral
informational state.

Color alone must never be the only carrier of meaning.

## 4. Theme system

MVP supports: - `dark`; - `light`; - `system`.

The dark theme is the reference visual expression for the KleeKto brand.
Light theme is a first-class theme, not an automatic inversion. User
preference is persisted. `system` follows OS preference.

### 4.1 Dark semantic tokens

``` text
bg.canvas        #0B0B10
bg.surface       #121219
bg.elevated      #181821
bg.hover         #1E1E29
border.subtle    #272733
border.strong    #373746
text.primary     #F5F5F7
text.secondary   #A7A7B4
text.muted       #747482
accent.primary   #7C3AED
accent.hover     #8B5CF6
focus.ring       #A78BFA
```

### 4.2 Light semantic tokens

``` text
bg.canvas        #F7F7FA
bg.surface       #FFFFFF
bg.elevated      #FFFFFF
bg.hover         #F1F1F6
border.subtle    #E5E5EC
border.strong    #D3D3DD
text.primary     #18181F
text.secondary   #5F5F6D
text.muted       #858594
accent.primary   #6D28D9
accent.hover     #5B21B6
focus.ring       #7C3AED
```

Implementation must expose semantic CSS variables/tokens. Components
consume semantic tokens, not raw theme values.

## 5. Typography

Use a high-legibility modern sans-serif stack with full Russian,
Georgian, and English support. The implementation must verify Georgian
glyph quality before adoption. Do not introduce a font dependency solely
for visual novelty.

Typography scale:

``` text
display     28/34  650
h1          24/30  650
h2          20/26  650
h3          16/22  600
body        14/20  400
body-strong 14/20  600
compact     13/18  400
caption     12/16  500
mono        12/18  500
```

Tabular numeric alignment is required for prices, areas, counts, dates,
and analytics where it improves scanning.

## 6. Spacing, geometry, elevation

Base spacing unit: `4px`.

Canonical spacing: `4, 8, 12, 16, 20, 24, 32, 40, 48`.

Radii:

``` text
sm  6px
md  10px
lg  14px
xl  18px
pill 999px
```

Use borders and surface contrast before shadows. Shadows are reserved
for true elevation such as menus, dialogs, command palette, and floating
drawers.

Avoid excessive rounded containers. Do not wrap every section in a card.

## 7. Application shell

Desktop is the primary professional workspace.

Persistent shell: - left navigation; - top/global action area; - global
search / Command Bar; - notifications; - user/company context; - main
workspace.

Primary navigation remains: - Today; - Opportunities; - Properties; -
Clients; - Deals; - Messenger; - Documents; - Analytics when
authorized; - Settings.

Technical engines such as Event Bus, Audit internals, Matching
internals, and Automation internals are not primary agent navigation
items.

Navigation must preserve context where possible. Opening an entity from
a list should normally use a drawer/split view rather than destroy the
user's list position and filters.

## 8. Responsive strategy

MVP web UI is optimized for desktop/laptop professional use.

Breakpoints are implementation tokens, not business logic. Required
behavior: - large desktop: full navigation + dense workspace + optional
detail pane; - laptop: compact navigation + workspace + drawer; -
tablet: reduced columns, drawers replace persistent secondary panes; -
mobile web: essential read/action flows remain usable, but feature
parity with desktop dense workflows is not required for MVP.

No critical action may become unreachable at supported widths.

## 9. Interaction model

Preferred patterns: - contextual actions; - hover/focus actions on
desktop; - entity drawer; - split view; - inline editing only where
safe; - command palette; - keyboard shortcuts; - bulk actions only when
authorization and confirmation semantics are clear; - optimistic UI only
when rollback and authoritative server state are safe.

Do not duplicate business state across screens. Server state remains
authoritative.

### 9.1 Command Bar

`Ctrl+K` / `Cmd+K` opens the global Command Bar.

It provides: - unified search; - navigation; - permitted contextual
actions; - recent entities/actions where safe.

Command Bar results must obey server-side permissions. It is not a
security boundary.

### 9.2 Keyboard

Core desktop flows must be keyboard operable: - move through lists; -
open/close drawer; - focus search; - invoke Command Bar; - activate
visible actions; - dismiss menus/dialogs; - preserve visible focus.

Shortcuts must not override standard browser/OS shortcuts unexpectedly.

## 10. Today workspace

Today is the primary agent workspace, not a KPI dashboard.

Header: - contextual greeting/date; - global search; - compact
overdue/today/upcoming summary.

Primary body is an action queue ordered by operational priority,
containing where applicable: - overdue Next Actions; - today's Next
Actions; - upcoming actions; - relevant Opportunity changes; - Matches
requiring attention; - team/collaboration requests; - compact market
changes.

Example visual rows may communicate: - time / overdue duration; -
entity; - reason; - responsible context; - one primary action; -
secondary actions on demand.

Today must answer: **What should I do next?**

Do not fill Today with vanity metrics, large decorative charts, or
unrelated KPIs.

## 11. Opportunity Feed

Opportunity Feed is a professional market terminal, not a generic card
gallery.

Default feed shows all source-owner-verified Opportunities permitted by
the frozen product contract.

Each row/card must make the following scannable without opening a full
page: - lead photo/thumbnail; - owner verification; - source; - price; -
area and key parameters; - location; - age; - views when available; -
price-change signal/history summary; - contact/team marker; - claim/work
status; - original-description signal and access; - primary actions.

Original source description remains prominent enough to expose owner
instructions such as "agents do not call".

Desktop hover/focus actions: - Contact / record contact; - Claim /
release where allowed; - Open source; - Note; - Remind / Next Action; -
Archive where allowed.

Actions are permission-aware and must map to existing authorized domain
commands. Visual convenience never creates a bypass command.

Selecting an Opportunity opens an intelligence/detail drawer or split
pane while preserving feed position, filters, and selection.

## 12. Entity workspace pattern

Property, Owner, Client, Deal, and other major entities use a consistent
workspace pattern:

**Header** - identity/title; - essential status; - responsible agent; -
primary action; - compact secondary actions.

**Summary** - key structured facts.

**Context** - related entities and relevant source/provenance.

**Timeline** - unified append-only Business History presentation.

**Action layer** - Next Action and context-sensitive commands.

Drawers must have stable URLs/deep-link semantics where practical so
navigation remains shareable and recoverable.

## 13. Property workspace

Property workspace emphasizes: - photos/media; - price and key
parameters; - location; - Owner; - responsible agent; - source
provenance; - source snapshots/history; - publication state; -
Matches; - Deals/Showings; - Next Action; - unified timeline.

Source provenance must be visually distinguishable from editable CRM
data. CRM edits must never visually imply that historical source facts
were changed.

## 14. Client workspace

Client workspace emphasizes: - contact identity; - responsible agent; -
active Requirements; - must-have vs nice-to-have criteria; -
exclusions; - Matches with explanations; - Deals/Showings; - Next
Action; - timeline.

Requirement editing should use structured controls and minimize free
text where canonical fields exist.

## 15. Deal workspace and pipeline

Pipeline is configurable and must not hardcode stage names.

Kanban requirements: - compact readable cards; - clear responsible
agent/client/property context; - Next Action visibility; - drag/drop
only when it maps to an authorized stage-change command; - failed/denied
stage changes visibly revert and explain the result; -
keyboard-accessible alternative to drag/drop.

Showing remains a record/event and is not forced into a permanent
pipeline stage.

## 16. Messenger

Messenger remains visually distinct from Notifications.

Required UX: - conversation list; - active conversation; -
unread/mention state; - replies/reactions; - attachments; - CRM cards; -
links to Property/Client/Deal; - action to create/suggest Next Action
where permitted.

CRM cards must use the same entity identity/status language as the rest
of the product.

## 17. Documents

Documents distinguish: - personal/private; - company library; -
CRM-linked documents.

Version, sharing, visibility, and archive state must be explicit.
Destructive/archive actions require the confirmation semantics defined
by domain/API specifications.

## 18. Analytics and achievements

Analytics is information-dense but visually restrained.

Requirements: - overview and approved drill-down dimensions; -
interactive charts; - period comparison; - filters; - direct resolution
from aggregate to source records where authorized; - tabular alternative
where needed for exact values.

Charts must not rely on color alone. Avoid decorative 3D charts, gauge
clutter, and excessive simultaneous series.

Achievements use the eight frozen categories and event-backed evidence.
Visual celebration may be stronger here, but rankings and awards must
remain reproducible and permission-aware.

## 19. Forms

Form rules: - labels remain visible; - required/optional state is
explicit; - validation is near the field and summarized when
necessary; - known data is prefilled where safe; - canonical values use
selectors/autocomplete instead of repeated free text; - destructive
actions are separated from primary save actions; - unsaved changes are
protected; - long forms are grouped by task, not by database schema.

Do not ask the user to re-enter information already known to the
authorized workflow.

## 20. Tables and dense data

Tables are allowed and preferred when comparison is the task.

Requirements: - sticky header for long datasets; - sortable/filterable
columns where useful; - row selection only when bulk action exists; -
clear hover/focus/selected states; - truncation with accessible
reveal; - stable numeric alignment; - saved filters/searches where
specified by the product contract; - empty state explains the next
useful action.

Do not replace naturally tabular information with decorative cards.

## 21. Feedback and system states

Every asynchronous mutation has visible feedback.

Required states: - idle; - hover/focus; - loading; - saving; -
success; - validation error; - server error; - permission denied; -
conflict/stale data; - empty; - disabled with reason where useful; -
offline/retry where applicable.

Use skeletons for content loading when layout is known. Avoid
full-screen spinners for local operations.

Toasts are transient confirmation, not the only location for critical
errors or required next steps.

## 22. Motion language

Motion is subtle, fast, and functional.

Timing tokens:

``` text
fast    120ms
normal  180ms
slow    240ms
```

Default easing uses a standard decelerating UI curve.

Permitted motion: - drawer/menu entrance; - list insertion/removal; -
state change; - success acknowledgement; - Opportunity → Property visual
transition after authoritative success; - lightweight reordering
feedback.

Do not animate large surfaces unnecessarily. Respect
`prefers-reduced-motion`; essential state changes remain understandable
without animation.

## 23. Opportunity → Property transition

After valid consent and successful authoritative conversion: - the UI
clearly acknowledges Property creation; - the Opportunity remains
historically traceable; - provenance is visible; - the transition may
use a short visual transformation; - animation occurs only after
server-confirmed success or a safely reconciled optimistic state.

The animation must never imply conversion before the domain command
succeeds.

## 24. Accessibility

MVP target: WCAG 2.2 AA for applicable web UI.

Required: - keyboard operability; - visible focus; - semantic landmarks
and controls; - labels for icon-only controls; - accessible names for
actions; - sufficient text/UI contrast; - status not communicated by
color alone; - reduced-motion support; - logical focus management for
dialogs/drawers; - error association with fields; - touch targets
appropriate for touch-capable layouts.

Accessibility failures on critical workflows are release defects.

## 25. Localization

UI supports Russian, Georgian, and English.

Rules: - layouts tolerate longer translations; - no text baked into
images; - stable codes/enums remain canonical; - date/number/currency
formatting is locale-aware; - Georgian typography is visually QA'd; -
truncation must not hide critical owner/source warnings.

## 26. Performance perception

Visual quality must not trade away operational speed.

Required: - preserve list position/filter state; - lazy-load heavy
secondary content; - avoid layout shifts; - use skeletons
intentionally; - keep primary actions responsive; - virtualize or
paginate large feeds/tables as supported by architecture; - do not load
full-resolution media when thumbnails suffice.

Performance targets from the Technical/Frozen specifications remain
authoritative.

## 27. Component architecture

Build reusable primitives and patterns rather than page-local copies.

Expected component families:

``` text
app-shell/
navigation/
command-bar/
entity-drawer/
split-view/
contextual-actions/
data-table/
feed/
filters/
forms/
timeline/
next-action/
status/
empty-state/
feedback/
charts/
crm-card/
media/
```

Domain features compose these primitives. Business configuration must
not be hardcoded into visual components.

## 28. Design token architecture

At minimum token layers cover: - color; - typography; - spacing; -
radius; - elevation; - motion; - z-index; - breakpoints; - density.

Tokens are semantic and theme-aware. Raw values are centralized. New
one-off visual values require a documented reason.

## 29. Design QA

Every implemented screen is reviewed for: - visual consistency; - token
compliance; - keyboard navigation; - focus behavior; - RU/KA/EN
overflow; - dark/light themes; - loading/empty/error/denied/conflict
states; - responsive behavior; - permission-aware actions; -
preservation of list/filter context; - unnecessary manual input; -
unnecessary navigation depth.

## 30. MVP design acceptance criteria

MVP is not design-complete unless:

1.  Design tokens are implemented and used by core UI.
2.  Dark, light, and system theme modes work.
3.  Today is action-oriented and free of KPI overload.
4.  Opportunity Feed is dense, scannable, and supports contextual
    actions.
5.  Entity drawers/split views preserve working context.
6.  Command Bar works for search/navigation and only exposes permitted
    actions.
7.  Property, Client, Deal, Messenger, Documents, Analytics, Settings
    use consistent shell/patterns.
8.  Loading, empty, error, denied, conflict, and saving states exist for
    critical flows.
9.  Critical workflows are keyboard operable.
10. Reduced-motion preference is respected.
11. RU/KA/EN layouts are QA'd.
12. Critical UI meets the accessibility target.
13. Responsive behavior does not hide critical actions.
14. No generic template styling, uncontrolled one-off tokens, arbitrary
    component-local visual systems, generic white-SaaS visual language,
    or excessive neon/glow/gradient treatment remains in the MVP core.
15. UI actions map to authorized domain commands; no design shortcut
    bypasses domain rules.
16. Source provenance, owner instructions, consent, publication
    confirmation, and responsibility states remain visually explicit.
17. Automated visual/interaction regression coverage exists for the
    highest-risk shared primitives and critical flows where practical.

## 31. Relationship to the frozen architecture

This document adds a binding UX/design implementation contract. It does
**not** add a new business domain or alter existing
domain/event/API/RBAC semantics.

Canonical dependency:

``` text
Frozen Product Contract
        ↓
Technical / Domain / API / Event / RBAC contracts
        ↓
Design System & UX contract
        ↓
Web / Extension implementation
```

If a proposed visual interaction requires a new domain command,
permission, event, or business invariant, implementation stops and the
specification stack is reviewed before that behavior is added.

**This document is the KleeKto Design System & UX Specification v1.0
frozen for MVP 1.0.**
