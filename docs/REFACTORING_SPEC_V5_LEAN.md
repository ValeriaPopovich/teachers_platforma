# Teachers Platform — Refactoring Specification v5

**Project:** `ValeriaPopovich/teachers_platforma`  
**Base:** current `main`  
**Target:** Lean Domain Modules  
**Runtime:** Vanilla JS + GitHub Pages + Supabase  
**CAS migration:** already applied

---

# 1. Goal

Refactor the current codebase into a maintainable domain-module architecture without changing product behavior.

Final architecture:

```text
View
  ↓
Service
  ↓
Domain / selectors
  ↓
Global Store
  ↓
Persistence
  ↓
Cloud CAS
```

Primary business modules:

```text
students
schedule
payments
reports
settings
```

Infrastructure remains separated:

```text
state
auth
cloud
shared
app
```

---

# 2. Final project structure

```text
src/
├── app/
│   └── bootstrap.js
│
├── state/
│   ├── store.js
│   ├── persistence.js
│   ├── schema.js
│   ├── validate.js
│   ├── migrations.js
│   ├── pipeline.js
│   └── maintenance.js
│
├── modules/
│   ├── students/
│   │   ├── students.view.js
│   │   ├── student-form.view.js
│   │   ├── group-form.view.js
│   │   ├── profile.view.js
│   │   ├── students.service.js
│   │   ├── students.selectors.js
│   │   └── students.css
│   │
│   ├── schedule/
│   │   ├── schedule.view.js
│   │   ├── lesson-form.view.js
│   │   ├── schedule.service.js
│   │   ├── schedule.domain.js
│   │   ├── schedule.selectors.js
│   │   └── schedule.css
│   │
│   ├── payments/
│   │   ├── payments.view.js
│   │   ├── payment-form.view.js
│   │   ├── payments.service.js
│   │   ├── finances.js
│   │   ├── payments.selectors.js
│   │   └── payments.css
│   │
│   ├── reports/
│   │   ├── reports.view.js
│   │   ├── reports.model.js
│   │   ├── report-drag.js
│   │   └── reports.css
│   │
│   └── settings/
│       ├── settings.view.js
│       ├── settings.service.js
│       └── settings.css
│
├── shared/
│   ├── modal.js
│   ├── dialog.js
│   ├── toast.js
│   ├── dom.js
│   └── format.js
│
├── auth/
│   └── auth-flow.js
│
└── cloud/
    ├── supabase-adapter.js
    └── sync-protocol.js
```

Create only files that contain real code. Empty placeholder files are not required.

---

# 3. Architecture rules

## 3.1. Global state

There is one global persisted store.

Persisted state remains compatible with the current state model:

```js
{
  students: [],
  groups: [],
  lessons: [],
  events: [],
  payments: [],
  financeArchive: {},
  topicLog: {},
  settings: {}
}
```

The store is the only runtime source of persisted truth.

Transient UI state may remain local to views.

Examples:

```text
active student
calendar mode
opened modal
expanded payment section
report drag state
form draft
```

---

## 3.2. Store mutations

All persisted mutations go through:

```js
store.update(actionName, mutator)
```

or:

```js
store.replace(nextState, actionName)
```

Business UI calls services. Services perform store mutations.

Required pattern:

```js
studentsService.updateStudent(id, input)
```

and inside the service:

```js
store.update('students:update', draft => {
  // atomic business mutation
})
```

A user command that changes multiple related entities must publish one atomic state change.

---

## 3.3. Views

Views own:

```text
DOM
rendering
event listeners
forms
modal opening
transient UI state
displaying errors
displaying toast/dialog result
```

Views read state and invoke services.

Views do not perform persisted business mutations.

---

## 3.4. Services

Services own business commands.

Examples:

```text
create student
update student
delete student
create lesson
move lesson
complete lesson
record payment
change settings
```

A service may:

```text
read store
call pure domain functions
call selectors
perform atomic store mutation
return operation result
```

Service result:

```js
{
  ok: true,
  value: ...
}
```

or:

```js
{
  ok: false,
  code: 'SCHEDULE_CONFLICT',
  message: '...',
  details: ...
}
```

---

## 3.5. Domain functions

Pure business calculations belong outside views and services where useful.

Examples:

```text
finance calculations
subscription progress
recurring lesson generation
schedule conflicts
payment state
analytics calculations
backup transformations
```

Domain functions receive data through arguments and return calculated data.

---

## 3.6. Selectors

Selectors are introduced where derived state is:

- reused;
- non-trivial;
- business-relevant;
- useful to test independently.

Examples:

```js
getStudentLessons(state, studentId)
getTodayLessons(state, now)
getStudentMetrics(state, studentId)
getPaymentAttentionRows(state, date)
getMonthlyPaymentSummary(state, date)
```

Simple one-off reads may stay directly inside a view or service.

---

## 3.7. Cross-domain business commands

One service owns each command.

Example:

```js
studentsService.removeStudent(id)
```

may update:

```text
students
group memberships
lessons
payments
financeArchive
topicLog
```

in one atomic store mutation.

Cross-domain calculation code should be reused through pure functions rather than chains of service-to-service mutations.

---

## 3.8. Shared code

`src/shared/` contains only code used by multiple modules.

Target shared modules:

```text
modal.js
dialog.js
toast.js
dom.js
format.js
```

Feature-specific code stays inside its module.

---

# 4. Existing behavior to preserve

The refactor must preserve:

- `tutorCabinet_v1`;
- current state schema;
- current migrations;
- current backup format;
- legacy backup import;
- recovery backup;
- Supabase authentication;
- password recovery;
- owner marker;
- account access gating;
- CAS cloud saving;
- revision conflict handling;
- offline/error/conflict states;
- current schedule rules;
- current finance rules;
- subscription start date;
- lesson history;
- reports;
- PNG report export;
- light theme;
- dark theme;
- mobile layout;
- GitHub Pages deployment.

---

# 5. Stage 0 — baseline

## Work

1. Create branch:

```text
refactor/v5-lean-domain-modules
```

2. Record current `main` commit SHA.
3. Record current file structure.
4. Run existing checks.
5. Record current manual smoke result.
6. Mark this specification as the active refactor plan.
7. Ensure documentation states CAS migration is already applied.

## DoD

- [ ] Refactor branch created.
- [ ] Baseline SHA recorded.
- [ ] Existing checks pass before refactor.
- [ ] Existing manual smoke recorded.
- [ ] No runtime behavior changed.
- [ ] CAS documented as applied.

---

# 6. Stage 1 — make store the single source of truth

## Goal

Remove the current full-state mirror and commit-copy architecture.

## Work

Remove:

```js
let data = structuredClone(store.getState())
```

Remove the old pattern:

```text
mutate data
→ save()
→ commit()
→ replace entire store draft
```

All persisted mutations must be migrated to direct `store.update()` / `store.replace()` calls.

Read access may temporarily use:

```js
store.getState()
```

until module selectors are introduced.

Persistence remains subscribed to successful store changes.

Rendering remains subscribed to successful store changes.

## DoD

- [ ] No mutable full-state copy exists.
- [ ] Old `commit()` snapshot copier removed.
- [ ] Old `save()` snapshot flow removed.
- [ ] Persisted mutations use store methods.
- [ ] Failed validated mutation leaves previous state unchanged.
- [ ] Persistence runs only after valid mutation.
- [ ] Existing product behavior preserved.

---

# 7. Stage 2 — extract shared UI

## Goal

Move generic UI infrastructure out of `assets/app.js`.

## Create

```text
src/shared/modal.js
src/shared/dialog.js
src/shared/toast.js
src/shared/dom.js
src/shared/format.js
```

## Move

Shared responsibilities:

```text
DOM query helpers
HTML escaping
date formatting
time formatting
money formatting
modal open/close
focus restore
focus trap
dirty form confirmation
confirmation dialog
info dialog
toast
```

## DoD

- [ ] Shared UI utilities removed from `assets/app.js`.
- [ ] Modal behavior preserved.
- [ ] Focus behavior preserved.
- [ ] Dirty form confirmation preserved.
- [ ] Toast behavior preserved.
- [ ] Shared modules contain no feature business logic.

---

# 8. Stage 3 — application bootstrap

## Create

```text
src/app/bootstrap.js
```

## Responsibilities

Bootstrap performs:

```text
load persisted state
create store
configure persistence
initialize services
mount module views
run maintenance
perform initial render
```

Feature behavior must not remain in bootstrap.

## Service initialization example

```js
const studentsService = createStudentsService({ store })
const scheduleService = createScheduleService({ store })
const paymentsService = createPaymentsService({ store })
const settingsService = createSettingsService({ store })
```

Views receive only required dependencies.

Example:

```js
mountStudentsView({
  root,
  store,
  service: studentsService
})
```

## DoD

- [ ] Main startup moved to `src/app/bootstrap.js`.
- [ ] Bootstrap contains only composition/startup logic.
- [ ] Application still runs directly on GitHub Pages.
- [ ] No build step required.

---

# 9. Stage 4 — students module

## Create

```text
src/modules/students/
  students.view.js
  student-form.view.js
  group-form.view.js
  profile.view.js
  students.service.js
  students.selectors.js
  students.css
```

Only create `students.selectors.js` if there are enough meaningful selectors during extraction.

## Module ownership

Students module owns:

```text
students list
student search/filter
groups
student form
group form
student profile
student lesson history presentation
student-specific topic data
student settings
```

## Service commands

Implement current product commands through `students.service.js`.

Expected commands include:

```js
createStudent(input)
updateStudent(id, input)
removeStudent(id)
createGroup(input)
updateGroup(id, input)
removeGroup(id)
```

Add separate commands only where current behavior requires a distinct business operation.

## Profile

`profile.view.js` renders the final profile DOM directly.

Current progressive profile transformation must be removed.

## Migration sources

Move relevant behavior from:

```text
assets/app.js
assets/profile-modal.js
```

## DoD

- [ ] Students list owned by students module.
- [ ] Groups owned by students module.
- [ ] Student form owned by students module.
- [ ] Group form owned by students module.
- [ ] Profile owned by students module.
- [ ] Student mutations go through students service.
- [ ] Group mutations go through students service.
- [ ] Final profile DOM rendered directly.
- [ ] `assets/profile-modal.js` removed.
- [ ] Existing student/group/profile behavior preserved.

---

# 10. Stage 5 — schedule module

## Create

```text
src/modules/schedule/
  schedule.view.js
  lesson-form.view.js
  schedule.service.js
  schedule.domain.js
  schedule.selectors.js
  schedule.css
```

Create `schedule.selectors.js` only if selectors are useful during extraction.

## Module ownership

Schedule module owns:

```text
calendar
lessons
one-time lessons
recurring lessons
lesson forms
move
cancel
complete
schedule generation
schedule conflicts
```

## Domain migration

Move relevant pure logic from:

```text
src/domain/schedule.js
```

to:

```text
src/modules/schedule/schedule.domain.js
```

## Service commands

Expected commands:

```js
createLesson(input)
updateLesson(id, input)
moveLesson(id, nextDate)
cancelLesson(id, options)
completeLesson(id, result)
removeLesson(id)
```

Recurring schedule calculations remain pure domain logic.

Commands that affect payment data must preserve all related invariants in the same atomic mutation.

## DoD

- [ ] Calendar owned by schedule module.
- [ ] Lesson form owned by schedule module.
- [ ] Schedule calculations moved to schedule domain.
- [ ] Lesson mutations go through schedule service.
- [ ] One-time lessons preserved.
- [ ] Recurring generation preserved.
- [ ] Move/cancel/complete/delete preserved.
- [ ] Linked financial state remains consistent.

---

# 11. Stage 6 — payments module

## Create

```text
src/modules/payments/
  payments.view.js
  payment-form.view.js
  payments.service.js
  finances.js
  payments.selectors.js
  payments.css
```

## Module ownership

Payments module owns:

```text
payments page
payment form
balances
debts
advances
subscriptions
package progress
payment attention state
finance archive
payment history
payment analytics
```

## Domain migration

Move relevant finance calculations from:

```text
src/domain/finances.js
```

to:

```text
src/modules/payments/finances.js
```

Move analytics only if the analytics logic is primarily financial.

## Service commands

Expected:

```js
recordPayment(input)
updatePayment(id, input)
removePayment(id)
```

Add current linked-lesson payment behavior inside the appropriate atomic commands.

## Selectors

Move non-trivial payment page projections outside the renderer.

Examples:

```js
getPaymentAttentionRows(state, date)
getMonthlyPaymentSummary(state, date)
getPackageProgress(state, studentId, date)
getPaymentHistory(state, filters)
```

## Migration sources

Move relevant behavior from:

```text
assets/app.js
assets/payments-redesign.js
```

## DoD

- [ ] Payments page owned by payments module.
- [ ] Payment form owned by payments module.
- [ ] Payment mutations go through payments service.
- [ ] Financial calculations live outside renderer.
- [ ] Package progress lives outside renderer.
- [ ] Payment attention classification lives outside renderer.
- [ ] `assets/payments-redesign.js` removed.
- [ ] Existing finance behavior preserved.

---

# 12. Stage 7 — reports module

## Create

```text
src/modules/reports/
  reports.view.js
  reports.model.js
  report-drag.js
  reports.css
```

Create additional files only if the existing report feature requires them.

## Module ownership

Reports module owns:

```text
report builder
report preview
report block ordering
drag/drop
copy text
PNG export
report-specific local UI state
```

## Model

`reports.model.js` creates report-ready data from application state.

It may calculate:

```text
period lessons
attendance
topics
homework
tests
student metrics required by report
```

It must not manipulate DOM.

## View

`reports.view.js` renders the final report UI directly.

`report-drag.js` owns drag/drop behavior.

## Migration sources

Move relevant behavior from:

```text
assets/app.js
assets/reports-redesign.js
```

## DoD

- [ ] Reports have one final renderer.
- [ ] Report model separated from DOM rendering.
- [ ] Drag/drop separated from report calculations.
- [ ] `assets/reports-redesign.js` removed.
- [ ] Copy text preserved.
- [ ] PNG export preserved.
- [ ] Report preview preserved.
- [ ] Current report layout behavior preserved.

---

# 13. Stage 8 — settings module

## Create

```text
src/modules/settings/
  settings.view.js
  settings.service.js
  settings.css
```

## Module ownership

Settings module owns:

```text
tutor settings
theme settings
sidebar mode
reminder settings
other persisted application preferences
```

## Service

Persisted changes go through:

```js
updateSettings(patch)
```

Additional commands are added only if current behavior requires distinct operations.

## DoD

- [ ] Settings UI owned by settings module.
- [ ] Persisted settings mutate through service.
- [ ] Theme preserved.
- [ ] Sidebar behavior preserved.
- [ ] Reminder behavior preserved.

---

# 14. Stage 9 — dashboard extraction

## Create

```text
src/modules/dashboard/
  dashboard.view.js
```

If dashboard CSS is large enough:

```text
dashboard.css
```

## Ownership

Dashboard is a read-oriented aggregator.

It reads application state and module calculations/selectors.

It renders:

```text
today lessons
upcoming lessons
completed lessons
unfilled lesson information
attention summaries
```

Business mutations initiated from dashboard still call the owning module service.

## DoD

- [ ] Dashboard rendering removed from legacy monolith.
- [ ] Dashboard reads current state.
- [ ] Dashboard uses owning services for commands.
- [ ] Existing dashboard behavior preserved.

---

# 15. Stage 10 — remove legacy application monolith

## Remove after module extraction

```text
assets/app.js
assets/profile-modal.js
assets/payments-redesign.js
assets/reports-redesign.js
```

Remove related dead code and duplicate listeners.

`index.html` must load the new application entry.

Preferred:

```html
<script type="module" src="./src/app/bootstrap.js"></script>
```

Preserve existing auth/cloud loading required by the current application.

## DoD

- [ ] `assets/app.js` removed.
- [ ] Progressive feature scripts removed.
- [ ] No duplicated feature renderer remains.
- [ ] No duplicated feature event listener remains.
- [ ] New bootstrap is the application entry point.
- [ ] Production GitHub Pages loads successfully.

---

# 16. Stage 11 — CSS cleanup

## Goal

Give large business areas explicit style ownership while keeping CSS structure simple.

## Target

```text
assets/
  styles.css
  tokens.css

src/modules/
  students/students.css
  schedule/schedule.css
  payments/payments.css
  reports/reports.css
  settings/settings.css
```

Dashboard CSS may remain in `assets/styles.css` if small.

## Work

1. Move theme/design tokens into `tokens.css`.
2. Move clearly feature-specific styles into module CSS.
3. Remove styles belonging to deleted progressive redesign layers.
4. Keep common application layout/base styles in `assets/styles.css`.
5. Preserve current visual design.

## DoD

- [ ] Tokens separated.
- [ ] Large feature styles have clear ownership.
- [ ] Duplicate redesign styles removed.
- [ ] Common styles remain centralized.
- [ ] Light theme preserved.
- [ ] Dark theme preserved.
- [ ] Mobile layout preserved.

---

# 17. Stage 12 — cleanup and documentation

## Work

1. Remove dead imports.
2. Remove dead functions.
3. Remove obsolete compatibility code.
4. Remove broad ESLint exceptions that were required only by legacy assets.
5. Update README.
6. Update architecture documentation.
7. Update file structure documentation.
8. Update cloud documentation.
9. Keep CAS documented as already applied.
10. Update release checklist.

## Final ownership map

### Students

```text
src/modules/students/
```

### Schedule

```text
src/modules/schedule/
```

### Payments

```text
src/modules/payments/
```

### Reports

```text
src/modules/reports/
```

### Settings

```text
src/modules/settings/
```

### State lifecycle

```text
src/state/
```

### Cloud/CAS

```text
src/cloud/
```

### Authentication

```text
src/auth/
```

### Shared UI

```text
src/shared/
```

### Application startup

```text
src/app/bootstrap.js
```

## DoD

- [ ] No dead legacy application code remains.
- [ ] No unused imports remain.
- [ ] Lint exceptions reduced to current justified cases.
- [ ] README matches actual structure.
- [ ] Architecture docs match actual code.
- [ ] Cloud docs match actual implementation.
- [ ] Release checklist updated.

---

# 18. Final architecture DoD

Refactoring is complete when all conditions below are true.

## State

- [ ] One global persisted store.
- [ ] Store is the single runtime source of persisted state.
- [ ] No full-state mutable mirror.
- [ ] Business mutations are atomic.
- [ ] Persistence runs from validated store state.

## UI

- [ ] UI grouped by business domain.
- [ ] Views own DOM and interactions.
- [ ] Views call services for persisted business changes.
- [ ] Final feature markup rendered directly by owning view.
- [ ] No progressive renderer-over-renderer architecture remains.

## Services

- [ ] Student commands owned by students service.
- [ ] Lesson/schedule commands owned by schedule service.
- [ ] Payment commands owned by payments service.
- [ ] Settings commands owned by settings service.
- [ ] Cross-entity commands remain atomic.

## Domain

- [ ] Schedule calculations outside views.
- [ ] Finance calculations outside views.
- [ ] Report model calculations outside DOM code.
- [ ] Reused derived state extracted where useful.

## Modules

- [ ] Students module complete.
- [ ] Schedule module complete.
- [ ] Payments module complete.
- [ ] Reports module complete.
- [ ] Settings module complete.
- [ ] Dashboard extracted from legacy monolith.

## Legacy cleanup

- [ ] `assets/app.js` removed.
- [ ] `assets/profile-modal.js` removed.
- [ ] `assets/payments-redesign.js` removed.
- [ ] `assets/reports-redesign.js` removed.
- [ ] No duplicate active implementations.

## Data/cloud

- [ ] Persisted state format remains compatible.
- [ ] Existing migrations remain supported.
- [ ] Backup compatibility preserved.
- [ ] Recovery preserved.
- [ ] CAS preserved.
- [ ] Revision conflict handling preserved.
- [ ] Owner guard preserved.
- [ ] Offline/error/conflict behavior preserved.

## UI compatibility

- [ ] Light theme preserved.
- [ ] Dark theme preserved.
- [ ] Mobile layout preserved.
- [ ] Student flows preserved.
- [ ] Lesson flows preserved.
- [ ] Payment flows preserved.
- [ ] Report flows preserved.
- [ ] Settings preserved.

---

# 19. Testing stage

Testing is performed after the architecture migration is complete and the legacy monolith has been removed.

Existing tests should continue running during intermediate stages where practical, but test architecture cleanup and new coverage belong to this final stage.

---

# 20. Unit and integration tests

## Structure

```text
tests/
├── state/
├── students/
├── schedule/
├── payments/
├── reports/
├── cloud/
├── fixtures/
└── e2e/
```

Create subdirectories only when the number of tests requires them.

## Test rules

- Arrange / Act / Assert.
- One test covers one behavior.
- Multiple assertions are allowed for the same behavior.
- Mutable test state recreated with `beforeEach`.
- Test names describe business behavior.
- Reusable fixtures/factories are extracted.
- Domain and services receive primary unit/integration coverage.
- Production user data is never used.

---

# 21. Required state tests

Cover:

```text
valid store mutation
invalid store mutation rollback
store subscription
persistence after valid mutation
state loading
migrations
backup recovery
invalid imported state safety
```

## DoD

- [ ] State lifecycle covered.
- [ ] Invalid mutation cannot replace valid state.
- [ ] Persistence behavior covered.
- [ ] Legacy state fixture supported.

---

# 22. Required students tests

Cover:

```text
create student
update student
remove student
create/update/remove group
group membership integrity
subscription start date
student deletion dependency cleanup
```

## DoD

- [ ] Student service critical behavior covered.
- [ ] Group behavior covered.
- [ ] Cross-entity cleanup covered.

---

# 23. Required schedule tests

Cover:

```text
one-time lesson
recurring generation
duplicate prevention
move lesson
cancel lesson
complete lesson
remove lesson
linked payment consistency
```

## DoD

- [ ] Schedule domain covered.
- [ ] Schedule service critical commands covered.
- [ ] Recurring schedule remains idempotent.
- [ ] Linked financial invariants covered.

---

# 24. Required payments tests

Cover:

```text
single payment
subscription payment
debt
advance
package progress
partial month
lesson-linked payment
payment removal
monthly payment summary
```

## DoD

- [ ] Finance calculations covered.
- [ ] Payment service commands covered.
- [ ] Partial-month subscription covered.
- [ ] Debt/advance/package states covered.

---

# 25. Required reports tests

Cover business-relevant report model calculations:

```text
period lesson selection
attendance
topics
required student/report metrics
```

DOM drag/drop does not require detailed unit coverage.

## DoD

- [ ] Report model calculations covered.
- [ ] Report data does not depend on DOM.

---

# 26. Architecture guards

Add lightweight architecture validation for these rules:

```text
module views do not import Supabase
module views do not import persistence
domain calculation files do not use DOM APIs
module views do not perform direct persisted store mutations
```

Suggested command:

```json
"validate:architecture": "node scripts/validate-architecture.mjs"
```

## DoD

- [ ] Architecture validation script exists.
- [ ] CI can execute it.
- [ ] Core architecture boundaries are guarded.

---

# 27. Playwright smoke tests

Use Chromium.

Required flows:

## E2E 1 — student

```text
create student
edit student
reload
verify persisted values
```

## E2E 2 — lesson

```text
create lesson
complete lesson
edit or remove lesson
verify resulting state
```

## E2E 3 — subscription/payment

```text
create package student with start date
verify calculated package state
record payment
verify payment state
reload
verify
```

## E2E 4 — backup

```text
export backup
replace controlled test state
import backup
verify restored data
```

Tests must use deterministic local test data and must not depend on production Supabase.

## DoD

- [ ] Four critical browser workflows pass.
- [ ] Chromium smoke stable.
- [ ] Tests use controlled data.
- [ ] Production cloud account is not required.

---

# 28. Final CI

Final CI pipeline:

```text
npm ci
npm run lint
npm run format:check
npm run validate:architecture
npm run validate:stage0
npm test
npm run test:e2e
```

If `validate:stage0` becomes obsolete after refactoring, replace it with an equivalent final validation command and update documentation.

## DoD

- [ ] Dependency installation uses lockfile.
- [ ] Lint passes.
- [ ] Formatting check passes.
- [ ] Architecture validation passes.
- [ ] Unit/integration tests pass.
- [ ] Playwright smoke passes.
- [ ] CI is green before merge.

---

# 29. Final release smoke

Run after all automated checks.

```text
[ ] login
[ ] reload authenticated session
[ ] create student
[ ] edit student
[ ] create group
[ ] create one-time lesson
[ ] complete lesson
[ ] move/cancel lesson
[ ] create package student from mid-month
[ ] record payment
[ ] verify debt/package state
[ ] open student history
[ ] generate report
[ ] copy report
[ ] export report PNG
[ ] export backup
[ ] import backup
[ ] reload data
[ ] verify cloud save
[ ] verify conflict handling
[ ] verify owner protection
[ ] light theme
[ ] dark theme
[ ] mobile
```

---

# 30. Completion

When all stages and all DoD items are complete:

1. merge the refactor branch;
2. deploy;
3. run final production smoke;
4. update documentation;
5. close the refactoring initiative.
