# kleekTo — стартовая страница по модели amoCRM

## Задача

Полностью переработать публичную стартовую страницу проекта kleekTo по **структурным и продуктовым принципам официальной страницы amoCRM**, но не копировать её фирменный стиль.

Эталон: https://www.amocrm.ru/

Важно: ориентироваться на актуальную структуру официальной страницы amoCRM. На её главной используются верхняя навигация, понятный CTA, hero с сильным коммерческим сообщением, а ниже — продуктовые возможности и визуальная демонстрация продукта. citeturn0view0turn0search2

---

# 1. Что именно взять за эталон

У amoCRM сильная сторона не столько в конкретном визуальном стиле, сколько в **product storytelling**.

Текущая официальная главная строится вокруг:

- короткого обещания результата;
- крупного headline;
- очень заметного CTA;
- визуальной демонстрации продукта;
- постепенного раскрытия функций;
- повторного CTA;
- большого количества product proof вместо длинных объяснений. citeturn0view0turn0search2

На странице amoCRM hero напрямую говорит о результате — увеличении продаж и потере клиентов — и сразу объясняет, какие каналы попадают в CRM. После этого пользователь получает путь в продукт и дополнительные product sections. citeturn0view0

### Перенять

- структуру;
- ритм;
- крупную типографику;
- силу hero;
- product-first presentation;
- повторяющиеся CTA;
- секции с одной понятной мыслью;
- визуальные доказательства возможностей.

### Не копировать

- логотип;
- цвета;
- тексты;
- иллюстрации;
- изображения;
- конкретную верстку;
- UI amoCRM;
- CSS;
- assets.

---

# 2. Новое позиционирование kleekTo

Главная идея:

## From listing to deal.

kleekTo — не просто CRM.

Это рабочее пространство для профессионалов недвижимости, которое связывает:

```text
PROPERTY → CLIENT → DEAL
```

Второй смысл:

```text
FIND → ORGANIZE → COMPARE → CONTACT → CLOSE
```

Эти две цепочки должны стать основой визуального storytelling.

---

# 3. Главный принцип

Пользователь должен понять за 3–5 секунд:

### Что это?

**Real Estate CRM / workspace**

### Для кого?

**Real estate professionals**

### Что делает?

**Помогает управлять объектами, клиентами, задачами и сделками**

### Зачем?

**Чтобы быстрее переходить от объекта к сделке**

---

# 4. Структура новой страницы

Сделать страницу по следующей структуре:

```text
HEADER

HERO
  Strong headline
  Supporting text
  CTA
  Product visual

VALUE PROPOSITION
  Properties
  Clients
  Deals
  Tasks

PRODUCT IN ACTION
  Dashboard / UI
  3 key benefits

PROPERTY INTELLIGENCE
  Price comparison
  Opportunity

PROPERTY → CLIENT → DEAL
  Workflow

HOW IT WORKS
  Find → Organize → Compare → Contact → Close

WHY kleekTo
  4 benefits

FINAL CTA

FOOTER
```

---

# 5. HEADER

Desktop:

```text
[K]leekTo

Product
Features
How it works

Sign in
EN / RU / KA
```

Не перегружать header.

Если полноценная navigation не нужна на текущем этапе:

```text
[K]leekTo                         Sign in   EN/RU/KA
```

### Brand lockup

Использовать:

```text
[K]leekTo
```

K-symbol заменяет первую букву `k`.

Не использовать:

```text
[K] kleekTo
```

---

# 6. HERO

Hero должен быть главным визуальным блоком.

Рекомендуемый headline:

# From listing to deal.

Второй допустимый вариант:

# Turn property listings into deals.

Supporting text:

> A smarter workspace for real estate professionals to manage properties, clients, tasks and deals in one place.

RU:

> Умное рабочее пространство для специалистов по недвижимости: объекты, клиенты, задачи и сделки — в одном месте.

---

# 7. Hero CTA

Основной CTA:

```text
Open workspace →
```

Если пользователь не авторизован:

```text
Sign in →
```

Второй CTA допускается только если он действительно нужен:

```text
Explore product
```

Не создавать много CTA.

---

# 8. Hero visual

Вместо stock photo использовать **сам продукт**.

Hero должен содержать крупный product preview.

Это ключевой принцип, который нужно перенять у amoCRM: пользователь должен видеть не абстрактный рекламный объект, а то, **что он получит после входа в продукт**. Официальная amoCRM системно использует product visuals в коммуникации возможностей. citeturn0search2turn0search3

---

# 9. Product preview

Создать крупный polished UI preview kleekTo.

Он должен показывать реальные сущности продукта:

```text
Dashboard

356 Leads
128 Deals
24 Tasks

Deal Pipeline

Recent Properties
```

Можно использовать реальные screenshots/components текущего приложения.

Не делать generic fake CRM.

---

# 10. K-symbol visual

Рядом или внутри hero product preview использовать крупный K-symbol.

K-symbol может быть окружён:

- property cards;
- small squares;
- price data;
- connection lines;
- KPI;
- subtle UI fragments.

Смысл:

> K соединяет объекты, клиентов и сделки.

---

# 11. Цвет

Пользователь хочет **яркую страницу**.

Основные цвета:

```css
--brand-navy: #0B1020;
--brand-purple: #7C3AED;
--brand-blue: #2563FF;
--brand-pink: #FF2D8D;
--brand-orange: #FF8A00;
--brand-teal: #00E5C2;
```

Нейтральная база:

```css
--bg-page: #F7F8FC;
--bg-surface: #FFFFFF;
--bg-soft: #F1F3FA;
--text-primary: #0B1020;
--text-secondary: #5F6678;
```

---

# 12. Градиенты

Primary:

```css
linear-gradient(135deg, #7C3AED, #2563FF)
```

Energy:

```css
linear-gradient(135deg, #2563FF, #7C3AED 45%, #FF2D8D)
```

Opportunity:

```css
linear-gradient(135deg, #FF8A00, #FF2D8D)
```

Tech:

```css
linear-gradient(135deg, #00E5C2, #2563FF)
```

Не использовать neon glow повсеместно.

---

# 13. Визуальный баланс

Целевая пропорция:

```text
60–70% light neutral
15–20% navy
10–15% purple/blue
до 5% pink/orange/teal
```

Но страница должна выглядеть **заметно ярче текущей**.

Яркость достигается через:

- gradients;
- product visual;
- CTA;
- colored accents;
- section backgrounds;
- data visualization;
- icons;
- workflow.

---

# 14. SECTION — VALUE PROPOSITION

Headline:

## Everything you need to move faster.

Четыре блока:

### Properties

> Keep every listing organized and searchable.

### Clients

> Keep contacts, requests and communication in one place.

### Deals

> Move opportunities through the pipeline.

### Tasks

> Always know what needs to happen next.

Одна карточка = одна мысль.

---

# 15. SECTION — PRODUCT IN ACTION

Headline:

## One workspace. Every property. Every next step.

Большой screenshot dashboard.

Рядом:

```text
01
See what needs attention

02
Compare properties faster

03
Move deals forward
```

Использовать реальные UI-компоненты kleekTo.

---

# 16. SECTION — PROPERTY INTELLIGENCE

Это должно быть одним из главных отличий от обычной CRM.

Headline:

## Stop browsing. Start comparing.

Показать:

```text
$118,000

72 m² · 3 rooms
Saburtalo

18% below district median

$1,638/m²
vs
$1,860/m² median
```

Opportunity accent:

- orange;
- pink.

Не использовать:

```text
AI Score 87%
Match 92%
```

Показывать понятную причину интереса к объекту.

---

# 17. SECTION — PROPERTY → CLIENT → DEAL

Создать крупный визуальный workflow:

```text
┌──────────────┐
│ PROPERTY     │
│ $185,000     │
└──────────────┘
       →
┌──────────────┐
│ CLIENT       │
│ Nino         │
└──────────────┘
       →
┌──────────────┐
│ DEAL         │
│ Negotiation  │
└──────────────┘
```

Цвет:

```text
Property → Purple
Client   → Blue
Deal     → Teal
```

---

# 18. SECTION — HOW IT WORKS

Показать пять шагов:

```text
01 Find
02 Organize
03 Compare
04 Contact
05 Close
```

Использовать horizontal progression.

Можно использовать gradient line:

```text
Purple → Blue → Pink → Orange → Teal
```

Это создаёт ощущение движения.

---

# 19. SECTION — WHY kleekTo

Headline:

## Built for the way real estate actually works.

Четыре преимущества:

### Less searching

All your properties in one workspace.

### Less guessing

Compare prices and market context.

### Less switching

Clients, tasks and deals stay connected.

### More action

Always know what to do next.

---

# 20. FINAL CTA

По модели amoCRM обязательно повторить CTA в нижней части страницы.

Headline:

## Ready to move from listings to deals?

Button:

```text
Open kleekTo →
```

Можно использовать dark navy/purple gradient section.

Это должно быть самым насыщенным блоком страницы.

---

# 21. FOOTER

Минимальный:

```text
[K]leekTo

Product
Features
Support

EN / RU / KA

© 2026 kleekTo
```

---

# 22. Типографика

Сохранить:

- Manrope;
- Noto Sans Georgian.

Hero:

```text
48–64px / 700
```

Section:

```text
32–42px / 700
```

Body:

```text
16–18px / 500
```

CTA:

```text
14–16px / 700
```

На mobile:

```text
34–40px
```

---

# 23. Cards

Использовать:

```css
8px
10px
12px
16px
```

Не делать весь сайт чрезмерно rounded.

Landing page должна быть современнее и свободнее внутреннего CRM, но сохранять технологичный характер.

---

# 24. Motion

Использовать motion только там, где он усиливает storytelling:

- K-symbol;
- product preview;
- workflow;
- CTA hover;
- section reveal;
- gradient.

Transitions:

```text
120ms
180ms
240ms
```

Не превращать страницу в анимационный ролик.

---

# 25. Mobile

Mobile структура:

```text
[K]leekTo                 EN

From listing
to deal.

A smarter workspace
for real estate professionals.

[ Open workspace → ]

[ Product preview ]

Everything you need
to move faster.

Properties
Clients
Deals
Tasks

Property → Client → Deal

How it works

Why kleekTo

Final CTA
```

Проверить:

```text
390px
430px
480px
768px
```

Не допускать horizontal overflow.

---

# 26. Login / authentication

Если текущий `/login` является точкой входа:

- сохранить authentication;
- сохранить routing;
- сохранить validation;
- сохранить localization.

Login можно реализовать:

### Вариант A

Hero + login card справа.

### Вариант B

Hero → CTA → login modal/page.

Предпочтительно использовать вариант A, если это позволяет текущая архитектура без лишнего усложнения.

---

# 27. Важный UX-принцип amoCRM

У amoCRM сильный принцип:

> продукт объясняется через результат, а не через список технических функций.

На странице amoCRM главный акцент — продажи, клиенты и потеря лидов, а уже затем объясняются CRM-функции. citeturn0view0turn0search0

Для kleekTo нужно сделать то же самое:

### Не говорить

> CRM с таблицами, фильтрами, Kanban и задачами.

### Говорить

> От объекта до сделки — в одном рабочем пространстве.

И затем показывать, как это работает.

---

# 28. Не превращать страницу в копию amoCRM

amoCRM — reference.

kleekTo должен быть:

- ярче;
- современнее;
- data-driven;
- PropTech-oriented;
- визуально энергичнее.

Главная разница:

```text
amoCRM
Sales → Lead → Deal

kleekTo
Property → Client → Deal
```

---

# 29. Responsive

Проверить:

```text
1440
1280
1024
768
480
430
390
```

Особенно:

- header;
- hero;
- product preview;
- cards;
- workflow;
- CTA;
- footer.

---

# 30. Accessibility

Проверить:

- contrast;
- focus;
- keyboard navigation;
- semantic HTML;
- labels;
- reduced motion;
- touch targets.

Цвет не должен быть единственным способом передать состояние.

---

# 31. SEO

Проверить:

Title:

```text
kleekTo — Real Estate CRM
```

Description:

```text
A smarter workspace for real estate professionals.
Manage properties, clients and deals in one place.
```

Добавить локализованные metadata для RU/KA.

---

# 32. Порядок работы Claude Code

## Phase 1 — Research

Изучить:

1. текущую стартовую страницу;
2. `globals.css`;
3. Wordmark/Brand components;
4. dashboard;
5. properties;
6. board;
7. tasks;
8. localization.

Отдельно изучить официальную amoCRM:

- header;
- hero;
- CTA;
- section rhythm;
- product screenshots;
- feature storytelling;
- repeated CTA;
- footer.

Не копировать код/assets.

---

## Phase 2 — Page architecture

Создать:

```text
Header
Hero
Value Proposition
Product in Action
Property Intelligence
Property → Client → Deal
How It Works
Why kleekTo
Final CTA
Footer
```

---

## Phase 3 — Brand

Внедрить:

```text
[K]leekTo
```

и новую яркую цветовую систему.

---

## Phase 4 — Hero

Сначала довести до идеала hero.

Он должен стать визуальным эталоном всей страницы.

---

## Phase 5 — Product storytelling

Использовать реальные UI patterns kleekTo.

Не создавать generic fake CRM.

---

## Phase 6 — Responsive

Отдельно пройти desktop / tablet / mobile.

---

## Phase 7 — QA

Проверить:

- visual consistency;
- accessibility;
- localization;
- authentication;
- responsive;
- lint;
- typecheck;
- tests.

---

# 33. Definition of Done

### Brand

- [ ] `[K]leekTo`;
- [ ] K-symbol заменяет первую `k`;
- [ ] K работает отдельно;
- [ ] четыре квадрата являются частью K;
- [ ] brand lockup одинаков во всех местах.

### Marketing

- [ ] за 3–5 секунд понятно, что такое kleekTo;
- [ ] понятно, что это для real estate professionals;
- [ ] понятны Properties / Clients / Deals;
- [ ] есть сильный CTA;
- [ ] есть product visual;
- [ ] есть повторный CTA внизу.

### Visual

- [ ] страница заметно ярче текущей;
- [ ] purple/blue — основные цвета;
- [ ] pink/orange/teal — secondary energy colors;
- [ ] gradients используются системно;
- [ ] нет crypto/neon эстетики;
- [ ] нет generic stock photography.

### UX

- [ ] каждая секция имеет одну мысль;
- [ ] CTA очевиден;
- [ ] login доступен;
- [ ] product benefits понятны;
- [ ] пользователь понимает путь Property → Client → Deal.

### Responsive

- [ ] 390px;
- [ ] 430px;
- [ ] 480px;
- [ ] 768px;
- [ ] 1024px;
- [ ] 1280px;
- [ ] 1440px.

### Technical

- [ ] authentication работает;
- [ ] routing не сломан;
- [ ] localization работает;
- [ ] нет horizontal overflow;
- [ ] lint/typecheck/tests проходят.

---

# 34. Финальный критерий

После редизайна пользователь должен открыть страницу и понять:

> **kleekTo — это современное рабочее пространство для недвижимости, которое помогает пройти путь от найденного объекта до клиента и сделки.**

Страница должна быть по силе продуктовой коммуникации сопоставима с современной amoCRM, но визуально и концептуально оставаться самостоятельным брендом kleekTo.

Главная формула:

```text
STRONG PROMISE
      ↓
PRODUCT PROOF
      ↓
FEATURE
      ↓
WORKFLOW
      ↓
RESULT
      ↓
CTA
```
