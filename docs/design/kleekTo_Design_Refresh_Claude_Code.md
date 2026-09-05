# kleekTo --- Design Refresh 2.0

## Пошаговая инструкция для Claude Code

> **Цель:** обновить визуальный язык web-приложения kleekTo, сохранив
> существующую UX-архитектуру и функциональность, но сделать продукт
> заметно более ярким, современным, энергичным и технологичным.
>
> **Ключевой принцип:** это не полный редизайн UX и не переписывание
> приложения. Это системный **Brand/UI Refresh 2.0**.
>
> **Важно:** ничего не удалять и не ломать из существующей
> функциональности без необходимости. Перед изменениями изучить текущую
> реализацию и использовать существующую дизайн-систему как основу.

------------------------------------------------------------------------

# 1. Главная задача

Привести интерфейс к новой визуальной концепции:

## Energetic Precision

kleekTo должен ощущаться как:

-   быстрый;
-   современный;
-   технологичный;
-   энергичный;
-   уверенный;
-   визуально дорогой;
-   простой для ежедневной работы;
-   ориентированный на действие и результат.

### Не нужно

-   делать интерфейс похожим на корпоративный ERP;
-   превращать его в кислотный neon UI;
-   перегружать каждую карточку градиентами;
-   использовать crypto/Web3 эстетику;
-   делать чрезмерный glassmorphism;
-   добавлять декоративные элементы без UX-функции.

### Нужно

-   значительно увеличить визуальную выразительность;
-   сделать цвет частью UX;
-   использовать яркие акценты системно;
-   сделать бренд узнаваемым уже по одному экрану;
-   сохранить высокую читаемость данных;
-   создать ощущение современного PropTech/SaaS продукта.

------------------------------------------------------------------------

# 2. Основное изменение бренда

## Было

``` text
[logo] kleekTo
```

## Должно стать

``` text
[LOGO]leekTo
```

Геометрический знак бренда **заменяет первую букву `k`**.

Итоговая визуальная конструкция:

``` text
[K-SYMBOL]leekTo
```

### Правила

-   знак визуально должен восприниматься как первая буква слова;
-   между знаком и `leekTo` не делать большого пробела;
-   `leek` --- основной dark/navy;
-   `To` --- цветовой акцент;
-   знак может использовать purple/blue gradient;
-   знак должен существовать отдельно как app icon/favicon/extension
    icon.

------------------------------------------------------------------------

# 3. Цветовая стратегия

Пользователь хочет **более яркий сайт в целом**.

Поэтому не использовать старую стратегию «почти всё нейтральное +
немного purple».

Новая стратегия:

> **Bright SaaS UI on a clean light canvas**

Основной интерфейс остаётся светлым, но цвет должен присутствовать
постоянно через:

-   navigation;
-   buttons;
-   badges;
-   status;
-   KPI;
-   charts;
-   highlights;
-   icons;
-   selected states;
-   links;
-   empty states;
-   data visualization;
-   subtle gradients.

------------------------------------------------------------------------

# 4. Цветовые токены

Использовать следующие brand colors как основу:

``` css
--brand-navy: #0B1020;
--brand-purple: #7C3AED;
--brand-blue: #2563FF;
--brand-pink: #FF2D8D;
--brand-orange: #FF8A00;
--brand-teal: #00E5C2;
```

Дополнительные нейтральные:

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

# 5. Цветовые градиенты

Разрешены, но использовать их осмысленно.

### Primary gradient

``` css
linear-gradient(135deg, #7C3AED 0%, #2563FF 100%)
```

Использовать для:

-   primary CTA;
-   brand mark;
-   selected states;
-   important KPI;
-   featured cards.

### Energy gradient

``` css
linear-gradient(135deg, #2563FF 0%, #7C3AED 45%, #FF2D8D 100%)
```

Использовать ограниченно:

-   hero/featured areas;
-   login visual;
-   selected promotional blocks;
-   major dashboard highlight.

### Opportunity gradient

``` css
linear-gradient(135deg, #FF8A00 0%, #FF2D8D 100%)
```

Использовать для:

-   opportunity indicators;
-   hot leads;
-   high-priority actions;
-   deal alerts.

### Tech gradient

``` css
linear-gradient(135deg, #00E5C2 0%, #2563FF 100%)
```

Использовать для:

-   positive analytics;
-   growth;
-   completed states;
-   successful automation.

------------------------------------------------------------------------

# 6. Важный принцип яркости

Не делать весь UI тёмным.

Целевая композиция:

-   **60--70%** --- светлая поверхность;
-   **15--20%** --- navy / dark UI;
-   **10--15%** --- purple/blue;
-   **до 5%** --- pink/orange/teal.

При этом цвет должен быть заметным на каждом ключевом экране.

Цель:

> Пользователь открывает kleekTo и сразу понимает, что это не очередная
> серо-белая CRM.

------------------------------------------------------------------------

# 7. Sidebar

## Сохранить

-   desktop sidebar;
-   mobile drawer;
-   текущую информационную архитектуру;
-   основные разделы;
-   тёмную основу.

## Изменить

Sidebar должен стать более branded.

### Background

Использовать:

``` css
background:
  radial-gradient(circle at 20% 0%, rgba(124,58,237,.22), transparent 35%),
  #0B1020;
```

Не использовать сильный glow.

### Active item

Активный пункт:

-   purple/blue tinted background;
-   светлый текст;
-   цветная vertical accent line;
-   лёгкое внутреннее свечение.

Пример:

``` text
│ Dashboard
```

где `│` --- purple/blue accent.

### Hover

Добавить очень мягкий:

``` css
background: rgba(124, 58, 237, 0.10);
```

------------------------------------------------------------------------

# 8. Brand lockup в sidebar

Убрать композицию:

``` text
[mark] kleekTo
```

Заменить на:

``` text
[K-SYMBOL]leekTo
```

### Размер

Desktop:

-   знак: примерно 28--32 px;
-   wordmark: 18--20 px;
-   `To` --- accent gradient.

Mobile:

-   compact lockup;
-   при необходимости только `[K-SYMBOL]`.

------------------------------------------------------------------------

# 9. Wordmark

Создать централизованный компонент.

Не дублировать markup в разных местах.

Компонент должен поддерживать:

``` text
variant="full"
variant="compact"
variant="icon"
variant="light"
variant="dark"
```

### Full

``` text
[K]leekTo
```

### Icon

``` text
[K]
```

### Light

Для dark background.

### Dark

Для light background.

------------------------------------------------------------------------

# 10. Типографика

Сохранить:

-   Manrope для Latin/Cyrillic;
-   Noto Sans Georgian для Georgian.

Не менять font stack без необходимости.

Рекомендуемая hierarchy:

``` text
Page title:       28–32px / 700
Section title:    18–20px / 700
KPI:              28–36px / 700
Body:             14–15px / 500
Metadata:         12–13px / 500
Navigation:       14px / 600
```

Использовать:

``` css
font-variant-numeric: tabular-nums;
```

для финансовых и аналитических данных.

------------------------------------------------------------------------

# 11. Border radius

Уменьшить чрезмерную «мягкость».

Рекомендуемые значения:

``` css
--radius-sm: 8px;
--radius-md: 10px;
--radius-card: 12px;
--radius-panel: 16px;
--radius-floating: 20px;
```

### Не использовать

16--24px для всех подряд элементов.

CRM должна ощущаться собранной и профессиональной.

------------------------------------------------------------------------

# 12. Shadows

Сохранить минимализм.

Использовать:

-   очень мягкую shadow для cards;
-   более заметную shadow для dropdown;
-   сильную только для modal/floating layers.

Не делать neumorphism.

Не использовать сильные black shadows.

------------------------------------------------------------------------

# 13. Glassmorphism

Сократить до минимума.

Glass разрешён только для:

-   floating panels;
-   command palette;
-   modal;
-   contextual overlay;
-   AI/assistant surfaces;
-   notification layer.

Обычные:

-   cards;
-   tables;
-   KPI;
-   forms;
-   property blocks

должны использовать solid surfaces.

------------------------------------------------------------------------

# 14. Buttons

Primary CTA должен стать визуально сильнее.

### Primary

Purple → Blue gradient.

``` text
+ Add property
Create task
Save changes
Contact owner
```

### Secondary

Белый фон + border.

### Tertiary

Transparent.

### Destructive

Использовать red только там, где действительно destructive action.

Не заменять все status colors на purple.

------------------------------------------------------------------------

# 15. KPI Cards

Текущую структуру сохранить, но повысить визуальную выразительность.

Каждая KPI card должна иметь:

-   metric;
-   context;
-   small icon;
-   delta;
-   visual accent.

Например:

``` text
ACTIVE LEADS

356

+18% this month

↗
```

### Акцент

Можно использовать:

-   purple;
-   blue;
-   teal;
-   orange.

Не делать каждую карточку отдельного яркого цвета.

### Featured KPI

1 основная KPI card на dashboard может использовать subtle gradient
background.

------------------------------------------------------------------------

# 16. Dashboard

Dashboard должен стать главным экраном продукта.

Приоритет:

1.  What needs attention?
2.  What changed?
3.  What should I do next?
4.  Performance.

Не строить dashboard только как набор статистических карточек.

------------------------------------------------------------------------

# 17. Dashboard hero area

Верхняя часть:

``` text
Good morning, [Name]

Here’s what needs your attention today.
```

Рядом:

-   date;
-   quick action;
-   notifications.

Можно использовать очень лёгкий purple/blue ambient gradient на фоне
hero area.

------------------------------------------------------------------------

# 18. "Next action" block

Добавить/усилить блок:

``` text
TODAY

7 follow-ups due
3 owners waiting
2 deals ready for negotiation

[Open tasks]
```

Цветовой акцент --- purple/blue.

Это должно визуально восприниматься как главный operational area.

------------------------------------------------------------------------

# 19. Deal Feed

Сделать Deal Feed одним из визуальных flagship-компонентов.

Не использовать:

-   star rating;
-   generic AI score;
-   0--100 match score.

Использовать понятные причины.

Например:

``` text
18% below district median

$118,000
72 m² · 3 rooms
Saburtalo

median: $1,860/m²
34 comparable listings

[View property]
```

### Цвет

Opportunity:

orange/pink.

Но использовать accent только на reason/indicator.

------------------------------------------------------------------------

# 20. Properties

Добавить два режима:

``` text
[ List ] [ Visual ]
```

List --- default.

Visual --- card/grid.

### List

Оптимизирован для работы с большим объёмом.

### Visual

Оптимизирован для быстрого просмотра объектов.

------------------------------------------------------------------------

# 21. Property cards

Каждая карточка:

-   photo;
-   title;
-   location;
-   price;
-   area;
-   status;
-   owner;
-   agent;
-   updated;
-   action.

Цена должна быть главным визуальным элементом.

Например:

``` text
$185,000
82 m² · Vake
```

------------------------------------------------------------------------

# 22. Kanban

Сохранить Kanban как operational screen.

Сделать header каждой колонки:

``` text
NEW             24
TO CALL         18
CALLBACK         7
NEGOTIATION     12
```

Каждая колонка может иметь subtle accent.

Не использовать слишком насыщенный background.

При drag:

-   highlight destination;
-   subtle elevation;
-   purple/blue border;
-   короткая transition.

------------------------------------------------------------------------

# 23. Цветовая семантика

Зафиксировать:

``` text
PURPLE  = primary / action
BLUE    = information / discovery
TEAL    = success / completed / growth
ORANGE  = opportunity / attention
PINK    = high priority / important
NAVY    = structure / navigation
```

Это должно применяться одинаково во всём продукте.

------------------------------------------------------------------------

# 24. Status badges

Не делать все badges серыми.

Примеры:

``` text
Active       → blue/purple
New          → purple
Negotiation  → orange
Won          → teal
Attention    → pink
Archived     → neutral
```

Использовать tinted backgrounds:

``` css
background: rgba(..., 0.08–0.12);
```

а не полностью залитые яркие pills.

------------------------------------------------------------------------

# 25. Charts

Графики должны использовать brand colors.

Основная последовательность:

1.  purple;
2.  blue;
3.  teal;
4.  orange;
5.  pink.

Не использовать случайные цвета.

### Важное правило

Не делать rainbow charts без необходимости.

Цвет должен обозначать смысл, а не просто категорию.

------------------------------------------------------------------------

# 26. Empty states

Empty states должны стать частью бренда.

Вместо:

``` text
No properties found.
```

Использовать:

``` text
Nothing here yet.

Add your first property and start building your pipeline.

[+ Add property]
```

Добавить маленькую branded geometric illustration на базе K-logo.

------------------------------------------------------------------------

# 27. Loading states

Не использовать generic spinner везде.

Использовать:

-   skeleton;
-   branded shimmer;
-   короткую purple/blue progress indicator.

Skeleton должен быть нейтральным, а animation --- subtle.

------------------------------------------------------------------------

# 28. Login

Login --- один из самых важных экранов для brand perception.

## Desktop

Разделить экран на две зоны.

### Left

Большой бренд:

``` text
[K]leekTo
```

Headline:

``` text
Turn property listings
into deals.
```

Подзаголовок:

``` text
A smarter workspace for real estate professionals.
```

Добавить abstract geometric visual из K-logo.

Можно использовать:

-   purple;
-   blue;
-   pink;
-   orange;
-   teal

как небольшие gradient accents.

### Right

Login form.

------------------------------------------------------------------------

# 29. Login visual

Не использовать сложную 3D-графику.

Предпочтительно:

-   geometric shapes;
-   translucent layers;
-   thin lines;
-   abstract property-grid;
-   K-logo fragments;
-   subtle gradients.

Стиль:

**premium SaaS**, а не crypto.

------------------------------------------------------------------------

# 30. Mobile

Не переносить desktop 1:1.

Mobile priority:

``` text
Today
Properties
Pipeline
Tasks
```

Settings/profile --- в secondary menu.

Добавить floating primary action:

``` text
+
```

или contextual action.

------------------------------------------------------------------------

# 31. Mobile header

Использовать:

``` text
[K]leekTo        ☰
```

или compact:

``` text
[K]              ☰
```

В зависимости от ширины.

------------------------------------------------------------------------

# 32. Responsive behavior

Проверить минимум:

``` text
1440px
1280px
1024px
768px
480px
390px
```

Особенно проверить:

-   sidebar;
-   tables;
-   Kanban;
-   KPI;
-   property cards;
-   modal;
-   login;
-   mobile drawer.

Не допускать horizontal overflow.

------------------------------------------------------------------------

# 33. Accessibility

Яркость не должна ухудшать accessibility.

Проверить:

-   text contrast;
-   focus states;
-   keyboard navigation;
-   button states;
-   disabled states;
-   form errors;
-   status indication.

Нельзя использовать только цвет для передачи информации.

Например:

``` text
Won
✓
teal
```

а не только зелёный цвет.

------------------------------------------------------------------------

# 34. Motion

Сохранить существующую идею коротких transitions.

Рекомендуемые:

``` text
fast:    120ms
normal:  180ms
slow:    240ms
```

Использовать motion для:

-   hover;
-   active;
-   dropdown;
-   modal;
-   drag;
-   page transition;
-   KPI update.

Не анимировать каждую карточку.

------------------------------------------------------------------------

# 35. Особый фирменный motion-приём

Создать subtle "energy movement":

Purple → Blue gradient может слегка смещаться при:

-   hover;
-   selected;
-   active;
-   loading.

Очень коротко и почти незаметно.

Это станет motion signature kleekTo.

------------------------------------------------------------------------

# 36. Icons

Сохранить собственную SVG icon language.

Требования:

-   одинаковая optical weight;
-   одинаковый размер;
-   одинаковые stroke proportions;
-   простая геометрия.

Активные icons:

-   purple;
-   blue;
-   gradient.

Не смешивать разные icon libraries без необходимости.

------------------------------------------------------------------------

# 37. App icon / favicon / extension

Использовать только K-symbol.

Не помещать полный wordmark в маленькие размеры.

Варианты:

### Light

K + white background.

### Dark

K + navy background.

### Gradient

K + purple/blue gradient.

Для browser extension предпочтителен:

``` text
navy background
+
bright K-symbol
```

------------------------------------------------------------------------

# 38. Brand mark construction

Проверить, чтобы K-symbol:

-   был узнаваем без текста;
-   работал в 16×16;
-   работал в 24×24;
-   работал в 32×32;
-   работал в 512×512;
-   сохранял узнаваемость в monochrome.

Мелкие квадраты под K оставить как часть бренда.

------------------------------------------------------------------------

# 39. Маленькие квадраты под K

Это важный фирменный элемент.

Они должны быть:

-   небольшими;
-   геометричными;
-   не слишком яркими;
-   использовать **градации brand colors**.

Рекомендуемый набор:

``` text
purple light
purple
blue
teal
```

или:

``` text
#A78BFA
#7C3AED
#60A5FA
#67E8F9
```

Но визуально квадраты должны быть subdued.

### Важно

Не делать 4 максимально насыщенных цвета рядом.

Они должны восприниматься как:

> subtle system / data grid / property blocks

а не как отдельная разноцветная иконка.

------------------------------------------------------------------------

# 40. Brightness rules

Поскольку продукт должен быть ярче:

### Можно

-   gradients;
-   colorful accents;
-   colored KPI;
-   branded empty states;
-   colorful icons;
-   colorful data visualization;
-   brighter CTA;
-   subtle ambient backgrounds.

### Нельзя

-   neon text;
-   excessive glow;
-   gradient paragraphs;
-   rainbow backgrounds;
-   glowing borders вокруг каждого элемента;
-   слишком много saturated surfaces.

------------------------------------------------------------------------

# 41. Что нельзя менять

Без необходимости не менять:

-   routing;
-   API;
-   business logic;
-   data model;
-   authentication;
-   backend;
-   permissions;
-   parsing;
-   CRM workflows.

Это задача **UI/brand refresh**, а не функциональный rewrite.

------------------------------------------------------------------------

# 42. Порядок реализации

Работать строго по этапам.

## Phase 0 --- Audit

Перед кодированием:

1.  изучить существующие `DESIGN.md`;
2.  изучить `globals.css`;
3.  изучить layout;
4.  изучить Wordmark;
5.  изучить login;
6.  изучить dashboard;
7.  изучить properties;
8.  изучить board;
9.  изучить tasks;
10. изучить mobile;
11. определить все существующие color tokens;
12. определить все hardcoded colors.

После этого составить список файлов, которые будут изменены.

**Не менять код на этом этапе.**

------------------------------------------------------------------------

# 43. Phase 1 --- Design tokens

Первым делом централизовать:

-   colors;
-   gradients;
-   radii;
-   shadows;
-   typography;
-   transitions.

Не создавать одинаковые цвета вручную в десятках компонентов.

Все новые цвета должны идти через tokens.

------------------------------------------------------------------------

# 44. Phase 2 --- Brand component

Создать/обновить:

``` text
BrandMark
Wordmark
BrandLockup
AppIcon
```

Главная композиция:

``` text
[K]leekTo
```

После этого заменить старый logo usage во всех местах.

------------------------------------------------------------------------

# 45. Phase 3 --- Global UI

Обновить:

-   body;
-   background;
-   typography;
-   buttons;
-   inputs;
-   cards;
-   badges;
-   focus;
-   shadows;
-   radii.

Сначала глобальная система, потом отдельные экраны.

------------------------------------------------------------------------

# 46. Phase 4 --- Navigation

Обновить:

-   sidebar;
-   active state;
-   hover;
-   mobile drawer;
-   mobile header.

После этого проверить desktop + mobile.

------------------------------------------------------------------------

# 47. Phase 5 --- Dashboard

Обновлять в следующем порядке:

1.  header;
2.  hero/next action;
3.  KPI;
4.  pipeline;
5.  Deal Feed;
6.  activity;
7.  tasks.

Dashboard должен стать главным визуальным эталоном новой системы.

------------------------------------------------------------------------

# 48. Phase 6 --- Properties

Обновить:

-   filters;
-   search;
-   list;
-   cards;
-   status;
-   price;
-   property detail.

Добавить List/Visual switch.

------------------------------------------------------------------------

# 49. Phase 7 --- Board

Обновить:

-   columns;
-   headers;
-   cards;
-   drag states;
-   counts;
-   status colors.

------------------------------------------------------------------------

# 50. Phase 8 --- Tasks

Сделать tasks visually consistent с dashboard.

Приоритет:

-   overdue;
-   today;
-   upcoming;
-   completed.

Использовать orange/pink/teal semantic colors.

------------------------------------------------------------------------

# 51. Phase 9 --- Login

После основного UI сделать полноценный branded login.

Проверить:

-   desktop;
-   tablet;
-   mobile;
-   Georgian;
-   Russian;
-   English.

------------------------------------------------------------------------

# 52. Phase 10 --- Empty/loading/error states

Пройти все состояния:

-   empty;
-   loading;
-   error;
-   success;
-   disabled;
-   offline, если применимо.

------------------------------------------------------------------------

# 53. Phase 11 --- Responsive QA

Проверить:

``` text
390
480
768
1024
1280
1440
1920
```

Для каждого размера проверить:

-   clipping;
-   overflow;
-   typography;
-   spacing;
-   navigation;
-   cards;
-   tables;
-   modals.

------------------------------------------------------------------------

# 54. Phase 12 --- Accessibility QA

Проверить:

-   keyboard;
-   focus;
-   contrast;
-   aria labels;
-   semantic HTML;
-   reduced motion;
-   screen reader behavior.

------------------------------------------------------------------------

# 55. Phase 13 --- Visual consistency QA

Проверить весь продукт на наличие:

-   старого logo;
-   старого wordmark;
-   старого green accent;
-   случайных colors;
-   старых radius;
-   старых shadows;
-   несистемных icons;
-   hardcoded colors;
-   несогласованных button styles.

------------------------------------------------------------------------

# 56. Критические критерии приёмки

Работа считается завершённой только если:

### Brand

-   [ ] основной logo = `[K]leekTo`;
-   [ ] первая `k` не дублируется текстом;
-   [ ] K-symbol работает отдельно;
-   [ ] app icon использует K-symbol;
-   [ ] extension icon использует K-symbol.

### Color

-   [ ] интерфейс заметно ярче старой версии;
-   [ ] purple является основным accent;
-   [ ] blue используется как secondary;
-   [ ] pink/orange/teal имеют semantic roles;
-   [ ] цвета централизованы в tokens;
-   [ ] нет случайных цветов.

### UI

-   [ ] sidebar branded;
-   [ ] dashboard visually stronger;
-   [ ] KPI expressive;
-   [ ] Deal Feed prominent;
-   [ ] Properties polished;
-   [ ] Kanban polished;
-   [ ] Tasks consistent;
-   [ ] login branded;
-   [ ] mobile consistent.

### UX

-   [ ] существующие workflows не сломаны;
-   [ ] navigation не изменена без необходимости;
-   [ ] данные читаются быстрее;
-   [ ] primary actions очевидны.

### Accessibility

-   [ ] contrast acceptable;
-   [ ] focus visible;
-   [ ] keyboard navigation works;
-   [ ] color is not the only status indicator.

------------------------------------------------------------------------

# 57. Правило для Claude Code

Перед каждым крупным изменением:

1.  найти существующую реализацию;
2.  понять её назначение;
3.  определить, можно ли изменить её через token/component;
4.  предпочесть изменение общего компонента вместо локального hack;
5.  не дублировать стили;
6.  не ломать существующую функциональность;
7.  после каждого этапа запускать lint/typecheck/tests, если они
    доступны.

------------------------------------------------------------------------

# 58. Правило по коду

Не делать:

``` text
quick CSS patch
!important
duplicate component
random hex color
inline style для brand system
```

Предпочитать:

``` text
design token
shared component
semantic class
existing abstraction
```

------------------------------------------------------------------------

# 59. Финальная визуальная цель

После обновления экран должен восприниматься примерно так:

``` text
                kleekTo
      modern · fast · intelligent

      LIGHT CANVAS
      ─────────────────────────────

      NAVY STRUCTURE
      + PURPLE ENERGY
      + BLUE TECHNOLOGY
      + SMALL COLOR SIGNALS

      clear data
      obvious actions
      strong typography
      subtle motion
      premium SaaS feel
```

Ключевое ощущение:

> **"Это современный технологичный инструмент, который хочется
> использовать каждый день."**

а не:

> **"Это ещё одна CRM."**

------------------------------------------------------------------------

# 60. Финальный принцип

**Не пытайся сделать интерфейс красивым за счёт количества эффектов.**

Сделай его:

**ярким → через цвет**

**технологичным → через геометрию**

**дорогим → через типографику и spacing**

**энергичным → через gradients и interaction states**

**профессиональным → через информационную иерархию**

**узнаваемым → через K-symbol и систему `[K]leekTo`**

------------------------------------------------------------------------

# Definition of Done

Перед завершением Claude Code должен предоставить:

1.  список изменённых файлов;
2.  список новых/изменённых design tokens;
3.  список обновлённых компонентов;
4.  описание нового logo lockup;
5.  описание цветовой системы;
6.  результаты responsive QA;
7.  результаты accessibility QA;
8.  результаты lint/typecheck/tests;
9.  список оставшихся известных визуальных проблем.

**Ничего не считать завершённым только потому, что код компилируется.**

Критерий успеха --- визуальная целостность всего продукта.
