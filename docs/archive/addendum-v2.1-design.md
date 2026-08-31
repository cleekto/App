> **АРХИВ. Инструкцией не является.**
>
> Исходное дизайн-дополнение к промпту v2.1. Его текст **полностью** вклеен в `docs/design/DESIGN.md` — сверено построчно 2026-08-31, расхождений нет ни в одной из 758 содержательных строк. Действующий документ по интерфейсу — `docs/design/DESIGN.md`; он шире этого файла: добавлены разделы 25.1–25.3 (расширение: телефон не раскрыт, заполнение формы размещения, публикация из карточки объекта) и 32.1 (локализация и копирайт).
>
> Файл выведен из работы 2026-08-31 по правилу из `docs/analysis/risks.md`, R-22: в `docs/` не остаётся промежуточных редакций и патчей — всё вклеивается в основной документ, устаревшее уходит в архив. Сохранён как история решения, а не как источник требований.

---

# CLEEKTO — DESIGN ADDENDUM
## Design Direction & UI/UX Guidelines for Claude Code

> **Primary direction:** Modern B2B SaaS + Soft Minimalism + Data-driven Productivity UI.
>
> Cleekto should feel like a premium modern productivity tool, not a traditional enterprise CRM.

---

## 1. Design Objective

Cleekto is a real-estate CRM designed to remove operational friction from the daily workflow of real-estate agents.

The interface must optimize for:

- speed;
- clarity;
- low cognitive load;
- fast scanning;
- high information density without visual clutter;
- minimal unnecessary clicks;
- confidence;
- professional appearance;
- daily usability.

The central workflow is:

```text
Listing → Import → Owner Contact → Pipeline → Follow-up → Deal
```

The user should immediately understand:

1. Where am I?
2. What am I looking at?
3. What requires attention?
4. What can I do next?

---

## 2. Visual Personality

Cleekto should be:

- modern;
- clean;
- intelligent;
- lightweight;
- confident;
- professional;
- approachable;
- premium;
- efficient.

Avoid making it look:

- old-fashioned;
- bureaucratic;
- like a generic ERP;
- like a cheap admin template;
- like a toy;
- like a flashy crypto/AI product.

The target impression is a **modern SaaS productivity product**.

---

## 3. Design Style

Use:

### Modern B2B SaaS
A serious commercial SaaS product.

### Soft Minimalism
- generous whitespace;
- restrained borders;
- subtle shadows;
- moderate corner radius;
- clear hierarchy;
- limited visual noise.

### Data-driven UI
CRM users need to scan information quickly.

Prioritize:

- structured tables;
- compact cards;
- status indicators;
- useful metadata;
- clear metrics;
- visual hierarchy.

### Productivity UI
Actions should be obvious and fast.

Do not force users through unnecessary dialogs or navigation.

---

## 4. Design References

Use the **principles**, not the visual identity, of modern products such as:

- Linear — clarity and productivity;
- Attio — modern CRM information architecture;
- Notion — calm information presentation;
- Stripe Dashboard — professional SaaS information hierarchy.

Do not copy their branding, layouts, colors, or components.

Cleekto must have its own identity.

---

## 5. Visual Hierarchy

Use:

```text
Primary action
↓
Primary information
↓
Secondary information
↓
Metadata
↓
Optional details
```

Do not make every element visually equally important.

---

## 6. Color System

Use a neutral light foundation:

```text
Background → very light neutral
Surface → white
Primary text → dark graphite
Secondary text → muted gray
Borders → subtle neutral
Brand accent → one distinctive Cleekto accent
Success → restrained green
Warning → restrained amber
Danger → restrained red
```

Do not use many saturated colors simultaneously.

Color should communicate meaning, not decoration.

The exact Cleekto brand color is not yet fixed. Implement it through centralized design tokens such as:

```css
--color-brand-primary
```

Never scatter the brand color through components.

---

## 7. Typography

Use one modern sans-serif consistently.

Preferred candidates:

1. Geist
2. Inter
3. Manrope
4. Plus Jakarta Sans

Conceptual hierarchy:

```text
Page title     24–32px
Section title  18–22px
Card title     14–18px
Body           14–16px
Metadata       12–14px
Micro labels   11–12px
```

Adjust responsively when necessary.

Avoid excessive font weights.

---

## 8. Radius and Shadows

Use moderate rounding:

```text
8–12px
```

Avoid excessive pills.

Use pills mainly for:

- statuses;
- tags;
- compact labels.

Shadows should be subtle. Prefer spacing and borders for separation.

Do not use:

- heavy shadows;
- glowing effects;
- neumorphism.

---

## 9. Spacing

Use a consistent spacing scale:

```text
4
8
12
16
20
24
32
40
48
64
```

Do not randomly choose spacing values.

---

## 10. Application Shell

Use a stable SaaS dashboard shell:

```text
┌─────────────────────────────────────────────────────────────┐
│ CLEEKTO                 Search       Notifications    User │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│ Dashboard     │                                             │
│ Properties    │              MAIN CONTENT                   │
│ Pipeline      │                                             │
│ Tasks         │                                             │
│ Analytics     │                                             │
│ Team          │                                             │
│ Settings      │                                             │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

Sidebar should be:

- compact;
- clean;
- easy to scan;
- persistent on desktop;
- responsive on smaller screens.

Do not overload it.

---

## 11. Primary Navigation

Recommended:

```text
Dashboard
Properties
Pipeline
Tasks
Analytics
Team
Settings
```

Apply role-based visibility.

Important: UI visibility is not security. Backend authorization remains authoritative.

---

## 12. Dashboard

The dashboard is the daily command center.

It should answer:

```text
What happened today?
What needs attention?
How active is the team?
Where are our properties?
```

Recommended structure:

```text
Page Header
↓
KPI Cards
↓
Pipeline / Activity Overview
↓
Recent Activity
↓
Tasks / Follow-ups
```

Possible KPIs:

```text
New Listings
Active Properties
Owner Agreements
Follow-ups
```

Manager:

```text
Team Activity
Agent Performance
Pipeline Distribution
```

Agent:

```text
My Listings
My Follow-ups
My Tasks
My Results
```

Avoid dashboard overload.

---

## 13. Property List

The property list is a primary work screen.

Support:

- search;
- filtering;
- sorting;
- pagination;
- status;
- agent;
- team;
- source;
- price;
- address;
- date added.

Prefer a compact, information-rich table/list rather than oversized cards.

Potential columns:

```text
Photo
Property
Location
Price
Area
Owner
Status
Agent
Source
Updated
```

---

## 14. Property Cards

Real estate is visual, so use property photography.

A card should quickly communicate:

```text
[PHOTO]

Price
Address / district
Area · Rooms
Owner
Status
Agent
```

Do not display every field.

Use progressive disclosure for secondary information.

---

## 15. Property Details

Recommended structure:

```text
Header
├── Property title
├── Status
├── Agent
├── Actions
└── Source

Main
├── Gallery
├── Property information
├── Owner information
└── Description

Secondary
├── Tasks
├── Comments
└── Activity timeline
```

Primary actions:

```text
Change status
Add task
Add comment
Call / contact
Open source listing
```

Future telephony should naturally fit into this action area.

---

## 16. Kanban

Kanban is one of the most important screens.

It should feel fast and operational.

Example:

```text
NEW          TO CALL       CALLBACK       AGREED
────────────────────────────────────────────────────

┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ PHOTO   │  │ PHOTO   │  │ PHOTO   │  │ PHOTO   │
│ $120k   │  │ $95k    │  │ $180k   │  │ $210k   │
│ 72 m²   │  │ 54 m²   │  │ 91 m²   │  │ 105 m²  │
│ Vake    │  │ Saburt. │  │ Vake    │  │ Vake    │
│ Agent   │  │ Agent   │  │ Agent   │  │ Agent   │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
```

Cards should:

- be compact;
- contain useful information;
- support drag-and-drop;
- have obvious status;
- avoid excessive decoration.

Do not make cards huge.

---

## 17. Drag & Drop

During drag:

- elevate the card subtly;
- clearly indicate the target column;
- use fast transitions;
- avoid distracting animation.

After drop:

- update status;
- create an activity event;
- update UI optimistically only where safe;
- treat backend state as authoritative.

If the operation fails, restore the previous state and explain the error.

---

## 18. Status Visualization

Statuses should have restrained differentiation.

Each status may have:

```text
label
color token
icon
position
semantic type
```

Do not use random bright colors.

---

## 19. Activity Timeline

Use a calm timeline/feed:

```text
Today

● 10:42  Listing imported
          by Anna

● 11:03  Status changed
          New → To Call

● 11:17  Comment added
          "Call again after 18:00"

● 18:05  Task completed
```

Activity should not visually dominate the page.

---

## 20. Tasks

Tasks should feel lightweight.

Example:

```text
☐ Call owner — Today 18:00
☐ Verify price — Tomorrow
☑ Follow up — Completed
```

Prioritize:

- due date;
- title;
- related property;
- assignee;
- completion state.

Do not turn MVP Tasks into project management software.

---

## 21. Comments

Comments should feel conversational.

Show:

- author;
- date;
- content.

Keep metadata subtle.

---

## 22. Import Experience

Import is the signature interaction of Cleekto.

Desired sequence:

```text
Listing detected
↓
Extracting
↓
Checking duplicates
↓
Preview
↓
Add to Cleekto
↓
Success
```

Avoid unnecessary forms and steps.

---

## 23. Import Preview

Example:

```text
┌────────────────────────────────────┐
│ ✓ Listing detected                 │
│                                    │
│ [PHOTO]                            │
│                                    │
│ $120,000                           │
│ 72 m² · 3 rooms                    │
│ Vake, Tbilisi                      │
│                                    │
│ Owner: Giorgi                      │
│ +995 XXX XX XX XX                  │
│                                    │
│ ✓ No duplicate                     │
│                                    │
│ [ Add to Cleekto ]                 │
└────────────────────────────────────┘
```

Primary CTA must be obvious.

---

## 24. Duplicate Warning

Example:

```text
⚠ Possible duplicate

This listing may already exist in Cleekto.

Reason:
Owner phone number matches.

Existing property:
[PHOTO]
Vake · 72 m² · $120,000

[Open existing]
[Cancel]
[Add anyway]
```

Possible duplicate should look like a warning, not a system failure.

---

## 25. Extension UI

The Extension should feel like:

> a powerful browser tool

not:

> a miniature CRM.

Prioritize:

- one primary action;
- compact preview;
- fast feedback;
- clear success/error state.

Example:

```text
Listing detected
$120,000
72 m² · 3 rooms
Vake

✓ No duplicate

[ Add to Cleekto ]
```

After success:

```text
✓ Added to Cleekto

Open in Cleekto →
```

---

## 26. Loading States

Use meaningful states:

```text
Extracting listing...
Checking duplicates...
Saving to Cleekto...
```

Avoid generic “Loading...” when the operation is known.

Use skeletons for page-level loading.

Use concise progress indicators for short actions.

---

## 27. Empty States

Every important empty state should explain what to do next.

Example:

```text
No properties yet.

Open an announcement on ss.ge or myhome.ge
and use the Cleekto Extension to add it.

[Learn how]
```

---

## 28. Error States

Errors must be understandable.

Avoid exposing stack traces.

Example:

```text
We couldn't import this listing.

The page structure could not be recognized.

Try refreshing the listing and importing again.

[Retry]
[Report problem]
```

---

## 29. Success States

Use short confirmations:

```text
✓ Added to Cleekto
```

Avoid large celebratory animations for routine actions.

---

## 30. Microinteractions

Use restrained microinteractions for:

- hover;
- status changes;
- drag/drop;
- dropdowns;
- modals;
- toast notifications;
- successful imports.

Preferred conceptual duration:

```text
100–200ms
```

Avoid:

- bouncing;
- long transitions;
- decorative animations;
- distracting motion.

---

## 31. Responsive Design

Desktop is the primary environment because agents primarily work on computers.

Still support:

### Desktop
Full experience.

### Tablet
Adaptive layouts.

### Mobile
Useful access to:

- property details;
- tasks;
- status;
- comments;
- basic dashboard.

Do not squeeze desktop Kanban into a tiny mobile layout. Design mobile behavior intentionally.

---

## 32. Accessibility

Minimum expectations:

- keyboard navigation;
- visible focus states;
- semantic HTML;
- sufficient contrast;
- accessible buttons;
- accessible form labels;
- tooltips for icon-only controls;
- no information conveyed only through color.

---

## 33. Iconography

Use one consistent icon system.

Icons should be:

- simple;
- recognizable;
- restrained.

Do not mix icon styles.

Icon-only actions require tooltips.

---

## 34. Tables

Tables should be:

- readable;
- compact;
- sortable where useful;
- filterable;
- responsive.

Prefer subtle row separation.

Avoid excessive borders.

---

## 35. Forms

Keep forms short and logically grouped.

Structure:

```text
Label
Input
Help / error
```

Group fields:

```text
Property
Owner
CRM
```

Use progressive disclosure for rarely used fields.

---

## 36. Modals

Use modals for focused decisions:

- duplicate confirmation;
- destructive action;
- quick create;
- focused edit.

Do not use modals for entire workflows.

---

## 37. Search

For MVP, support useful property search.

Potential fields:

```text
Address
Owner
Phone
Property ID
Source ID
```

Search should be:

- fast;
- forgiving;
- keyboard accessible;
- easy to clear.

---

## 38. Filters

Useful filters:

```text
Status
Agent
Team
Source
Price
Area
Date added
```

Show active filters visibly.

Provide:

```text
Clear filters
```

---

## 39. Design Tokens

Centralize:

```text
Colors
Typography
Spacing
Radius
Shadows
Motion
Z-index
Breakpoints
```

Do not scatter arbitrary values throughout components.

---

## 40. Component System

Create reusable primitives:

```text
Button
Input
Select
Dropdown
Modal
Drawer
Toast
Tooltip
Badge
Avatar
Card
Table
Tabs
Breadcrumbs
Pagination
Skeleton
EmptyState
ErrorState
```

Product components:

```text
PropertyCard
PropertyTable
PropertyGallery
PropertyStatusBadge
PipelineColumn
PipelineCard
ActivityTimeline
TaskItem
KpiCard
DuplicateWarning
ImportPreview
```

Avoid duplicated UI logic.

---

## 41. Component Architecture

Use:

```text
Design Tokens
      ↓
UI Primitives
      ↓
Product Components
      ↓
Pages
```

Not:

```text
Each Page
↓
Custom colors
↓
Custom spacing
↓
Custom buttons
↓
Custom cards
```

Consistency is critical.

---

## 42. Dark Mode

Dark mode is not required for the first MVP if it increases scope.

However, the architecture should allow it later.

Use semantic design tokens rather than hardcoded colors.

---

## 43. Branding

Primary brand:

# CLEEKTO

Possible product architecture:

```text
Cleekto
Cleekto CRM
Cleekto Extension
Cleekto Analytics
Cleekto AI
Cleekto Phone
```

Do not introduce unrelated product names.

---

## 44. Logo Direction

Logo should be:

- simple;
- recognizable;
- modern;
- suitable for favicon/app icon;
- suitable for SaaS UI.

Possible conceptual direction:

- clean wordmark;
- minimal geometric mark;
- subtle reference to click/action.

Avoid generic house/roof icons unless strongly justified.

Avoid generic AI sparkle imagery.

Cleekto should feel technological rather than like a traditional real-estate agency.

---

## 45. Real Estate Visual Language

Communicate real estate primarily through:

- property photography;
- location;
- price;
- area;
- rooms;
- status;
- owner;
- source.

Do not fill the UI with generic house icons.

Photography should provide much of the visual richness.

---

## 46. Information Density

Target:

```text
Too sparse
→ slow scanning

Too dense
→ cognitive overload

Target
→ high signal / low noise
```

Every displayed field should justify its presence.

Use progressive disclosure for secondary information.

---

## 47. UX Priority

When design decisions conflict:

```text
1. Usability
2. Speed
3. Clarity
4. Information hierarchy
5. Consistency
6. Accessibility
7. Visual polish
```

Never sacrifice usability for visual novelty.

---

## 48. Anti-patterns

Do NOT produce:

### Generic Admin Template
A generic sidebar + cards + random charts.

### Dashboard Overload
20 KPI cards and 10 charts on one screen.

### Excessive Glassmorphism
Blur, transparency and glowing surfaces everywhere.

### AI Clichés
Purple gradients, stars and glowing “AI magic” controls.

### Excessive Pills
Everything should not be a pill.

### Huge Cards
Do not waste screen space.

### Excessive Borders
Do not put a border around every element.

### Excessive Animation
CRM is a work tool, not a marketing landing page.

### Mobile-first Distortion
Do not compromise the primary desktop workflow.

---

## 49. Performance Is UX

Prioritize:

- fast initial load;
- optimized images;
- lazy loading;
- pagination;
- efficient API requests;
- optimistic UI where appropriate;
- avoiding unnecessary re-renders.

The Extension must feel extremely fast.

A slow one-click import destroys the product's core value proposition.

---

## 50. Future Feature Compatibility

The MVP should visually accommodate future:

### Telephony

```text
Call
Call history
Call duration
Recording
Call outcome
```

### Gamification

```text
Points
Achievements
Leaderboard
Team performance
```

### AI

```text
AI summary
Lead score
Suggested next action
Automatic classification
```

Do not implement these now.

Leave clean visual and architectural extension points.

---

## 51. Role-aware UI

The hierarchy is:

```text
Company Admin
↓
Manager
↓
Team
↓
Agent
```

Admin UI should emphasize:

```text
Company overview
Teams
Users
Settings
Analytics
```

Manager:

```text
Team overview
Agents
Properties
Tasks
Analytics
```

Agent:

```text
My properties
My pipeline
My tasks
My activity
```

Use one coherent design system for all roles.

---

## 52. Onboarding

Keep onboarding lightweight:

```text
Create company
↓
Create / Invite manager
↓
Create team
↓
Invite agents
↓
Install Extension
↓
Import first listing
```

The first successful import should happen quickly.

---

## 53. First-run Experience

Example:

```text
Welcome to Cleekto

Your next listing is one click away.

1. Install the Chrome Extension
2. Open ss.ge or myhome.ge
3. Find a listing
4. Click "Add to Cleekto"

[Install Extension]
```

Do not require extensive configuration before demonstrating value.

---

## 54. Design Quality Bar

Before considering a screen complete, verify:

### Visual

- Is hierarchy obvious?
- Is spacing consistent?
- Is typography coherent?
- Is the screen visually calm?
- Is the brand recognizable?

### UX

- Is the primary action obvious?
- Can the user complete the task quickly?
- Are unnecessary steps removed?
- Are loading, empty, error and success states designed?

### Product

- Does the screen help the agent do real work?
- Does it support the CRM workflow?

### Technical

- Is the component reusable?
- Are design tokens used?
- Is responsive behavior intentional?
- Is accessibility considered?

---

## 55. Implementation Order

Recommended:

```text
1. Design tokens
        ↓
2. Typography
        ↓
3. App shell
        ↓
4. Navigation
        ↓
5. UI primitives
        ↓
6. Dashboard
        ↓
7. Property list
        ↓
8. Property details
        ↓
9. Kanban
        ↓
10. Tasks / Comments / Activity
        ↓
11. Import Preview
        ↓
12. Duplicate Warning
        ↓
13. Extension UI
        ↓
14. Responsive refinement
        ↓
15. Accessibility
        ↓
16. Visual QA
```

---

## 56. Claude Code Instructions

When implementing UI:

1. Treat this document as the design source of truth.
2. Do not generate generic dashboard templates.
3. Build a coherent design system before duplicating components.
4. Use reusable components.
5. Centralize design tokens.
6. Keep the interface visually restrained.
7. Prioritize productivity.
8. Use real-estate photography where it adds information.
9. Make Kanban and property management first-class experiences.
10. Make the Extension extremely fast and simple.
11. Do not add unnecessary decorative features.
12. Do not implement future functionality merely to make the UI look complete.
13. Leave clean extension points for future telephony, AI and gamification.
14. Test loading, empty, error and success states.
15. Check desktop and responsive breakpoints.
16. Check keyboard accessibility.
17. Perform visual QA before considering a screen complete.

---

## 57. Final Design Statement

> **Cleekto is a modern, lightweight, data-driven B2B SaaS product for real-estate professionals. It should feel fast, calm, intelligent and premium. It should help agents work faster rather than make them admire the interface.**

The design should communicate:

```text
SPEED
CLARITY
TRUST
CONTROL
EFFICIENCY
```

The core experience should feel like:

> **Find a listing → Click → Cleekto handles the boring part.**
