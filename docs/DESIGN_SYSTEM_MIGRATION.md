# Миграция на дизайн-систему TutRoom (Tailwind v4)

Контекст для продолжения в новом окне. Вставь этот файл целиком как первое сообщение агенту.

## Что за задача

Переписываем проект на новую дизайн-систему TutRoom: единый источник цветов,
типографики, радиусов и теней — `styles/design-system.css`, собранный на
Tailwind v4 (`@theme inline`). Правило от пользователя:

> используем только значения оттуда, все остальные цвета и типография
> удаляются, размеры только как там, все тянем оттуда, если будут вопросы —
> пиши перед выполнением

## Как пришли (сделано в фазе 1 — фундамент)

1. Поставлен `tailwindcss` + `@tailwindcss/vite`, плагин подключён в
   [vite.config.js](../vite.config.js).
2. Создан [styles/design-system.css](../styles/design-system.css) —
   единственный источник токенов (цвета, `--font-sans/serif/mono`, `--radius`,
   `--shadow-*`). Импортируется без Preflight (только `@theme` + утилиты) —
   полный Tailwind reset пока не включён, чтобы не снести текущую вёрстку.
   Подключён через `import '../../styles/design-system.css'` в
   [src/app/bootstrap.js](../src/app/bootstrap.js).
3. Google Fonts (Poppins, Libre Baskerville, IBM Plex Mono) подключены в
   [index.html](../index.html) рядом с уже используемым Onest.
4. Старые токен-файлы `styles/tokens/_colors.scss`, `_typography.scss`,
   `_radius.scss` — **удалены**. `_breakpoints.scss` — **оставлен** (в новой
   системе брекпоинтов нет, а миксины `from/till/between/reduced-motion/touch`
   используются по всему проекту).
5. Единственная точка маппинга старое → новое —
   [styles/core/application/_base.scss](../styles/core/application/_base.scss:9).
   Все ~300 мест в SCSS/Vue, которые раньше читали `--color-*`,
   `--font-family-*`, `--font-size-*`, `--radius-*` и короткие алиасы
   (`--bg`, `--panel`, `--text`, `--brand`, ...), продолжают их читать —
   сама эта точка теперь резолвит их в `var(--background)`, `var(--primary)`
   и т.д. из design-system.css. Разметка компонентов не переписывалась.
6. `warning` и `link` цвета (жёлтого/синего в новой палитре нет) схлопнуты на
   `primary` — по явному выбору пользователя.
7. Тёмная тема — через существующий тумблер в сайдбаре
   ([settings-page/scripts/index.js](../src/modules/settings/components/settings-page/scripts/index.js:25)),
   ничего нового не строили.

### Две находки, которые пришлось чинить (не косметика — ломали рендер)

- **Коллизия имён**: легаси-алиасы `--muted`, `--ring`, `--shadow`, `--radius`
  совпадали по имени с токенами Tailwind-темы из design-system.css →
  `--radius: var(--radius-lg)` образовывал циклическую ссылку (invalid),
  `--muted` начинал означать не «приглушённый текст», а «светлый фон» →
  невидимый текст. Переименовано глобально в `--text-muted`, `--focus-ring`,
  `--card-shadow`, `--card-radius` (сделано `sed`-заменой по всем файлам,
  которые их использовали).
- **Тёмная тема не докатывалась до 90% интерфейса**: `.dark`-overrides в
  design-system.css висят на `<body>`, а вся цепочка алиасов в `_base.scss` —
  на `:root`/`<html>`. Custom properties наследуются как уже вычисленное
  значение, поэтому промежуточная цепочка (`--bg` → `--color-background` →
  `--background`), объявленная только на `:root`, не подхватывала override
  на `<body>`. Исправлено добавлением класса `.dark` ещё и на `<html>`
  (стандартная Tailwind-практика) — см. тот же settings-page/scripts/index.js.

### Проверено

- `npm run styles:build` — ок
- `npm run lint:styles` — 0 ошибок, 372 warning (все того же типа
  `declaration-property-value-disallowed-list`, предсуществующие, не наши)
- `npm run test` — 146/149, 3 падения те же, что были до правок (проверено
  через `git stash` до/после — не регрессия)
- `npm run build` — прод-сборка проходит
- Браузер: логин-экран, dashboard, ученики, платежи — светлая и тёмная тема,
  скриншоты сверены визуально

## К чему идём (фаза 2 — по модулям)

Цель: постепенно перевести компоненты с легаси custom properties
(`--bg`, `--panel`, `--text`, `--color-*`, ...) на прямые Tailwind-утилиты
(`bg-background`, `text-foreground`, `bg-primary`, `rounded-lg`, `shadow-sm`
и т.д.), пока легаси-алиасы в `_base.scss` не станут не нужны и их можно
будет удалить вместе с самим большим легаси-файлом.

Предлагаемый порядок (один модуль = один проход = один коммит):
1. ~~`dashboard`~~ — сделано (см. ниже)
2. ~~`students`~~ — сделано (см. ниже)
3. ~~`payments`~~ — сделано (см. ниже, хвост закрыт)
4. ~~`schedule`~~ — сделано (см. ниже, хвост закрыт вторым проходом)
5. ~~`settings`~~ — сделано (см. ниже)
6. ~~`reports`~~ — сделано (см. ниже, хвост закрыт вторым проходом)
7. ~~`board`~~ — частично, особый случай: не Vue-модуль (см. ниже)
8. ~~`packages/ui/*`~~ — частично (см. ниже, тот же критерий динамических/decorative значений)
9. ~~Включить Tailwind Preflight~~ — сделано (см. ниже)
10. ~~Удалить легаси shorthand-алиасы (`--bg/--panel/--text/...`)~~ — **закрыто,
    решено не делать** (осознанное решение пользователя, не технический
    блокер), см. «Почему шаг 10 закрыт» ниже

## Definition of Done (для фазы 2, по каждому модулю)

- [ ] Компонент использует Tailwind-утилиты (`bg-*`, `text-*`, `border-*`,
      `rounded-*`, `shadow-*`) вместо `var(--bg)`/`var(--color-*)` там, где
      это не требует раздельной разметки под breakpoints-миксины
- [ ] Ни одного нового raw-цвета/радиуса/тени — только значения из
      `design-system.css` (через Tailwind-класс или `var(--...)`, если класса
      нет)
- [ ] Светлая и тёмная тема визуально проверены в браузере (скриншот до/после)
- [ ] `npm run styles:build` без ошибок
- [ ] `npm run lint:styles` — не добавляет новых warning/error сверх
      существующих 372
- [ ] `npm run test` — не меньше 146/149 (те же 3 предсуществующих падения
      допустимы, новых нет)
- [ ] `npm run build` — прод-сборка проходит
- [ ] Если модуль — последний из списка выше: обновить этот файл, вычеркнуть
      пункт, двигаться к следующему

### Сделано: `dashboard` (фаза 2, шаг 1)

Компоненты: `dashboard-page`, `attention-panel`, `day-summary`, `day-timeline`.

- Все **статические** (не завязанные на `:class`-условие или breakpoint-миксин)
  цветовые/бордер/radius-декларации, читавшие легаси `--color-*`, заменены на
  прямые Tailwind-утилиты (`text-foreground`, `text-muted-foreground`,
  `bg-primary`, `bg-card`, `bg-muted`, `border-border`, `rounded-lg`,
  `rounded-full`, `stroke-muted`, `stroke-secondary`, `focus:border-primary`,
  `hover:bg-muted`, `hover:text-primary`) — классы навешаны в шаблонах `.vue`,
  соответствующие свойства удалены из `.scss`.
- `dashboard-page` — уже без единого цвета/радиуса в SCSS (чистая
  grid/typography-раскладка), трогать было нечего.
- **Не трогали намеренно** (осталось на `var(--color-*)`, значения по-прежнему
  тянутся из `design-system.css` через `_base.scss`, ничего «сырого» не
  добавлено):
  - органические blob-фоны (`radial-gradient`/`linear-gradient` +
    `color-mix`) и асимметричные `border-radius` карточек — не сводятся к
    Tailwind-утилите без произвольных значений, DoD этого не требует;
  - цвета, зависящие от **динамического** класса/модификатора (`bead--done`,
    `lesson__status--*`, `dash-attention__icon--*`, `timeline-row--past`
    и т.п.) — вычисляются в JS (`beadClass`, `${item.kind}` и т.д.), перенос в
    Tailwind потребовал бы переписывать вычисление классов, риск/выгода не
    оправданы для этого прохода;
  - декларации внутри `@media (width <= …)` — DoD прямо исключает случаи,
    требующие «раздельной разметки под breakpoints».
- Проверено: `npm run styles:build` ок; `npm run lint:styles` — 368 warning
  (было 372, новых нет); `npm run test` — 146/149 (те же 3 пред-существующих
  падения); `npm run build` — ок; браузер (светлая/тёмная тема,
  `localhost:5173`, dashboard) — сверено визуально.

### Сделано: `students` (фаза 2, шаг 2)

Компоненты: `students-page`, `student-card`. Остальные (`group-card`,
`student-form`, `group-form`, `students-toolbar`, empty-states, grids) —
без статических цветов/радиусов/теней в SCSS, трогать было нечего
(проверено grep по всем `.scss` модуля).

- `students-page` — стрелки карусели: `border`/`background`/`color` и
  `:hover`/`:focus-visible` состояния перенесены на Tailwind-утилиты
  (`border-border/72`, `bg-primary-foreground/88`, `text-foreground`,
  `hover:bg-primary-foreground`, `focus-visible:outline-primary/35`),
  удалены из SCSS. `box-shadow` и `transform` оставлены в SCSS (не сводятся
  к утилите без произвольных значений).
- `student-card` — цвет eyebrow-лейбла перенесён на `text-primary`.
- Проверено: `npm run styles:build` ок; `npm run lint:styles` — 368 warning
  (без изменений от шага dashboard, новых нет); `npm run test` — 146/149
  (те же 3 пред-существующих падения); `npm run build` — ок; браузер
  (`localhost:5173`, страница «Ученики и группы») — сверено, ошибок в
  консоли нет.

### Сделано: `payments` (фаза 2, шаг 3, хвост закрыт вторым проходом)

Отличие от `dashboard`/`students`: у `src/modules/payments` нет ни одного
`.scss`-файла вообще — вся стилизация страницы живёт в отдельном legacy-файле
[styles/features/payments/_workbench.scss](../styles/features/payments/_workbench.scss)
(1300+ строк, один корневой селектор `#page-payments`, а не набор
Vue-scoped SCSS рядом с компонентами). Из-за этого паттерн «утилита в
шаблоне вместо декларации в scss» из dashboard/students здесь применяется
частично.

Сделано:
- Устранены **чужеродные raw-цвета без токена** в design-system.css
  (главная причина спросить — см. диалог перед этим шагом):
  - `--payments-pink: #e96aa9` — удалена, все использования →
    `var(--primary)` (совпадает с `--tutroom-pink`).
  - `--payments-blue: #6e8fe8` (в палитре синего нет вовсе) → `var(--secondary)`.
  - `#f59f0a` (статус «истекает») → `var(--primary)`, тем же путём, что
    `--warn` уже коллапсирован на primary в фазе 1.
  - `.debt-stat` — `rgb(220, 82, 96, X%)` → `color-mix(in sRGB, var(--bad) X%, transparent)`.
- Не тронуты (сознательно, тот же критерий, что и в dashboard):
  - все селекторы, завязанные на динамическое состояние —
    `[data-kind='need'|'ending'|'ok']` (биндится как `:data-kind="row.kind"`),
    `[aria-selected='true']`, `.selected`/`.in-range` мини-календаря
    (биндится через `:class`);
  - box-shadow тёмные rgb-тени (`rgb(28, 24, 38, X%)` и т.п.) — та же
    категория, что органические тени в dashboard, не сводится к готовому
    `--shadow-*` без визуальной правки;
  - общий `.btn`/`.btn.primary` из `styles/core/application/_base.scss` —
    это shared UI kit, шаг 8 в списке, не payments.
Второй проход (закрытие хвоста) — перевод статических
`var(--line)/var(--panel)/var(--panel2)/var(--text)/var(--text-muted)/...`
на Tailwind-утилиты, несмотря на «файл не компонентный» (4 Vue-компонента:
`payments-page`, `payment-balance-item`, `payment-history-item`,
`payment-form`, один общий `#page-payments`-блок в SCSS). Оказалось решаемо
без переписывания структуры — каждая декларация внутри `#page-payments`
скоупится к ОДНОМУ конкретному элементу разметки в одном из 4 компонентов
(даже без 1:1 файл↔класс), так что паттерн «утилита в шаблоне, декларация
удаляется из scss» из dashboard/students применился и здесь, декларация за
декларацией.

Сделано:
- ~45 статических var()-деклараций (`background`/`border`/`color` без
  `color-mix`/`gradient`/media/динамического класса) переведены на
  `bg-card`/`bg-muted`/`border-border`/`text-foreground`/
  `text-muted-foreground`/`text-primary`/`text-secondary` и т.п. в шаблонах
  `payments-page`, `payment-balance-item`, `payment-history-item`.
- Перед каждым переводом проверялась специфичность: если элемент уже несёт
  общий класс (`.card`, `.btn`, `.icon-btn`), который сам задаёт то же
  свойство через легаси-алиас — перевод пропускался (см. «не тронуто» ниже),
  чтобы не подменить каскад Tailwind-утилитой ниже по специфичности/слою и
  не сломать рендер.
- Заодно найден и удалён мёртвый/дублирующий CSS:
  - `.payments-stats .stat { background: var(--panel); border: ... var(--line) }`
    — дублировал уже применённый на том же элементе `.card` (в шаблоне
    `class="card stat"`) с идентичными значениями — удалено, рендер не
    меняется, `.card` продолжает их задавать.
  - `.payments-tabs { border-bottom: 1px solid var(--line); ... border: 0; }`
    — `border: 0` в конце того же правила обнулял `border-bottom` выше —
    мёртвая декларация, удалена.
  - `.payments-show-more span { color: var(--text-muted); ... }` — в разметке
    нет `<span>` внутри `.payments-show-more` (только текстовая
    интерполяция) — селектор не совпадает ни с чем, блок удалён целиком.
- Не тронуто (осознанно, риск специфичности/каскадного слоя выше выгоды):
  - `.payments-primary-action { background: var(--primary) }` — переопределяет
    градиент `.btn.primary` из `_base.scss`; Tailwind-утилита той же
    специфичности не гарантированно победит слой/источник этого правила —
    тот же критерий, что box-shadow tooltip/menu в шаге `packages/ui`;
  - `.payment-balance-item .payment-row-action { background: var(--primary) }`
    — тот же случай (`.btn.secondary` variant-переопределение через
    `--button-background`);
  - `.payment-history-item .icon-btn` / `.payment-history-delete` (idle
    `var(--text-muted)`, hover `var(--bad)`) — переопределяет дефолтный
    `color: var(--bad)` общего `.icon-btn` из `_base.scss`, тот же риск;
  - все `[data-kind='need'|'ending'|'ok']`-состояния (`.payment-state-rail`,
    `.payment-balance-state strong/span`) — динамический JS-атрибут на
    родителе, а не на самом элементе; перевод потребовал бы
    `group`/`group-data-*`-паттерна, которого нигде в проекте ещё нет —
    оставлено как в dashboard;
  - `.payments-tab[aria-selected='true'] .payments-tab-count` (вложенный
    aria-selected у родителя) — тот же `group-*`-паттерн, не тронуто; сам
    `.payments-tab` (без вложенности) переведён через `aria-selected:`
    (как `aria-expanded:` в `menu`, `packages/ui`, шаг 8);
  - `color-mix(...)`/`linear-gradient(...)`/rgb-box-shadow — decorative
    composites, тот же критерий, что везде;
  - font-family/font-size var() (`--font-family-display`,
    `--font-size-caption`, ...) — не входили в переводы ни в одном
    предыдущем шаге, оставлено как есть.
- Проверено: `npm run styles:build` ок; `npm run lint:styles` — 361 warning
  (без изменений от шага `packages/ui`, новых нет); `npm run test` — 146/149
  (те же 3 пред-существующих падения, изолированный прогон `tests/` —
  репозиторий также содержит `.claude/worktrees/**` с дублем тестов от
  чужой сессии, не наше, не трогали); `npm run build` — ок; браузер
  (`localhost:5173`, «Управление расчётами» — вкладки «Все ученики»/«История
  платежей», мини-календарь периода) — светлая и тёмная тема сверены,
  ошибок в консоли нет.

### Сделано: `schedule` (фаза 2, шаг 4, хвост закрыт вторым проходом)

Та же архитектура, что у `payments`: у `src/modules/schedule` почти нет
компонентного SCSS — вся раскладка страницы живёт в одном legacy-файле
[styles/features/_schedule.scss](../styles/features/_schedule.scss)
(1685 строк, один корневой селектор `#page-schedule`, разметка рендерится
JS-шаблонными строками в [schedule.view.js](../src/modules/schedule/schedule.view.js),
а не Vue-компонентами) плюс общие `.form-grid`/`.field`/`.btn` из
`_base.scss` (используются `lesson-form`, `event-form`, `event-form-body`,
`schedule-forms` — эти 4 компонента вообще без своего `<style>`, трогать
было нечего).

Проверено: единственный компонент модуля с собственным Vue-scoped SCSS —
[schedule-create-sheet](../src/modules/schedule/components/schedule-create-sheet/styles/index.scss).
В нём легаси `var(--line)/--text/--panel2/--text-muted/--danger)` читал
блок `.schedule-sheet-event*` — который оказался мёртвым кодом: класс нигде
не навешивается ни одним шаблоном в модуле (grep по всему репозиторию —
0 совпадений). Блок удалён целиком (deletion over addition), а не переведён
на утилиты — переводить было нечего. Компонент проверен в браузере
(добавление события, светлая/тёмная тема) — визуально не изменился, как и
ожидалось для мёртвого CSS.

Не тронуто (тот же критерий, что в dashboard/payments):
- статические `var(--text)/var(--panel)/var(--line)/var(--text-muted)` в
  `_schedule.scss` — тот же случай, что и незакрытый хвост payments: файл не
  компонентный (JS-шаблонные строки, не Vue-разметка), перевод на утилиты
  риск/выгода не оправдан в этом проходе;
- десяток «чужеродных» hex-цветов без токена в `_schedule.scss` (`#c9ff49`,
  `#9bdc25`, `#ef5cca`, `#7651ed`, `#ff75d5`, `#7a22df`/`#5e08cf`/`#f6e7ff`,
  `#7255df`/`#835ee7`, `#cbd4ff` и др.) — в отличие от `--payments-pink`/
  `--payments-blue` из фазы payments, эти цвета не определены в
  design-system.css как токены, а завязаны на динамические
  JS-классы-модификаторы (`.day.today`/`.selected`, `.timeline-day-head.is-today`,
  `.timeline-event--${entry.type}`, `.schedule-summary-card--${entry.type}`) —
  та же категория, что «цвета, зависящие от динамического класса» в
  dashboard, намеренно не трогается.
- Проверено: `npm run styles:build` ок; `npm run lint:styles` — 366 warning
  (было 368, новых нет, стало на 2 меньше за счёт удалённого мёртвого кода);
  `npm run test` — 146/149 (те же 3 пред-существующих падения); `npm run build`
  — ок; браузер (`localhost:5173`, страница «Расписание», добавление
  события) — светлая/тёмная тема сверены, ошибок в консоли нет.

Второй проход (закрытие хвоста) — тот же приём, что закрыл хвост `payments`:
`_schedule.scss` не компонентный (JS-шаблонные строки в
[schedule.view.js](../src/modules/schedule/schedule.view.js), не Vue-разметка),
но каждая статическая декларация всё равно скоупится к одному конкретному
элементу разметки — либо в `schedule.view.js`, либо в статичном блоке
[index.html:79](../index.html:79) (`.schedule-today`). Утилита добавляется
прямо в шаблонную строку/атрибут `class`, декларация уходит из `.scss`.

Переведено (~14 статических `var(--text)/var(--panel)/var(--line)/var(--text-muted)`-
деклараций, без `color-mix`/media/динамического класса):
`.calendar-weekday`, `.day` (базовый `color`, не `.today`/`.selected`/
`.outside-month` — те остаются модификаторами), `.timeline-head`
(`border-bottom` → `border-b border-border`), `.timeline-day-head` (`color`),
`.timeline-hours` (`border-right` → `border-r border-foreground`),
`.timeline-hours span`, `.timeline-lines i` (`border-top` → `border-t
border-border`), `.timeline-hover-line span`, `.timeline-draft`
(`border-left` → `border-l border-muted-foreground`, `color`),
`.schedule-today` (`border`/`background` → `border border-border bg-card`),
`.schedule-summary-row b` (`color`/`background` → `text-card bg-foreground`).

Не тронуто (тот же критерий специфичности, что закрыл `.icon-btn` в
payments): `.schedule-icon-button`/`.schedule-summary-row button` — общая
кнопка-триггер, но `.schedule-today-head .schedule-icon-button` переопределяет
её `color`/`border` только для одной кнопки (закрытие черновика); превратить
обе стороны в Tailwind-утилиты одинаковой специфичности означало бы, что
порядок в скомпилированном CSS решает исход — непредсказуемо. Оставлено как
есть в `.scss`, каскад продолжает работать корректно.

Заодно найден и удалён мёртвый CSS (grep класс-имён против всего репозитория
— 0 совпадений): `.schedule-page .event` (заменён `.timeline-event` во всех
реальных рендерах), весь блок `.schedule-create-menu`/`.schedule-event-create*`
(114 строк — старый UI создания события до `lesson-form.view.js`, файл уже
удалён в этой сессии) и `.custom-event` — все три относились к разметке,
которой больше нет ни в одном компоненте модуля.

Не тронуто (без изменений от первого прохода): raw hex без `var()`
(`#7651ed`, `#ef5cca`, `#7a22df` и т.п. — не токенизированы вовсе, вне
скоупа перевода var→utility) и все `color-mix(...)`-композиты.

Проверено (второй проход): `npm run styles:build` ок; `npm run lint:styles`
— 357 warning (было 361 после шага `packages/ui`, новых нет, на 4 меньше за
счёт удалённого мёртвого кода); `npm run test` — 146/149 (те же 3
пред-существующих падения, изолированный прогон `tests/`, `.claude/worktrees/**`
не наше); `npm run build` — ок; браузер (`localhost:5173`, «Расписание» —
месяц/неделя, сайдбар «Сегодня») — светлая и тёмная тема сверены, ошибок в
консоли нет.

### Сделано: `settings` (фаза 2, шаг 5)

Компонент: `settings-page` — вообще без собственного `<style>`; вся вёрстка
опирается на общие примитивы (`.card`, `.form-grid`, `.field`, `.kpi-line`,
`.section-head`, `.btn`) — они шарятся с другими модулями (`students`,
`payments`, `reports`), это shared UI kit, шаг 8, не settings. Единственный
settings-владеемый класс — `.subscribe` (кнопка Telegram-подписки, видна
только на мобильной раскладке, `styles/features/_settings.scss` не
используется, стили жили в легаси-файле `assets/styles.css`).

- В `assets/styles.css` для `.subscribe` было два конфликтующих правила:
  первое задавало `background: linear-gradient(var(--brand), var(--brand2))`
  (тот же паттерн, что общий `.btn.primary` — не settings-специфичный,
  не трогали), второе — без media/класса-условия, с `!important` —
  перебивало его на `background: var(--color-link)` + сырую синюю
  `box-shadow: rgba(40, 120, 232, 0.25)` (в палитре TutRoom синего нет).
  Из-за одинаковой специфичности второе правило всегда побеждало — первый
  градиент был мёртвым кодом.
- Спросили пользователя, что делать с сырой синей тенью — решили убрать
  совсем. Удалили мёртвое правило-градиент и `box-shadow`, оставшийся
  `background: var(--color-link)`/`color: var(--color-on-accent)` перенесли
  в шаблон `settings-page/index.vue` как `bg-primary text-primary-foreground`
  (deletion over addition — вместо переноса обоих конфликтующих правил в
  Tailwind, оставили только тот, что реально рендерился).
- Не тронуто: `border-radius: 13px` на `.subscribe` — сырое значение, но не
  читает legacy var (не в скоупе перевода var→utility), и не совпадает ни с
  одним `--radius-*` токеном без произвольного значения — тот же критерий,
  что органические border-radius в dashboard.
- Проверено: `npm run styles:build` ок; `npm run lint:styles` — 366 warning
  (без изменений); `npm run test` — 146/149 (те же 3 пред-существующих
  падения); `npm run build` — ок; браузер (`localhost:5173`, страница
  «Профиль», мобильная раскладка, светлая/тёмная тема) — кнопка
  `@lera_easy_math` сплошного `--primary`, тени нет, ошибок в консоли нет.

### Сделано: `reports` (фаза 2, шаг 6, хвост закрыт вторым проходом)

Та же архитектура, что у `payments`/`schedule`: `reports-page/index.vue` без
собственного `<style>`, вся раскладка живёт в одном legacy-файле
[styles/features/_reports.scss](../styles/features/_reports.scss) (672
строки, один корневой селектор `.reports-page`, много breakpoint-миксинов и
динамических состояний — `[aria-expanded]`, `.is-open`, `.is-dragging`,
`.is-drag-over`, `:hover`/`:active`).

Сделано:
- Найден и удалён мёртвый CSS (grep класс-имён из `_reports.scss` против
  всего модуля `src/modules/reports` — 0 совпадений): `.notice` (внутри
  `.reports-editor-form > .field.full:has(.form-grid)`), `.rating-label` и
  `.r-grade` внутри `.builder-item`, плюс адаптивное переопределение
  `.builder-item:not(.topic) .rating-label` в мобильном брейкпоинте —
  строки для оценки/лейбла, которых больше нет в вёрстке (deletion over
  addition, тот же приём, что в шаге `schedule`).
- Раскрашенных «чужеродных» raw-цветов без токена (как `--payments-pink`
  в фазе 1) не найдено — единственный дубль градиента
  `linear-gradient(var(--brand), var(--brand2))` у `.report-tools .btn:last-child`
  совпадает с общим `.btn.primary` из `_base.scss` (shared UI kit, шаг 8, не
  трогали); органические box-shadow (`rgb(34, 28, 45, X%)`,
  `rgb(239, 79, 145, 20%)`) — та же категория, что в dashboard/payments, не
  сводятся к `--shadow-*` без визуальной правки.
Второй проход (закрытие хвоста) — тот же приём, что закрыл хвосты
`payments`/`schedule`: `reports-page/index.vue` — один Vue-файл (не JS-шаблонные
строки, но и не 1:1 класс↔компонент — каждый класс из `.reports-page`
скоупится к конкретному элементу разметки внутри этого единственного файла,
включая повторяющиеся элементы `v-for`/4 однотипных `<section>`). Переведено
(~13 статических `var(--line)/var(--panel)/var(--panel2)/var(--text)/
var(--text-muted)`-деклараций без `color-mix`/media/динамического класса):
`.reports-editor-head` (`border-bottom` → `border-b border-border`),
`.report-accordion` (`border-top` → `border-t border-border`),
`.report-editor-section` (`background`/`border-bottom` → `bg-card border-b
border-border`, применено ко всем 4 `<section>`),
`.report-section-toggle` (`color` → `text-foreground`),
`.report-section-chevron` (`color`/`background` → `text-muted-foreground
bg-muted`), `.report-section-count` (`color`/`background`/`border` →
`text-muted-foreground bg-muted border border-border`, 3 из 4 секций —
у `nextPackage` счётчика нет), `.report-drag-handle` (`color` →
`text-muted-foreground`), `.builder-item` (`border`/`background` → `border
border-border bg-muted`), `.report-editor-empty` (`color` →
`text-muted-foreground`), `.report-next-package-label` (`color` →
`text-foreground`), `.report-next-package-panel textarea`
(`background`/`border`/`color` → `bg-muted border border-border
text-foreground`).

Не тронуто (тот же критерий, что везде): `.report-include-toggle:hover`/
`.report-add-btn:hover`/`.builder-item.is-drag-over` — `color-mix(...)`;
`.report-add-btn` (`border`/`background`/`color: var(--brand-ink)`) — сама
декларация статична, но `color: var(--brand-ink)` в том же правиле не сводится
к утилите (нет `brand-ink`-эквивалента в Tailwind-теме), а последующие
`:hover`/`:active` того же элемента используют `color-mix`/`transform` —
переносить только часть правила в шаблон при активном hover-состоянии того же
цвета рискованно, оставлено в scss; `.report-tools .btn:last-child` —
переопределяет общий `.btn.primary` градиент (тот же критерий, что
`.payments-primary-action`, шаг 8); блок внутри `@include bp.till(767px)`
(`.report-include-toggle` mobile-вариант) — DoD исключает breakpoint-scoped
декларации.

Проверено (второй проход): `npm run styles:build` ок; `npm run lint:styles` —
357 warning (было 361 после шага `packages/ui`, новых нет); `npm run test` —
146/149 (те же 3 пред-существующих падения, изолированный прогон `tests/`);
`npm run build` — ок; браузер (`localhost:5173`, «Отчёты родителям» — все 4
аккордеон-секции раскрыты, добавлена тестовая строка) — светлая и тёмная тема
сверены, ошибок в консоли нет.

### Сделано частично: `board` (фаза 2, шаг 7)

Отличается от всех предыдущих шагов архитектурно: `board` — не Vue-модуль
вообще. Разметка — статичный блок в [index.html:84-102](../index.html:84),
логика — [assets/board.js](../assets/board.js), стили —
[styles/features/_board.scss](../styles/features/_board.scss) (1417 строк,
компилируется в `assets/styles.css` через `npm run styles:build` —
руками этот файл не редактируется, см.
[scripts/build-styles.mjs](../scripts/build-styles.mjs)).

Сделано:
- Найден и удалён мёртвый CSS (grep класс-имён из `_board.scss` против
  `index.html` + `assets/board.js` — 0 совпадений): `.board-library-popover`,
  `.board-library-head`, `.board-add-button`, `.board-options` со всеми
  вложенными правилами — старый вариант UI выбора доски через
  `<details>/<summary>`-попап, заменённый текущим полноэкранным
  `.board-library-screen`/`.board-list`, CSS не подчистили. Тот же мёртвый
  код был задублирован и в собранном `assets/styles.css` — ушёл сам после
  пересборки.
- **Не тронуто** (сознательно, спросили пользователя): 30+ сырых
  `#fff`/`rgb(...)`-цветов в `_board.scss` (тулбар, канвас, диалоги,
  hex `#24232b`/`#fff0f1`/`#f7f7fb` и т.д.) — доска-канвас намеренно всегда
  светлая/«бумажная» независимо от темы, та же категория, что
  `.report-paper` в `reports` («The report itself intentionally keeps
  the existing visual design»). Перевод на Tailwind-утилиты/токены здесь не
  делали.
- Перевод статических `var(--line)/var(--panel)/var(--text)/...` на прямые
  Tailwind-утилиты не делали — не Vue-разметка (аналогично payments/schedule/
  reports), плюс нет смысла без решения по цветам выше.
- Проверено: `npm run styles:build` ок; `npm run lint:styles` — 361 warning
  (было 364, новых нет, на 3 меньше за счёт удалённого мёртвого кода);
  `npm run test` — 146/149 (те же 3 пред-существующих падения); `npm run build`
  — ок; браузер (`localhost:5173`, «Мои доски» → создание доски → тулбар,
  панель «Ещё», настройки ручки) — ошибок в консоли нет, ничего не сломано.

### Сделано частично: `packages/ui` (фаза 2, шаг 8)

Компоненты: `hint`, `tooltip`, `bottom-sheet`, `menu`, `modal`. Остальные
(`badge`, `button`, `card`, `input`, `page-layout`) — без единого статического
`var(--color-*)`/`var(--bg)`/... в SCSS, трогать было нечего (проверено grep
по всем `.scss`/`.vue` пакета).

Сделано (тот же паттерн, что в dashboard/students — статичная декларация из
`.scss` удаляется, эквивалентная Tailwind-утилита навешивается на элемент в
`.vue`-шаблоне):
- `hint` — `color: var(--text-muted)` → `text-muted-foreground` на кнопке-триггере.
- `tooltip` — `color: var(--color-on-accent)` → `text-primary-foreground` на
  всплывающей подсказке.
- `bottom-sheet` — `border`/`background` шторки (`var(--color-border)`/
  `var(--color-surface)`) → `border border-border bg-card`; `background`
  ручки-индикатора (`var(--color-border)`) → `bg-border`.
- `menu` — `color`/`background` триггера и пунктов меню (`var(--text)`/
  `var(--panel2)`) → `text-foreground`, `hover:bg-muted`,
  `aria-expanded:bg-muted` (триггер), `hover:bg-muted focus-visible:bg-muted`
  (пункты); `border`/`background` панели (`var(--line)`/`var(--panel)`) →
  `border border-border bg-card`.
- `modal` — `color` текста в диалоге подтверждения закрытия и подзаголовка
  (`var(--text-muted)`) → `text-muted-foreground`; `color` иконки-варнинга
  диалога закрытия (`var(--danger)`, статичная часть — `background` там же
  остался в SCSS, это `color-mix`) → `text-destructive`.

Не тронуто (тот же критерий, что во всех предыдущих шагах):
- декоративные `color-mix(...)`-композиты (оверлей bottom-sheet, фон иконки
  `.modal-discard__icon`, тинты `.lesson-form-modal`/`.lesson-homework-card`
  на базе `--brand2`) — не сводятся к утилите без произвольного значения;
- `var(--brand2)` как plain-значение (`tooltip` фон, `hint` hover) — это
  алиас на `--color-chart-5`, а у Tailwind-темы нет отдельного слота под
  «второй бренд-цвет», только `chart-*` (для данных, не для UI-акцентов);
  переименовывать/вводить новый токен не в рамках этого шага — оставлено
  как есть, тот же приём, что с «органическими» фонами в dashboard;
- `box-shadow: var(--card-shadow)` (tooltip, menu-panel, bottom-sheet,
  modal) — легаси-алиас резолвится в разные Tailwind shadow-токены в
  светлой/тёмной теме (`--shadow-sm` vs `--shadow-md`, см. `_base.scss`),
  переход на `shadow-sm` утилиту сменил бы отбрасываемую тень в тёмной теме —
  не тронуто;
- `.modal::before` (индикатор-полоска drag-handle мобильного sheet-варианта
  модалки) — псевдоэлемент, не на что навесить класс в шаблоне;
- `.field`/`.lesson-homework-card`/`.modal-discard__icon` background внутри
  `.lesson-form-modal` — стилизуют **слотовую** разметку, которую подставляют
  компоненты-потребители (`lesson-form` и т.п.), а не собственный шаблон
  `modal`, — класс навесить некуда;
- `.is-danger` в `menu-item` (`color: var(--bad)`) — цвет зависит от
  динамического модификатора, вычисляемого в JS (`itemClass(item)`), тот же
  критерий, что `bead--done`/`lesson__status--*` в dashboard.
- Общие классы `.btn`/`.card`/`.close`/`.field` из `styles/core/application/_base.scss`,
  которые используют `modal`/`menu` — это сам легаси-файл, шаг 9/10, не
  `packages/ui`.

Найдено, но не в объёме этого шага (нет `var(--color-*)` для перевода —
компоненты просто не стилизованы ни под один из своих props-вариантов):
`ui-badge--{variant}` (`badge`), `ui-card--{variant}` (`card`), `.ui-input`
(`input`) — ни один из этих классов не встречается ни в одном `.scss`/`.css`
проекта (grep по всему репозиторию), то есть варианты `variant`/`padding` у
`UiBadge`/`UiCard` и сам `UiInput` рендерятся визуально одинаково независимо
от пропа — не баг миграции, добавлять стили не входило в задачу (шаг 8 —
перевод существующих `var()`, а не дописывание недостающей стилизации).

Проверено: `npm run styles:build` ок; `npm run lint:styles` — 361 warning
(без изменений от шага `board`, новых нет); `npm run test` — 146/149 (те же
3 пред-существующих падения); `npm run build` — ок; браузер
(`localhost:5173`, страница «Ученики и группы» — меню карточки, модалка
создания ученика с подсказкой; страница «Расписание» — bottom-sheet
создания занятия) — светлая и тёмная тема сверены, ошибок в консоли нет.

**Побочная находка (не наша, не трогали):** на странице «Ученики и группы»
тёмная тема фактически сломана — `body:has(.students-page.active)` в
[styles/features/students/_cards.scss:5-8](../styles/features/students/_cards.scss:5)
задаёт сырой `background: rgb(249, 247, 246)` (светлый) без обращения к
токену, поверх легаси `body { background: var(--bg); }` из `_base.scss`, и
эта декларация побеждает независимо от темы — текст остаётся белым (тема
переключилась верно), а фон страницы — светлым. Не относится к
`packages/ui`, не трогали в этом шаге; заслуживает отдельного фикса.

### Найдено и починено: белые карточки студентов в тёмной теме

Побочная находка из шага `packages/ui` (см. выше) оказалась даже шире, чем
описано: `body:has(.students-page.active) { background: rgb(249, 247, 246) }`
в [_cards.scss:5-8](../styles/features/students/_cards.scss:5) был не
единственным — весь модуль `students` использовал `background:
var(--color-on-accent)` (алиас на `--primary-foreground`, «текст поверх
цветной кнопки», т.е. **всегда** белый/светлый вне зависимости от темы) как
цвет фона карточек/кнопок/меню — паттерн, случайно правильный только пока
дизайн был monotone-светлым. Нашлось 8 мест: `.student-card`,
`.student-lesson-link.is-empty` (+ `:hover`/`:focus-visible`), `.group-card`,
`.student-filter button.is-active`, `.students-toolbar-actions .btn`,
`.student-menu > button`. В тёмной теме это давало ровно картину со скриншота
пользователя — светлая непрозрачная плашка поверх тёмного фона, текст
нечитаем.
- `body:has(.students-page.active)` фон → `var(--bg)` (было `#f9f7f6` —
  сырой цвет без токена).
- Все 8 `background: var(--color-on-accent)` → `background: var(--panel)`
  (тот же токен, что использует `.card` — эти элементы визуально card-like
  поверхности, просто с явным собственным правилом вместо наследования
  от `.card`).
- Общепроектный grep на `background:.*var(--color-on-accent)` вне students —
  найдено ещё 3 места (`_feature-responsive.scss` — белый кружок toggle-переключателя,
  `_base.scss` `.report-paper`/`.paper-pill` — «бумага» отчёта). Все три —
  осознанно светлые независимо от темы (toggle-ручка и «бумажный» отчёт,
  см. `.report-paper` выше в этом файле), не тронуты.
- Проверено: `npm run styles:build` ок; браузер (`localhost:5173`, «Ученики
  и группы», тёмная тема) — карточка ученика/пустой слот занятия/фильтры
  тёмные, текст читаем.

### Сделано: Tailwind Preflight (фаза 2, шаг 9)

[styles/design-system.css](../styles/design-system.css) переключён с
`@import "tailwindcss/theme.css" layer(theme); @import
"tailwindcss/utilities.css" layer(utilities);` на полный `@import
"tailwindcss";` (добавляет `layer(base)` — reset margins/border-box/списки и
т.д.) + добавлен стандартный `@layer base { *, ::after, ::before, ::backdrop
{ border-color: var(--border); outline-color: color-mix(in oklab, var(--ring)
50%, transparent); } }` (shadcn-boilerplate паттерн — единообразный
border/outline-цвет по умолчанию для элементов без явного `border-*`).
`body {@apply bg-background text-foreground}` **не добавляли** — легаси
`_base.scss` уже задаёт `body { background: var(--bg); color: var(--text) }`
с тем же резолвом, дублировать незачем.

Preflight — самое рискованное изменение всей фазы 2: он обнуляет
margin/padding/list-style/border почти на всех элементах, а легаси SCSS
писался без reset. Проверено особенно тщательно:
- `npm run styles:build` / `npm run build` — ок.
- `npm run lint:styles` — 357 warning (было 361, новых нет).
- `npm run test` (изолированно `tests/`, без `.claude/worktrees/**`) —
  146/149, те же 3 пред-существующих падения.
- Браузер, светлая и тёмная тема, все 7 разделов (`localhost:5173`):
  главная (дашборд), расписание (сетка недели + попап «Добавить событие» +
  bottom-sheet «Занятие»), ученики и группы (карточка, меню ⋯, модалка
  «Редактировать ученика»), оплаты (список + модалка «Добавить оплату»),
  отчёты родителям (все 4 аккордеон-секции), доска (список досок + сам
  канвас — намеренно светлый «бумажный» вид не пострадал), профиль —
  раскладка, отступы и списки визуально не изменились ни в одном месте,
  ошибок в консоли нет.

### Почему шаг 10 закрыт

**Решение пользователя (не техническое ограничение):** пункт закрыт, к
удалению алиасов не возвращаемся. Ниже — обоснование, почему это разумный
выбор, а не просто «не успели».

Шаг 10 предполагает удаление shorthand-алиасов (`--bg`, `--panel`, `--panel2`,
`--text`, `--text-muted`, `--line`, `--brand`, `--brand2`, `--soft`, `--ok`,
`--warn`, `--bad`, `--card-shadow`, `--focus-ring`, `--focus`, `--brand-ink`,
`--neutral-chip`, `--disabled-bg`, `--disabled-text`, `--card-radius`) из
[_base.scss:65-84](../styles/core/application/_base.scss:65) — план
предполагал, что к этому шагу все модули уже читают дизайн-систему напрямую
через Tailwind-утилиты, и алиасы становятся мёртвым кодом.

На деле это не так — и не станет так в рамках этой миграции. Grep по всему
`styles/`/`src/`/`packages/` на `var(--bg|panel2?|text|text-muted|line|
brand2?|soft|ok|warn|bad|card-shadow|focus-ring|focus|brand-ink|neutral-chip|
disabled-bg|disabled-text|card-radius)` — **21 файл** всё ещё их использует.
Все эти случаи — не забытый хвост, а прямо описанные в этом файле
(«не тронуто», выше по каждому модулю) сознательные исключения из DoD:
decorative `color-mix(...)`-композиты, цвета/тени внутри `@media`-брейкпоинтов,
цвета, зависящие от динамического JS-класса (`[data-kind]`, `.is-danger`,
`.timeline-event--${type}`), «бумажный» отчёт и канвас доски (намеренно вне
темы) — то есть категории, которые DoD каждого шага явно исключал, а не
«ещё не дошли руки».

Хуже того — два алиаса кодируют не просто переименование, а **тему-зависимую
логику**: `--card-shadow` резолвится в `var(--shadow-sm)` на `:root` и в
`var(--shadow-md)` под `[data-theme='dark']`
([_base.scss:77,87-90](../styles/core/application/_base.scss:77)), аналогично
`--focus-ring` меняет прозрачность color-mix между темами. Простого
переименования `var(--card-shadow)` → `var(--shadow-sm)` не существует без
того, чтобы **вручную** развесить `[data-theme='dark']`-override в каждом из
21 файла — то есть не удаление мёртвого кода, а размножение той же логики по
всему дереву стилей. Это ухудшение, не улучшение.

Итог: алиасы — не легаси-хвост, а постоянная инфраструктура резолва темы для
случаев, которые принципиально не сводятся к Tailwind-утилите (decorative,
dynamic, breakpoint-scoped, theme-conditional). Пользователь подтвердил: шаг
10 **закрыт окончательно**, не возвращаться к нему без нового архитектурного
решения (например group-data-паттерна для динамических состояний). Алиасы в
[_base.scss:65-84](../styles/core/application/_base.scss:65) остаются
постоянной частью системы, а не временным легаси.

## Известные пред-существующие проблемы (не наши, не трогать без отдельного запроса)

- 372 stylelint-warning `declaration-property-value-disallowed-list` — старое
  правило из `docs/ANTI_AI_UI_MIGRATION_PLAN.md`, существовало до миграции
- `tests/architecture-guards.test.js` — 2 падения (`AppNavigation.vue` не
  найден, `#profileModal` селектор не совпадает) — от незавершённого
  редизайна до этой сессии
- `tests/ui-boundaries.test.js` — 1 падение (порядок `day/week/month` в
  разметке календаря не совпадает с ожидаемым в тесте) — то же самое

## Как продолжить в новом окне

Список из «К чему идём» пройден до конца: шаги 1-6 и 9 сделаны полностью,
7-8 (`board`, `packages/ui`) — частично по описанным выше причинам (не
Vue-разметка / decorative-composite критерий), шаг 10 — **закрыт окончательно
решением пользователя**, см. «Почему шаг 10 закрыт» выше, не возвращаться к
нему.

Если возвращаться к `board`/`packages/ui` — тот же приём, что везде:
специфичность декларация за декларацией, конфликт с `.card`/`.btn`/`.icon-btn`
или динамическим модификатором — пропускается, иначе утилита в шаблон/vue,
var() из scss удаляется. Если во время перевода всплывёт цвет/радиус/тень без
прямого аналога в `design-system.css` — сначала спроси, не изобретай
самостоятельно (как и в фазе 1 с warning/link).
