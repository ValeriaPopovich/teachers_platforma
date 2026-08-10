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

---

# Pass 2 handoff — prepared from GitHub HEAD 851eea1

## Source of truth used for Pass 2

Pass 2 was prepared against the committed branch:

```text
refactor/v5-lean-domain-modules
HEAD 851eea1d4fa0d0e669faf6e39c9db2316d5a6b4b
```

This is important because the originally attached Part 1 archive differed trivially from the committed `src/app/bootstrap.js`. The committed GitHub blob was reconstructed and used as the actual edit base.

Do not apply this Pass 2 overlay onto a different `bootstrap.js` without reviewing the diff first.

## Pass 2 apply model

The archive is an overlay plus `apply_part2.py`. Keep the extracted package outside the repository, switch the repository itself to `refactor/v5-lean-domain-modules` at the expected base HEAD, then run the script with the repository path:

```bash
python3 apply_part2.py /absolute/path/to/teachers_platforma
```

The script performs repository operations that a plain ZIP overlay cannot express safely:

- points `index.html` directly to `src/app/bootstrap.js`;
- removes script references to legacy progressive-enhancement JS;
- moves dedicated feature CSS into module ownership;
- deletes the old compatibility JS/CSS files and thin `assets/app.js` loader.

## Stage 7 — Reports

**Implemented in the overlay.**

```text
src/modules/reports/
  reports.view.js
  reports.model.js
  report-drag.js
  reports.css        # created from assets/reports-redesign.css by apply_part2.py
```

Ownership moved out of `src/app/bootstrap.js` and `assets/reports-redesign.js`:

- student/period selection;
- report source/model;
- topics/tests/homework rows;
- included blocks;
- preview rendering;
- copy text;
- PNG export;
- accordion behavior;
- row drag/reorder;
- row counters/empty states;
- fixed report action bar.

The old content-watching `MutationObserver` architecture is removed. Report rows are created with their final drag handle markup, and the reports module calls its interaction helpers directly after mutations.

`ResizeObserver` is retained only for layout sizing of the fixed action bar; it is not a progressive DOM renderer.

## Stage 8 — Settings

**Implemented.**

```text
src/modules/settings/
  settings.view.js
  settings.service.js
  settings.css
```

Persisted commands now belong to `settings.service.js`:

- theme toggle;
- sidebar compact toggle;
- tutor/reminder save;
- onboarding tutor-name persistence.

`settings.view.js` applies theme/sidebar UI and renders the account metadata supplied by the existing cloud/auth layer. Auth/logout state is not moved into settings domain ownership.

## Stage 9 — Dashboard

**Implemented.**

```text
src/modules/dashboard/dashboard.view.js
```

Dashboard is a read-oriented aggregator. It reads schedule selectors and delegates lesson opening to the owning schedule view rather than mutating lesson state itself.

## Stage 10 — compatibility/progressive cleanup

**Applied by `apply_part2.py`.**

Removed after ownership migration:

```text
assets/app.js
assets/profile-modal.js
assets/payments-redesign.js
assets/reports-redesign.js
```

`index.html` loads `src/app/bootstrap.js` directly.

The payments module receives Home/End keyboard tab behavior before `assets/payments-redesign.js` is removed, so the useful accessibility behavior is not lost.

`assets/profile-modal.js` is safe to remove because Part 1 `profile.view.js` already renders the final `.profile-redesign` tree itself; the legacy enhancer explicitly exited when that tree was present.

## Stage 11 — CSS cleanup

**Safe ownership cleanup implemented for the dedicated legacy feature styles.**

`apply_part2.py` moves content without redesign:

```text
assets/profile-modal.css      -> src/modules/students/students.css
assets/payments-redesign.css  -> src/modules/payments/payments.css
assets/reports-redesign.css   -> src/modules/reports/reports.css
```

and rewrites the corresponding stylesheet links in `index.html`.

`assets/styles.css` remains the shared/base stylesheet and still contains some historically mixed layout/feature selectors. They were not heuristically split in this pass because doing so without browser visual regression coverage would be a destructive CSS rewrite. This is documented residual cleanup, not duplicate JS ownership.

## Stage 12 — dead code / docs cleanup

**Implemented for the migrated areas.**

Removed from bootstrap:

- dashboard renderer/listeners;
- settings renderer/listeners/direct mutations;
- report builder/model/render/copy/export/listeners;
- report page special-case refresh.

`src/app/bootstrap.js` is reduced to composition, navigation/application glue, backup/import UI orchestration, onboarding/tutorial shell, maintenance and reminder runtime orchestration.

Updated:

```text
README.md
REFACTOR_FLOW.md
PASS2_MANIFEST.json
```

README now states that CAS is already applied rather than instructing the next developer to apply it again.

## Transitional code intentionally still in bootstrap

These are not feature ownership violations and were intentionally not over-abstracted in Pass 2:

```text
navigation/application glue
backup/import UI orchestration
tutorial shell
maintenance bootstrap call
runtime notification timer
```

Onboarding persistence itself goes through `settingsService.completeOnboarding(...)`.

## Pass 2 verification performed in archive build

Static checks:

```text
node --check for changed/new JS
relative import resolution for the overlay against the Part 1 tree
no store.update/store.replace calls in *.view.js
no MutationObserver in src/modules/reports/
no report/settings/dashboard legacy functions in the new bootstrap
bootstrap built from GitHub blob SHA 5193f459076163be4b13c16ea92507192812f2f6
```

Existing tests are diagnostic only at this stage. No new test infrastructure is authored in Pass 2.

## Manual smoke required after applying Part 2

Critical browser smoke:

```text
login
navigation between all pages
create/edit student and group
open profile and profile history
create/edit/complete/delete lesson
calendar views
payments tabs including keyboard Left/Right/Home/End
create/remove payment
reports: select student + each period
reports: custom date range
reports: add/remove/reorder topic/test/homework rows
reports: enable/disable blocks
reports: copy text
reports: save PNG
reports: fixed action bar desktop + mobile width
settings: tutor/reminder save
settings: theme toggle from sidebar and profile
sidebar compact toggle
backup export/import
reload persistence
cloud save/conflict status
```

## Exact continuation point — Pass 3

After the user applies, smokes and commits Pass 2, start from that new Git commit and perform the dedicated testing/finalization pass:

```text
1. inspect/update legacy source-contract tests that still expect assets/app.js
2. unit/integration cleanup around the final module locations
3. add 4–8 critical Playwright E2E flows
4. add lightweight architecture guards
5. CI finalization
6. final architecture/dead-code/docs audit
```

Do not reintroduce feature renderers into bootstrap to satisfy old structural tests. Update tests to the final architecture instead.

---

# Pass 3 — Stabilization, Tests & Final Architecture Audit

Prepared from committed GitHub source of truth:

```text
branch: refactor/v5-lean-domain-modules
base HEAD: 8e6dc428180ff60ed7e4a741252d88ccbbb0986f
Part 2 commit: refactor: implement lean domain modules pass 2
```

## Stage 13 — post-refactor architecture audit

Audit findings from the committed Part 2 tree:

1. Legacy progressive-enhancement JS is actually removed and `index.html` loads `src/app/bootstrap.js` directly.
2. `bootstrap.js` is application/composition glue; feature renderers for students/schedule/payments/reports/settings/dashboard are no longer embedded there.
3. `src/modules/schedule/schedule.view.js` still exposed an unused `extendSchedules()` command that called `store.replace(...)` directly from a View. Pass 3 removes that method so feature views remain read/UI-only with persisted commands owned outside the View boundary.
4. The Part 2 lesson form lost the old UI guard that prevented editing an existing lesson into another student/group. Pass 3 restores the locked target control while explicitly preserving `targetId` during form serialization.
5. The Part 2 payments view dropped the established long-list limits/reveal controls and used markup classes that no longer matched the moved payments CSS. Pass 3 restores the 6/8/6/10 list limits, “Показать ещё”, and aligns row/history markup with module-owned CSS.
6. No `MutationObserver` rendering architecture remains in final feature modules. Reports keep only `ResizeObserver` for action-bar layout sizing.

## Stage 14 — existing tests cleanup

The first CI run on Part 2 HEAD failed only in stale source-contract suites that still attempted to read deleted legacy assets:

```text
assets/app.js
assets/profile-modal.js
assets/payments-redesign.js
assets/reports-redesign.js
```

`lint` and `validate:stage0` were green. The stale tests are rewritten against final module ownership instead of restoring deleted compatibility code.

Updated source-contract suites:

```text
tests/accessibility-guard.test.js
tests/finances-inline-parity.test.js
tests/inline-backup-fixes.test.js
tests/payments-redesign-contract.test.js
tests/profile-modal-contract.test.js
tests/reports-redesign-contract.test.js
tests/ui-boundaries.test.js
```

Useful domain/unit tests are preserved.

## Stage 15 — architecture guards

Added `tests/architecture-guards.test.js` with lightweight checks for the critical architecture rules:

- deleted progressive-enhancement JS stays deleted;
- `index.html` points directly to `src/app/bootstrap.js`;
- feature `*.view.js` files cannot call `store.update()` / `store.replace()`;
- feature views cannot import/use Supabase adapter directly;
- `src/shared/` cannot depend on feature/domain modules;
- bootstrap cannot regrow old feature renderers/global mutable mirror;
- `MutationObserver` cannot reappear as feature rendering architecture.

No AST framework or custom linter was introduced.

## Stage 16 — critical E2E

Playwright Chromium coverage is intentionally small and release-oriented:

```text
1. student lifecycle + edit + reload persistence
2. lesson lifecycle + owner lock + reload persistence
3. single payment + reload persistence
4. package billing calculation
5. reports builder + preview + clipboard text
6. backup export
```

Files:

```text
playwright.config.js
tests/e2e/helpers.js
tests/e2e/critical-flows.e2e.js
scripts/serve-static.mjs
```

Auth/cloud/CDN infrastructure is stubbed only inside browser tests; production code is unchanged.

## Stage 17 — CI finalization

CI now uses Node 24 and runs:

```text
npm install
npm run lint
npm run validate:stage0
npm test
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm test` already includes architecture guards, so CI does not run the same guard suite twice.

## Stage 18 — final docs/dead-code pass

Updated `README.md` to document final ownership, release gates, architecture guards, Playwright E2E and the already-applied CAS state.

No framework migration, DB normalization or UI redesign is part of this pass.

## Verification after applying this archive

Run from repository root:

```bash
npm install
npm run lint
npm run validate:stage0
npm test
npx playwright install chromium
npm run test:e2e
```

Then inspect:

```bash
git diff --check
git status --short
git diff --stat
```

If all checks are green, commit Part 3 on `refactor/v5-lean-domain-modules`. Do not push directly to `main`.

## Continuation point

After Part 3 is committed and CI is green, the refactor branch is ready for a full manual smoke against real auth/cloud behavior and then a deliberate PR/merge decision. Future work such as Supabase JSON normalization is separate from this architecture pass.

## Stage 19 — SCSS and refactoring toolchain

- SCSS sources live in `styles/core`, `styles/components` and `styles/features` with one entry at `styles/entries/main.scss`.
- Feature partials use Sass nesting under one feature root instead of repeating `#page-*` selectors.
- `npm run styles:build` generates the single `assets/styles.css` deploy artifact consumed directly by GitHub Pages; legacy module CSS outputs stay deleted.
- `npm run styles:check` verifies that committed CSS is fresh without modifying the worktree.
- Stylelint validates SCSS, while ESLint and Prettier cover JavaScript and configuration files.
- Knip reports unused files and dependencies; dependency-cruiser enforces module boundaries and rejects circular dependencies.
- `npm run check` provides the local non-browser quality gate. Critical Playwright E2E remains a separate command because it requires Chromium.
