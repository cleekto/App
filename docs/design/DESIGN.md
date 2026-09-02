# KLEEKTO — DESIGN ADDENDUM
## Design Direction & UI/UX Guidelines for Claude Code

> **Primary direction:** Modern B2B SaaS + Soft Minimalism + Data-driven Productivity UI.
>
> kleekTo should feel like a premium modern productivity tool, not a traditional enterprise CRM.
>
> **Status:** design source of truth. Lives at `docs/design/DESIGN.md` and is referenced from `docs/MASTER_PROMPT.md` §8. Where this document and the master prompt disagree on behaviour rather than appearance, the master prompt wins — it carries the hard rules (tenant isolation, revealed-phone rule, "the human publishes" rule).
>
> Sections 25.1–25.3 and 32.1 were added together with prompt v2.1 (listing publication).
>
> Sections 12.1 (deal feed), 25.4 (call outcome) and 35.1 (migration wizard) were added with prompt v2.2. Section 32.1 was rewritten on 2026-08-31, when the owner made three languages — Georgian, English, Russian — a hard requirement.

---

## 1. Design Objective

kleekTo is a real-estate CRM designed to remove operational friction from the daily workflow of real-estate agents.

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

kleekTo should be:

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

kleekTo must have its own identity.

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

**[CONFIRMED] Superseded again 2026-09-02 — official kleekTo brand palette.**
The owner supplied `docs/design/concept.png`: a finished brand concept (logo,
wordmark, six-color palette, Manrope typography) and asked for it to become
the basis of the whole product, logo included. This replaces the interim
"яркий и уверенный" indigo pass below — that pass was itself a same-day
improvisation before a real brand existed; now one does.

Six official colors from the brandbook: `#0B1020` dark navy (base),
`#7C3AED` purple (primary — the same purple as the wordmark's "T"), `#2563FF`
blue, `#FF2D8D` pink, `#FF8A00` orange, `#00E5C2` teal. What shipped
(`apps/web/app/globals.css`): `#7C3AED` as `--color-brand` unchanged (it
already has enough contrast on white for both fills and text); pink/orange/
teal darkened for the semantic trio (danger/warning/success) since the
brandbook tones are calibrated for accents on a dark mockup background, not
body text on white — same hue, adjusted lightness, not a different color.
Blue is reserved, unused so far. The dark navy `#0B1020` is now both
`--color-text-primary` *and* `--color-sidebar-bg` — the same one color doing
double duty as ordinary text and as the sidebar surface, rather than two
different dark tones that happen to both be "dark."

The sidebar-stays-dark, main-content-stays-light split from the previous pass
is unchanged and still the reasoning: the sidebar is seen in peripheral vision
all day but not *read* for hours the way the content area is, so it can
afford to be the one saturated large surface.

Manrope (with Noto Sans Georgian for Mkhedruli, same pairing pattern as
before — Manrope's Google Fonts subsets are cyrillic, cyrillic-ext, greek,
latin, latin-ext, vietnamese; no Georgian) replaces Inter as the typeface,
per §7 below and the brandbook's own type choice.

The logo mark and "kleekTo" wordmark now appear in the app sidebar and the
login page (`apps/web/public/brand/mark.png`, `apps/web/app/_ui/wordmark.tsx`),
plus the browser favicon and the Chrome extension icon set — everywhere a
mark was previously a lettered placeholder square.

The "яркий и уверенный" text below is same-day history, one revision back —
kept for the record of *why* a dark sidebar exists at all, not as the current
palette. The neutral brief below that is the original starting point, two
revisions back.

**[CONFIRMED] Superseded 2026-09-02 by owner decision — "яркий и уверенный".** The
owner used the product for the first time and found the neutral palette below
dull for an interface people sit in front of all day: color should help
alertness, not just avoid annoying. Three options were mocked up on a real
screenshot (sidebar, cards, statuses, buttons) and shown before implementation;
the boldest was chosen.

What actually shipped (`apps/web/app/globals.css`): a vivid indigo brand
(`--color-brand`) replacing the muted blue-violet, more saturated semantic
colors, and — the one departure from "neutral everywhere" — a dark indigo
**sidebar** (`--color-sidebar-*` tokens) with light text, distinct from the
still-light, still-calm main content area. The reasoning: the sidebar is seen
in peripheral vision all day but not *read* for hours the way the content
area is, so it can afford to be the one saturated large surface. The rule
below ("neutral light foundation", "do not use many saturated colors
simultaneously") still governs the *main content area* — it was never meant
to forbid the owner's product from having any personality at all, and the
sidebar exception is deliberate and scoped, not a quiet abandonment of the
principle.

The text below is the original brief and stays as historical context for why
a neutral baseline was the starting point.

Use a neutral light foundation:

```text
Background → very light neutral
Surface → white
Primary text → dark graphite
Secondary text → muted gray
Borders → subtle neutral
Brand accent → one distinctive kleekTo accent
Success → restrained green
Warning → restrained amber
Danger → restrained red
```

Do not use many saturated colors simultaneously.

Color should communicate meaning, not decoration.

**[CONFIRMED] Fixed 2026-09-02: `#7C3AED`** (`docs/design/concept.png`) — see the
note at the top of this section. Implement it through centralized design
tokens such as:

```css
--color-brand-primary
```

Never scatter the brand color through components.

---

## 7. Typography

**[CONFIRMED] Chosen 2026-09-02: Manrope**, paired with Noto Sans Georgian for
Mkhedruli (Manrope itself has no Georgian coverage — verified against its
Google Fonts subsets, not assumed). Part of the brand concept,
`docs/design/concept.png`; see §6.

Use one modern sans-serif consistently.

Preferred candidates:

1. Geist
2. Inter
3. Manrope
4. Plus Jakarta Sans

**Filter this list by Georgian coverage before choosing** — see §32.1. Georgian is a launch language, and a face without Mkhedruli is not a candidate no matter how well it reads in Latin.

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
│ KLEEKTO                 Search       Notifications    User │
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

## 12.1 Deal Feed — "Profitable Listings"

The agent's first screen of the day. It sits in primary navigation **above** the property list: the feed is where work starts, the list is where work accumulates.

It answers one question:

```text
Who should I call first this morning?
```

The feed is a **company-wide resource** — every team, every agent sees the same listings. It is not a personal digest.

### Card

```text
┌────────────────────────────────────────────────────┐
│ 12% below similar in Saburtalo            8 min ago│
│                                                    │
│ $118,000 · 72 m² · 3 rooms                         │
│ Saburtalo · floor 5 of 12                          │
│                                                    │
│ Owner listing · median here $1,860/m² (34 listings)│
│                                                    │
│ ● Nino opened this 3 min ago                       │
│                                                    │
│ [ Open listing ]                              [ ⋯ ]│
└────────────────────────────────────────────────────┘
```

**The headline is the reason, not a score.** "12% below similar in Saburtalo" is a sentence an agent can act on. `0.87` is not. A ranking that cannot explain itself gets ignored within a week, and then the feed is dead weight.

### Never show a number without its sample

The sample size sits next to every percentage, always. It is not a detail for a tooltip — it is what makes the percentage meaningful.

When the bucket is too thin, the feed says so plainly and shows **no percentage at all**:

```text
┌────────────────────────────────────────────────────┐
│ Not enough data for this district         2 h ago  │
│                                                    │
│ $74,000 · 48 m² · 2 rooms                          │
│ Digomi · floor 3 of 9                              │
│                                                    │
│ Owner listing · only 6 comparable listings         │
└────────────────────────────────────────────────────┘
```

An invented percentage costs more than a missing one. The agent checks two of them, finds nonsense, and stops trusting the whole feed.

### Suspicious listings are marked, not hidden

An unusually large discount is more often a data error or bait than a find. Such cards are pushed out of the top and carry a distinct, calm warning:

```text
⚠ 47% below similar — unusual, check before calling
```

Amber, not red. Nothing has failed; the number is simply not to be trusted at face value.

### Ambient signals

Below the price line, at metadata size:

```text
Owner listing            — not an agency
Listed 8 minutes ago     — freshness
Listed 34 days ago       — sitting, motivated owner
Price dropped twice      — motivated owner
```

The last two only appear once the index has history. They are the strongest signals in the product and cannot be copied by a competitor — but they arrive with time, not on day one.

### Soft lock

```text
● Nino opened this 3 min ago
```

An ambient marker in muted text with a small brand-colored dot. It **never disables the card** and never blocks the action. Two agents from different teams may legitimately compete for the same owner; the marker exists so the second one decides knowingly, not so the system decides for them.

It fades after 30 minutes.

### Filters

Filters are a **view convenience, not a permission boundary**. The data beneath the filter is the same data everyone else has.

```text
[ District ▾ ] [ Rooms ▾ ] [ Price ▾ ] [ Sale / Rent ]
```

Never implement a feed filter as a visibility restriction. Clearing a filter must never reveal something that was being withheld — if it does, the filter was doing the wrong job.

### Removal from the feed

A listing leaves the feed for the entire company the moment any agent marks **Agreed**. The lead is worked; a second call from the same agency helps nobody.

Other outcomes narrow visibility more gently — see 25.4.

### Empty state

```text
Nothing new in your area today.

kleekTo builds its picture of the market from listings
your team opens. The more you browse, the better this
gets.

[ Browse ss.ge ]  [ Browse myhome.ge ]
```

Honest, not apologetic. On a new account the feed genuinely has little to show, and pretending otherwise is worse than explaining why.

### Rules

- One card, one reason, in plain language.
- A percentage never appears without its sample size.
- Low confidence is stated, never smoothed over.
- The card is a starting point, not a decision: opening the listing is the primary action.
- No infinite scroll of marginal matches. A short honest feed beats a long padded one.
- No score, no stars, no "match quality" bars anywhere in this screen.

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

Import is the signature interaction of kleekTo.

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
Add to kleekTo
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
│ [ Add to kleekTo ]                 │
└────────────────────────────────────┘
```

Primary CTA must be obvious.

---

## 24. Duplicate Warning

Example:

```text
⚠ Possible duplicate

This listing may already exist in kleekTo.

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

[ Add to kleekTo ]
```

After success:

```text
✓ Added to kleekTo

Open in kleekTo →
```

---

## 25.1 Extension — Phone Not Revealed

On ss.ge and myhome.ge the owner phone is hidden until the agent reveals it. kleekTo never reveals it for them, and never imports a listing without it.

This is a blocking state, not an error state. Nothing failed — a step is simply missing.

```text
Reveal the phone number on the page,
then press "Add to kleekTo" again.

[ Retry ]
```

Rules:

- Calm, instructional tone. No red, no error iconography, no "failed".
- One obvious next action.
- The preview stays visible if it was already rendered — nothing the agent did is lost.

---

## 25.2 Extension — Fill Listing Form

The reverse flow: the agent is on the "new listing" form of a portal and wants kleekTo to type the data for them.

```text
Fill from kleekTo
Vake · 72 m² · 3 rooms
Publishing as: Giorgi · +995 XXX XX XX XX

[ Fill form ]
```

After filling:

```text
✓ 14 fields filled

Left for you:
· District
· Photos
· Map location

[ Clear form ]
```

Rules:

- One primary action. Filling is a single click, with no dialog and no profile picker in the way.
- The list of remaining fields is compact and inline — never a modal, never blocking. The agent is looking at the form, not at us.
- The publishing profile in use is always visible. It is the agency's public face.
- "Clear form" stays available until the agent leaves the page.
- kleekTo never presses the portal's publish button. There is no UI element in kleekTo that could be mistaken for one.

---

## 25.3 Property Publishing in CRM

In the property details screen:

- A "Publish" action next to the primary property actions.
- A publications block: portal, date, who published, link to the live listing, current state.
- `publicDescription` and the publication price are edited here, separately from the property's own description and price.

States a publication can be in:

```text
Draft        — prepared, not filled yet
Filled       — form filled, waiting for the agent to publish
Published    — confirmed live, with a link
Expired      — no longer live
```

If the property already has a listing on the chosen portal — including the listing it was imported from — warn before filling:

```text
⚠ This property already has a listing on ss.ge

[Open existing]
[Publish anyway]
[Cancel]
```

Publishing profiles are managed in Settings, alongside team and company data.

---

## 25.4 Extension — Call Outcome

The moment the whole product is built around. The agent has revealed the phone, called the owner, and is recording what happened.

**Only one of these outcomes creates a property.** The other three mark the listing and create nothing.

### Menu

Reachable from the right-click menu on the listing page and from the extension popup — the same four actions, one shared logic.

```text
Call result
Vake · 72 m² · $120,000
Giorgi · +995 XXX XX XX XX

[ ✓ Agreed — add to kleekTo ]

  Declined / do not call
  No answer
  Call back in…

  Hide from feed
```

**One primary, three plain.** "Agreed" carries the brand accent and the full button treatment; the others are quiet text rows. This is not a ranking of importance — all four are recorded — it is a reflection of consequence. Only the first one writes an owner's contact into the agency database.

The copy says what happens: **"add to kleekTo"**, not "Agreed". The agent should never be surprised by what a click did.

Nothing is pre-selected. The menu opens with no default.

### After "Agreed"

```text
✓ Added to kleekTo
In base · assigned to you

Open in kleekTo →
```

The new status is named out loud. "In base" is the first funnel stage, and the agent should recognize it later on the board.

### After "Declined"

```text
Marked as declined
Your team won't see this listing in the feed.
Other teams still will.

☐ Owner asked not to be called again
   Applies to the whole agency
```

The checkbox appears **after** the action, not before it. Two reasons:

1. It is rare. Putting it in the path of every decline slows the common case for the sake of the exception.
2. It means something different. A decline is the result of one team's negotiation; "do not call again" is the owner's request, and it silences the listing for every team in the agency. Different scope, different weight, different moment.

The line "Other teams still will" is deliberate. Agents should understand that a decline is not exclusive — competition between teams is allowed, and hiding that fact would make the behavior look like a bug.

### After "No answer"

```text
Marked — no answer
Back in the feed in about a day.
```

### "Call back in…"

```text
Call back in

[ Tomorrow ]  [ 3 days ]  [ A week ]  [ Pick a date ]
```

Presets first, calendar last. The overwhelmingly common cases are a day and a few days.

The reminder returns as a **personal follow-up to the agent who set it**, on the chosen date — not back into the shared feed. They made the promise; they get the reminder.

### "Hide from feed"

For listings the agent filters out without calling: an agency posting, an obviously unsuitable property. Records nothing but the fact of hiding, and only for the person who hid it.

Without it the agent has two bad options — call pointlessly or live with clutter.

### Rules

- The agent reaches this menu only after revealing the phone. 25.1 guards the path, and that makes the revealed-phone rule enforce itself.
- Three of the four outcomes are reversible and get no confirmation dialog. Confirming a reversible action is friction without value.
- "Agreed" is not reversible from here — it created a record. Say so in the success state instead of asking beforehand.
- Two clicks total: open the menu, choose the outcome. Anything that adds a third needs justification.
- The extension never marks an outcome on its own, and never infers one from behavior.

### One thing this screen must not do

**No counters, no streaks, no daily goals, no "2 more agreements today".**

Agreements per agent per day is the product's headline metric, and putting it in front of the agent at the exact moment they choose an outcome is an invitation to press "Agreed" without calling. The metric would keep rising and stop meaning anything.

Performance figures belong on the dashboard, after the fact. Not in the menu where the number is made.

---

## 26. Loading States

Use meaningful states:

```text
Extracting listing...
Checking duplicates...
Saving to kleekTo...
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
and use the kleekTo Extension to add it.

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
✓ Added to kleekTo
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

## 32.1 Localization & Copy

**Three languages, equal in standing: Georgian (`ka`), English (`en`), Russian (`ru`).** Owner requirement, 2026-08-31. None of them is a "later" language, and none is the one the others are translated from as an afterthought.

All UI strings live in a dictionary from day one. No user-visible text is hardcoded inside a component, ever.

### Layout consequences

Georgian and Russian run noticeably longer than English. A button laid out to fit "Add" breaks in both.

```text
en   Add to kleekTo
ru   Добавить в kleekTo
ka   დამატება kleekTo-ში
```

- Never size a control to its English label. Buttons, tabs, table headers and badges size to content with sensible minimums.
- Never truncate a primary action. If it does not fit, the layout is wrong, not the translation.
- Test every screen in the longest language, not the shortest.

### Georgian specifics

- **Mkhedruli has no capital letters.** `text-transform: uppercase` is forbidden anywhere in the interface. It does nothing in Georgian and produces a mismatch between languages on the same screen. Use size, weight and color for emphasis instead.
- **The typeface must cover Georgian.** This narrows the candidate list in §7, and coverage must be verified rather than assumed — several popular geometric sans faces have no Georgian at all. Pairing a Latin/Cyrillic face with a dedicated Georgian one such as Noto Sans Georgian is acceptable, provided x-height and weight are matched so mixed-script lines do not look assembled from two fonts.
- Georgian, Latin and Cyrillic appear **on the same screen constantly** — an owner's name in Georgian next to a price in Latin digits. Line height and baseline must hold across all three.

### Rules

- Three locale files exist from the first commit, including an incomplete Georgian one. A missing translation shows as a visible gap, never silently falls back to another language — a silent fallback means nobody ever finds out what is untranslated.
- English examples throughout this document illustrate tone and density, not final copy.
- Dates, numbers, currency and phone formats go through shared formatters, never string concatenation in components.
- Copy tone: short, concrete, no exclamation marks, no cheerfulness in error states. Say what happened and what to do next.
- Pipeline status names are company data, not UI strings — they are edited by the agency in its own language and never translated by us.

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

## 35.1 Migration Wizard

Moving an agency's existing database out of a spreadsheet. This is objection number one in every sales conversation, and the screen that answers it.

Real agency files are not clean: column headers in Georgian, Russian and English at once, merged cells, several sheets, lari and dollars in one column, phone numbers in five formats, and half of what matters buried in a free-text notes column.

**The wizard adapts to the file. The agency is never asked to reformat anything.**

### Four steps, always visible

```text
①  Upload  →  ②  Map columns  →  ③  Preview  →  ④  Import
```

The stepper stays on screen throughout. Migration is the one flow where the user needs to know how much is left before anything irreversible happens.

### Step 1 — Upload

```text
Drop your file here
.xlsx or .csv · any structure

We'll read it as it is. No template needed.
```

If the file has several sheets, the sheet picker appears here, showing row counts.

### Step 2 — Map columns

```text
Sheet "Объекты" · 1,847 rows · 14 columns

Column in file              kleekTo field
──────────────────────────────────────────────
ფართობი / Площадь           [ Area              ▾ ]
Цена $                      [ Price             ▾ ]
тел                         [ Owner phone       ▾ ]
Адрес                       [ Address           ▾ ]
Комн.                       [ Rooms             ▾ ]
Комментарий                 [ Don't import      ▾ ]
──────────────────────────────────────────────

☐ Save this mapping for future files

                          [ Continue → ]
```

Rules:

- Every column is listed, including the ones being skipped. A silently ignored column is a column someone will later swear was imported.
- "Don't import" is a normal choice, not a failure — it is the default for anything unrecognized.
- kleekTo proposes a mapping where it can and never hides that the proposal is a guess.
- The saved mapping belongs to the agency. Their second file lands on a ready scheme.

### Step 3 — Preview

Nothing has been written to the database at this point, and the screen says so.

```text
Preview — nothing imported yet

Showing 20 of 1,847 rows

⚠ 3 duplicate groups inside this file
⚠ 41 rows will be rejected

┌──────┬─────────┬───────┬───────┬────────────────┐
│ Row  │ Address │ Area  │ Price │ Owner phone    │
├──────┼─────────┼───────┼───────┼────────────────┤
│ 12   │ Vake…   │ 72    │ $120k │ +995 XXX XX XX │
│ 13   │ Vake…   │ 72    │ $120k │ +995 XXX XX XX │ ← duplicate of 12
│ 14   │ Digomi… │ —     │ $84k  │ — no phone     │ ← will be rejected
└──────┴─────────┴───────┴───────┴────────────────┘

                    [ ← Back ]   [ Import 1,806 rows ]
```

Rules:

- Duplicates **inside the file itself** are shown as groups, before writing. They are the most common defect in a real agency spreadsheet and the one nobody expects.
- Every rejection carries a reason in plain language: "no phone number", "area is not a number", "empty row". Never a code, never a silent skip.
- The primary button states the actual number. "Import" is vague; "Import 1,806 rows" is a decision.

### Step 4 — Result

```text
✓ 1,806 properties imported
   41 rows rejected — [ download report ]

All of them are marked "Agency archive".

[ Open properties ]        [ Undo entire import ]
```

**Undo is one action and reverses everything.** Not "delete the imported ones you can find" — the whole batch, at once. Without it, an agency that spots a mapping mistake on row 400 has no way back, and the first migration becomes the last thing they trust us with.

### Imported properties look different, everywhere

Every migrated property carries an `Agency archive` badge on the card, in the list and in the details screen. It is a quiet neutral tag, not a warning.

```text
┌────────────────────────────┐
│ Vake · 72 m² · $120,000    │
│ Agency archive             │
└────────────────────────────┘
```

A separate **"Agency archive"** filter sits in the property list.

This exists because of what migration actually brings in: thousands of records of uncertain freshness — old prices, apartments long since sold, phone numbers that stopped working two years ago. The database looks full and is only partly workable.

**A migrated property must never look like one that had a conversation behind it.** Origin is visible for exactly this reason, and it is the same badge that distinguishes a manually created property from one that came through an owner's agreement.

### Rules

- Nothing is written before step 3 has been seen.
- The file is never rejected for its structure. Only individual rows are, and always with a reason.
- Phone and currency normalization is the same code that handles imports — the agent must not get one result from the extension and another from a spreadsheet.
- Undo stays available while it is still meaningful, and its absence later is stated rather than discovered.
- This wizard is an admin screen. It sits in Settings, not in the agent's daily path.

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

# KLEEKTO

Possible product architecture:

```text
kleekTo
kleekTo CRM
kleekTo Extension
kleekTo Analytics
kleekTo AI
kleekTo Phone
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

kleekTo should feel technological rather than like a traditional real-estate agency.

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

One constraint to design around: in the MVP, photos are stored as URLs pointing at the source portal, not copied into kleekTo. Those URLs can break — the listing is removed, the portal blocks hotlinking, the path changes. Every surface that shows a photo needs a deliberate fallback: a neutral placeholder carrying the property type and address, never a broken-image icon and never a collapsed layout. Card and gallery heights must not depend on the image loading.

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
Welcome to kleekTo

Your next listing is one click away.

1. Install the Chrome Extension
2. Open ss.ge or myhome.ge
3. Find a listing
4. Click "Add to kleekTo"

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

> **kleekTo is a modern, lightweight, data-driven B2B SaaS product for real-estate professionals. It should feel fast, calm, intelligent and premium. It should help agents work faster rather than make them admire the interface.**

The design should communicate:

```text
SPEED
CLARITY
TRUST
CONTROL
EFFICIENCY
```

The core experience should feel like:

> **Find a listing → Click → kleekTo handles the boring part.**
