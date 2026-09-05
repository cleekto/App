# kleekTo --- Welcome / Login Page Redesign

## Задание для Claude Code

### Контекст

Нужно переработать страницу:

`/login`

Текущая страница фактически является простой формой авторизации. Задача
--- превратить её в **полноценную стартовую Welcome / Login page**,
которая одновременно:

1.  знакомит пользователя с брендом kleekTo;
2.  объясняет ценность продукта за 3--5 секунд;
3.  создаёт ощущение современного PropTech/SaaS;
4.  позволяет быстро авторизоваться;
5.  становится визуальным эталоном нового дизайна всего продукта.

**Функциональность приложения не менять.**

Это задача на visual/UX refresh страницы авторизации.

------------------------------------------------------------------------

# 1. Главная концепция

## Energetic Precision

Страница должна ощущаться:

-   современной;
-   яркой;
-   технологичной;
-   энергичной;
-   премиальной;
-   лёгкой;
-   уверенной;
-   ориентированной на действие.

Ключевая идея:

> **From listing to deal.**

kleekTo объединяет работу с:

**Property → Client → Deal**

Это должно стать визуальной метафорой страницы.

------------------------------------------------------------------------

# 2. Главная задача редизайна

Не делать просто:

``` text
Logo
Login form
```

Нужно сделать:

``` text
Brand
+
Product value proposition
+
Visual product metaphor
+
Login
```

Страница должна восприниматься как **welcome screen SaaS-продукта**, а
не как технический экран входа.

------------------------------------------------------------------------

# 3. Новый brand lockup

Использовать новую систему:

``` text
[K-SYMBOL]leekTo
```

### Важно

Геометрический K-symbol **заменяет первую букву `k`**.

Не использовать:

``` text
[K-logo] kleekTo
```

Не использовать:

``` text
[K-logo] + отдельная иконка + полный kleekTo
```

Использовать именно:

``` text
[K-logo]leekTo
```

Знак должен восприниматься как первая буква слова.

------------------------------------------------------------------------

# 4. K-symbol

Использовать существующий/утверждённый геометрический K-symbol как
основу.

В нём сохранить:

-   геометрическую K-форму;
-   направление/движение;
-   четыре небольших квадрата под K.

Квадраты должны быть частью фирменной системы.

### Маленькие квадраты

Использовать приглушённые градации фирменных цветов.

Рекомендуемые оттенки:

``` text
#A78BFA
#7C3AED
#60A5FA
#67E8F9
```

Не делать их четырьмя максимально насыщенными цветами.

Они должны восприниматься как:

-   data grid;
-   property blocks;
-   system;
-   structured information.

------------------------------------------------------------------------

# 5. Цветовая стратегия

Пользователь хочет, чтобы сайт был **заметно ярче текущей версии**.

Не ограничиваться подходом:

> white + grey + little purple.

Новая стратегия:

## Bright SaaS UI on a clean light canvas

Основная поверхность остаётся светлой, но цвет должен постоянно
присутствовать в важных interaction points.

------------------------------------------------------------------------

# 6. Brand colors

Использовать:

``` css
--brand-navy: #0B1020;
--brand-purple: #7C3AED;
--brand-blue: #2563FF;
--brand-pink: #FF2D8D;
--brand-orange: #FF8A00;
--brand-teal: #00E5C2;
```

Нейтральные:

``` css
--bg-page: #F7F8FC;
--bg-surface: #FFFFFF;
--bg-surface-soft: #F1F3FA;
--border-soft: #E4E7F0;
--text-primary: #0B1020;
--text-secondary: #5F6678;
--text-muted: #8991A4;
```

------------------------------------------------------------------------

# 7. Градиенты

### Primary

``` css
linear-gradient(135deg, #7C3AED 0%, #2563FF 100%)
```

### Energy

``` css
linear-gradient(135deg, #2563FF 0%, #7C3AED 45%, #FF2D8D 100%)
```

### Opportunity

``` css
linear-gradient(135deg, #FF8A00 0%, #FF2D8D 100%)
```

### Tech

``` css
linear-gradient(135deg, #00E5C2 0%, #2563FF 100%)
```

Использовать градиенты аккуратно.

Цель --- яркий современный SaaS, а не neon/crypto UI.

------------------------------------------------------------------------

# 8. Визуальный баланс

Цвета должны занимать заметную часть визуального языка.

Ориентир:

``` text
60–70%  light neutral
15–20%  navy/dark
10–15%  purple/blue
до 5%   pink/orange/teal
```

Но цвет должен быть хорошо заметен:

-   в brand;
-   CTA;
-   visual;
-   links;
-   selected states;
-   micro-icons;
-   product preview;
-   accents.

------------------------------------------------------------------------

# 9. Background

Сделать страницу светлой, но не плоской.

Базовый фон:

``` css
#F7F8FC
```

Добавить большие мягкие ambient gradients.

Например:

``` css
radial-gradient(
  circle at 15% 20%,
  rgba(124, 58, 237, 0.18),
  transparent 35%
)
```

и:

``` css
radial-gradient(
  circle at 80% 80%,
  rgba(37, 99, 255, 0.14),
  transparent 35%
)
```

Допустим небольшой pink/orange accent.

### Важно

Не превращать весь экран в сплошной градиент.

Background должен давать ощущение энергии, а white login card ---
ощущение порядка и надёжности.

------------------------------------------------------------------------

# 10. Desktop layout

Использовать двухколоночную композицию.

Примерная структура:

``` text
┌─────────────────────────────────────────────────────────────┐
│ [K]leekTo                                  EN  KA  RU       │
│                                                             │
│                                                             │
│  Turn property                         ┌─────────────────┐  │
│  listings into                        │                 │  │
│  deals.                               │  Welcome back   │  │
│                                      │                 │  │
│  Everything you need                 │  Email          │  │
│  to manage real estate.              │  Password       │  │
│                                      │                 │  │
│  Properties · Clients · Deals        │  [ Sign in → ] │  │
│                                      │                 │  │
│  [ K visual / product preview ]      └─────────────────┘  │
│                                                             │
│  PROPERTY → CLIENT → DEAL                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Это wireframe, а не точный pixel specification.

------------------------------------------------------------------------

# 11. Левая часть

Левая зона --- brand/product introduction.

Содержимое:

### Brand

``` text
[K]leekTo
```

### Headline

Предпочтительный вариант:

``` text
Turn property listings
into deals.
```

Можно использовать локализованные версии для RU и KA.

### Supporting copy

Например:

``` text
Everything you need to manage properties,
clients and deals in one workspace.
```

Текст должен быть коротким.

Не превращать страницу в marketing landing page.

------------------------------------------------------------------------

# 12. Product value

Добавить компактную строку/группу:

``` text
Properties · Clients · Deals
```

или:

``` text
Properties
Clients
Deals
```

Можно использовать небольшие branded icons.

------------------------------------------------------------------------

# 13. Property → Client → Deal

Создать визуальную метафору:

``` text
PROPERTY  →  CLIENT  →  DEAL
```

Это может быть:

-   три небольших карточки;
-   соединённые линии;
-   стрелка;
-   gradient progression.

Цветовая логика:

``` text
Property → purple
Client   → blue
Deal     → teal/orange
```

Не делать крупный декоративный блок.

------------------------------------------------------------------------

# 14. Главный визуальный элемент

В левой части должен присутствовать большой K-symbol.

Но не обычный статичный logo.

Сделать из него **brand visual**.

Вокруг K можно использовать:

-   геометрические линии;
-   маленькие квадраты;
-   точки;
-   property-grid;
-   небольшие UI fragments;
-   тонкие connection lines.

Визуальная идея:

> K соединяет объекты, клиентов и сделки.

------------------------------------------------------------------------

# 15. Ограничения визуального элемента

Не использовать:

-   stock photography;
-   фотографии квартир;
-   фотографии агентов;
-   3D houses;
-   crypto/Web3 graphics;
-   сложный 3D;
-   огромные neon glows.

Предпочтение:

-   vector geometry;
-   clean SaaS UI;
-   abstract data visualization;
-   subtle gradients;
-   K-symbol.

------------------------------------------------------------------------

# 16. Mini product preview

Рекомендуется добавить небольшой стилизованный preview интерфейса.

Например:

``` text
┌──────────────────────────────┐
│ kleekTo                      │
│                              │
│ 128 deals     356 leads      │
│                              │
│ Deal Pipeline                │
│ ████████░░                   │
│                              │
│ Recent activity              │
│ ● New property               │
│ ● Owner contacted            │
│ ● Deal updated               │
└──────────────────────────────┘
```

Это должен быть **визуальный preview**, а не функциональный dashboard.

Цель:

> показать пользователю, что находится внутри продукта.

Если preview перегружает композицию --- сделать его меньше или заменить
частью abstract K-visual.

------------------------------------------------------------------------

# 17. Login card

Правая часть --- premium authentication panel.

Пример:

``` text
Welcome back

Sign in to your workspace

Email
[________________________]

Password
[________________________]

[       Sign in →        ]
```

Можно добавить:

``` text
Forgot password?
```

только если такая функциональность уже существует.

Не добавлять несуществующие функции.

------------------------------------------------------------------------

# 18. Login card style

Card:

-   white;
-   400--440px max width;
-   radius около 16px;
-   subtle border;
-   мягкая shadow;
-   достаточный internal spacing.

Не использовать:

-   heavy glass;
-   strong blur;
-   huge shadow;
-   excessive gradient.

Контраст должен быть:

``` text
bright energetic background
+
calm premium white login card
```

------------------------------------------------------------------------

# 19. CTA

Primary button сделать визуально сильным.

Использовать:

``` css
linear-gradient(135deg, #7C3AED, #2563FF)
```

Текст:

``` text
Войти →
```

или локализованный эквивалент.

Hover:

-   плавное изменение;
-   можно слегка усилить gradient;
-   можно добавить очень subtle elevation.

Не использовать aggressive neon glow.

------------------------------------------------------------------------

# 20. Typography

Сохранить существующую типографическую систему:

-   Manrope;
-   Noto Sans Georgian.

Рекомендуемая hierarchy:

``` text
Headline: 42–56px / 700
Supporting: 16–18px / 500
Card title: 20–22px / 700
Body: 14–15px / 500
Labels: 12–13px / 600
CTA: 14–15px / 700
```

На небольших desktop screens headline уменьшать адаптивно.

------------------------------------------------------------------------

# 21. Logo placement

Desktop:

верхняя левая часть:

``` text
[K]leekTo
```

Language switcher:

верхняя правая часть.

Не размещать language switcher внизу формы.

------------------------------------------------------------------------

# 22. Language switcher

Существующую поддержку:

-   English;
-   Russian;
-   Georgian

сохранить.

Desktop:

``` text
EN   ქართული   Русский
```

или компактный dropdown.

Mobile --- компактный selector в header.

Не менять i18n architecture.

------------------------------------------------------------------------

# 23. Mobile

На mobile отказаться от двух колонок.

Порядок:

``` text
[K]leekTo                       EN

        K visual

Turn property
listings into deals.

Properties · Clients · Deals

┌──────────────────────┐
│ Welcome back         │
│                      │
│ Email                │
│                      │
│ Password             │
│                      │
│ [ Sign in → ]        │
└──────────────────────┘
```

Не допускать:

-   горизонтального overflow;
-   слишком маленьких полей;
-   огромного visual, вытесняющего форму;
-   чрезмерно длинной страницы.

------------------------------------------------------------------------

# 24. Breakpoints

Проверить минимум:

``` text
1440px
1280px
1024px
768px
480px
430px
390px
```

Особенно проверить:

-   logo;
-   headline;
-   visual;
-   login card;
-   language selector;
-   CTA;
-   form;
-   bottom spacing.

------------------------------------------------------------------------

# 25. Motion

Добавить subtle motion, если это не усложняет реализацию.

Рекомендуемые:

``` text
120ms
180ms
240ms
```

Можно анимировать:

-   ambient gradients;
-   K visual;
-   hover CTA;
-   property → client → deal connection;
-   mini dashboard preview.

Но motion должен быть:

-   slow;
-   subtle;
-   premium.

Не делать постоянную анимацию всего экрана.

------------------------------------------------------------------------

# 26. Accessibility

Яркость не должна ухудшить accessibility.

Проверить:

-   contrast;
-   keyboard navigation;
-   focus-visible;
-   form labels;
-   error states;
-   disabled states;
-   reduced motion.

Не передавать смысл только цветом.

------------------------------------------------------------------------

# 27. Что НЕ менять

Не менять без необходимости:

-   authentication logic;
-   API;
-   routing;
-   backend;
-   form submission;
-   validation;
-   localization infrastructure;
-   existing login functionality.

Меняется визуальная оболочка.

------------------------------------------------------------------------

# 28. Порядок реализации

## Phase 0 --- Audit

Перед изменениями:

1.  открыть текущий `/login`;
2.  изучить `apps/web/app/login/page.tsx`;
3.  изучить `Wordmark`;
4.  изучить `globals.css`;
5.  найти текущий logo/mark;
6.  определить существующие UI components;
7.  определить существующие locale strings;
8.  проверить текущие breakpoints.

Ничего не менять.

------------------------------------------------------------------------

## Phase 1 --- Brand

Создать/обновить централизованный компонент:

``` text
BrandMark
BrandLockup
Wordmark
```

Главная композиция:

``` text
[K]leekTo
```

Проверить light/dark variants.

------------------------------------------------------------------------

## Phase 2 --- Page structure

Создать новую композицию:

``` text
Header
Left brand/product area
K visual
Property → Client → Deal
Login card
```

------------------------------------------------------------------------

## Phase 3 --- Visual system

Подключить:

-   brand colors;
-   gradients;
-   background ambient effects;
-   typography;
-   shadows;
-   radius;
-   spacing.

------------------------------------------------------------------------

## Phase 4 --- Login card

Обновить:

-   card;
-   inputs;
-   button;
-   states;
-   focus;
-   errors.

------------------------------------------------------------------------

## Phase 5 --- Responsive

Сделать полноценную mobile composition.

------------------------------------------------------------------------

## Phase 6 --- Motion

Добавлять только после того, как статический дизайн полностью работает.

------------------------------------------------------------------------

## Phase 7 --- QA

Проверить:

-   visual consistency;
-   accessibility;
-   responsive;
-   localization;
-   authentication.

------------------------------------------------------------------------

# 29. Definition of Done

Работа завершена только если:

### Brand

-   [ ] используется `[K]leekTo`;
-   [ ] K-symbol заменяет первую `k`;
-   [ ] K-symbol работает отдельно;
-   [ ] маленькие квадраты являются частью K-symbol;
-   [ ] wordmark выглядит единообразно.

### Visual

-   [ ] страница заметно ярче текущей;
-   [ ] purple/blue являются основными акцентами;
-   [ ] pink/orange/teal используются как secondary energy colors;
-   [ ] background имеет subtle ambient color;
-   [ ] нет crypto/neon эстетики;
-   [ ] нет stock photography;
-   [ ] визуал выглядит как современный PropTech SaaS.

### UX

-   [ ] пользователь понимает продукт за 3--5 секунд;
-   [ ] понятно, что kleekTo работает с properties, clients и deals;
-   [ ] login action очевиден;
-   [ ] форма не потеряна среди графики.

### Responsive

-   [ ] 390px работает;
-   [ ] 430px работает;
-   [ ] 480px работает;
-   [ ] 768px работает;
-   [ ] 1024px работает;
-   [ ] 1280px работает;
-   [ ] 1440px работает;
-   [ ] нет horizontal overflow.

### Accessibility

-   [ ] keyboard navigation;
-   [ ] focus-visible;
-   [ ] contrast;
-   [ ] semantic labels;
-   [ ] reduced motion.

### Functionality

-   [ ] login работает как раньше;
-   [ ] validation работает;
-   [ ] locale switcher работает;
-   [ ] routing не изменён без необходимости.

------------------------------------------------------------------------

# 30. Финальное ощущение

После реализации пользователь должен подумать:

> **"Это современный технологичный инструмент для профессионалов
> недвижимости."**

а не:

> **"Это обычная CRM с красивым логином."**

Главная визуальная формула:

``` text
LIGHT CANVAS
+
NAVY STRUCTURE
+
PURPLE / BLUE ENERGY
+
SMALL PINK / ORANGE / TEAL SIGNALS
+
GEOMETRIC K
+
CLEAR PRODUCT MESSAGE
+
PREMIUM LOGIN CARD
```

Ключевой брендовый образ:

``` text
[K]leekTo

PROPERTY
    ↓
CLIENT
    ↓
DEAL
```

------------------------------------------------------------------------

# 31. После реализации

Claude Code должен предоставить:

1.  список изменённых файлов;
2.  список новых/изменённых компонентов;
3.  список новых design tokens;
4.  описание новой структуры `/login`;
5.  результаты responsive QA;
6.  результаты accessibility QA;
7.  результаты lint/typecheck/tests;
8.  список оставшихся известных проблем.

**Не считать задачу выполненной только потому, что приложение
компилируется.**

Критерий завершения --- цельная, яркая, современная и профессиональная
стартовая страница kleekTo.
