# REFACTOR FLOW — Teachers Platform

## Source of truth

Repository: `ValeriaPopovich/teachers_platforma`  
Pass 1 base: `main` @ `53244eb18790bec4cb553c81ef297349854d6cd4`  
Target branch after applying this archive: `refactor/v5-lean-domain-modules`

This archive is an **overlay for the repository at the base SHA above**.

Apply all files from the archive on top of that repository state. Files that are not present in this archive remain unchanged.

After the archive is applied and committed, the new Git commit/branch becomes the source of truth for all further work.

---

## Architecture contract

The approved architecture is **Lean Domain Modules**.

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

Hard rules:

1. One global persisted store.
2. Store is the only runtime source of persisted state.
3. Views read state and call services for persisted business changes.
4. Services own business commands and atomic mutations.
5. Complex pure calculations stay outside views.
6. Product code is grouped by business domain.
7. Keep existing `src/state/`.
8. No per-module stores.
9. No EventBus.
10. No module repositories unless a real external I/O boundary appears.
11. Keep module folders flat until real size requires another level.
12. CAS migration is already applied and must remain unchanged.

Full approved specification: `docs/REFACTORING_SPEC_V5_LEAN.md`.

---

## Overall flow

```text
PASS 1 — THIS ARCHIVE
Store single source of truth
Shared UI
Bootstrap
Students
Schedule
Payments

        ↓ user applies archive in Work
        ↓ user verifies/commits to GitHub

PASS 2
Reports
Settings
Dashboard
Remove remaining compatibility/progressive layers
CSS cleanup
Dead-code cleanup
Documentation finalization

        ↓ commit

PASS 3
Tests
E2E
Architecture guards
CI
Final audit
```

---

# Pass 1 status

## Stage 1 — store single source of truth

**Implemented.**

New runtime in `src/app/bootstrap.js` has no mutable full-state mirror and no `data → save → commit` snapshot-copy flow.

Persisted changes are performed through:

```js
store.update(...)
store.replace(...)
```

Persistence subscribes to successful store changes.

Relevant files:

```text
src/state/store.js
src/state/persistence.js
src/app/bootstrap.js
```

---

## Stage 2 — shared UI

**Implemented.**

Created:

```text
src/shared/dom.js
src/shared/format.js
src/shared/modal.js
src/shared/dialog.js
src/shared/toast.js
```

These contain generic DOM, formatting, modal, dialog and toast behavior.

---

## Stage 3 — bootstrap

**Implemented.**

Primary composition root:

```text
src/app/bootstrap.js
```

Compatibility entry:

```text
assets/app.js
```

`assets/app.js` is intentionally a thin loader:

```js
import '../src/app/bootstrap.js';
```

The existing `index.html` from the base repository remains unchanged in Pass 1 and continues loading `assets/app.js`.

---

## Stage 4 — students module

**Implemented.**

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

Ownership:

```text
students list
groups
student form
group form
student profile
student history presentation
student deletion
group deletion
custom goals
student recurring schedule orchestration
```

Persisted student/group changes are owned by `students.service.js`.

`profile.view.js` directly renders the final `.profile-redesign` DOM.

The old base `assets/profile-modal.js` is still physically present in the repository during Pass 1 for compatibility. Because the new renderer creates `.profile-redesign` directly, the old enhancement script exits without rebuilding the profile. Delete it in Pass 2 after the remaining legacy layer is removed.

---

## Stage 5 — schedule module

**Implemented.**

```text
src/modules/schedule/
  schedule.view.js
  lesson-form.view.js
  schedule.service.js
  schedule.domain.js
  schedule.selectors.js
  schedule.css
```

Ownership:

```text
calendar
lessons
one-time lessons
recurring schedules
lesson form
event form
move/cancel/complete/delete
schedule conflicts
linked lesson-payment consistency
```

Pure recurring schedule logic moved to:

```text
src/modules/schedule/schedule.domain.js
```

Compatibility import remains:

```text
src/domain/schedule.js
```

and re-exports the new domain module so existing imports can continue working during migration.

Lesson deletion and related payment deletion are one atomic store mutation.

---

## Stage 6 — payments module

**Implemented.**

```text
src/modules/payments/
  payments.view.js
  payment-form.view.js
  payments.service.js
  finances.js
  payments.selectors.js
  payments.css
```

Ownership:

```text
payment page
payment form
record/remove payment
balances
debts
subscriptions
package progress
payment attention state
monthly summary
payment history
```

Pure finance calculation moved to:

```text
src/modules/payments/finances.js
```

Compatibility import remains:

```text
src/domain/finances.js
```

and re-exports the new implementation.

The old base `assets/payments-redesign.js` remains during Pass 1 as compatibility code. Final ownership/removal belongs to Pass 2.

---

# Transitional code intentionally remaining after Pass 1

The following areas are still implemented inside `src/app/bootstrap.js` and are the starting point for Pass 2:

```text
dashboard rendering
settings behavior
backup/import UI orchestration
report builder/model/render
onboarding
tutorial
reminders
navigation/application glue
```

Auth and cloud are intentionally not refactored in Pass 1.

Current CAS behavior remains owned by:

```text
assets/auth.js
src/auth/auth-flow.js
src/cloud/supabase-adapter.js
src/cloud/sync-protocol.js
```

CAS migration is already applied.

---

# Files from the base repository that remain unchanged

When applying this overlay, preserve existing files not included here, including:

```text
index.html
assets/auth.js
assets/styles.css
assets/profile-modal.js
assets/profile-modal.css
assets/payments-redesign.js
assets/payments-redesign.css
assets/reports-redesign.js
assets/reports-redesign.css
assets/custom-select.js
assets/custom-select.css
package-lock.json
tests/
.github/
scripts/
supabase/
README.md
UX_AUDIT.md
existing docs not replaced by this overlay
```

Some compatibility JS listed above is intentionally retained until Pass 2.

---

# Pass 2 — exact continuation point

Continue from the Git commit created after applying this archive.

Implement in this order:

## 1. Reports module

Create final ownership under:

```text
src/modules/reports/
```

Move report builder/model/render and drag/action-bar behavior out of bootstrap and `assets/reports-redesign.js`.

End state:

```text
reports.view.js
reports.model.js
report-drag.js
reports.css
```

Preserve copy text and PNG export.

---

## 2. Settings module

Create:

```text
src/modules/settings/
  settings.view.js
  settings.service.js
  settings.css
```

Move persisted settings mutations out of bootstrap.

---

## 3. Dashboard extraction

Create:

```text
src/modules/dashboard/dashboard.view.js
```

Dashboard remains a read-oriented aggregator and invokes owning services for commands.

---

## 4. Remove compatibility/progressive layer

After Reports/Settings/Dashboard extraction is complete:

- switch the application entry to the final bootstrap path if desired;
- remove the thin `assets/app.js` loader if `index.html` directly loads bootstrap;
- remove `assets/profile-modal.js`;
- remove `assets/payments-redesign.js`;
- remove `assets/reports-redesign.js`;
- remove duplicate listeners/renderers;
- remove transitional report/settings/dashboard functions from bootstrap.

The result of Pass 2 must have one owner per feature.

---

## 5. CSS cleanup

Move large feature-specific CSS into module ownership while keeping shared/base CSS simple.

Do not redesign the UI during this step.

---

## 6. Cleanup/docs

Remove dead imports/functions and update README/architecture docs to final structure.

---

# Tests

No new tests are part of Pass 1 or Pass 2 implementation flow.

Existing tests may be run as diagnostics, but legacy source-contract tests can reference the old `assets/app.js` structure and therefore may require updating later.

The dedicated testing pass is **Pass 3**, after architecture migration is complete.

Pass 3 scope:

```text
unit/integration cleanup
4 critical Playwright smoke flows
lightweight architecture guards
CI finalization
final audit
```

---

# Pass 1 verification already performed

The archive was statically checked for:

```text
JavaScript syntax with node --check
relative import resolution
absence of old full-state mirror pattern in new runtime
absence of direct store.update calls from module *.view.js files
```

No new test suite was authored in this pass.

Manual browser smoke must be performed in Work/local environment after overlay application because this environment has no live browser session against the project.

Critical manual smoke before committing Pass 1:

```text
login
create/edit student
create/edit group
open profile
create one-time lesson
edit/complete/delete lesson
switch calendar views
create payment
package student from mid-month
payment page
report page still opens
settings still save
backup export still works
reload and verify persistence
cloud save status
```

---

# Source-of-truth rule for next LLM

After the user commits this overlay, always read the committed branch from GitHub before continuing.

Do not reconstruct Pass 1 from this document if the committed code differs from the archive. The committed branch is authoritative.
