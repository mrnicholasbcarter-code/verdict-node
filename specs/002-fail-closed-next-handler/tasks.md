---
description: "Task list for 002-fail-closed-next-handler"
---

# Tasks: Fail-closed after policy refusal

> **Status (reconciled 2026-09-24):** Delivered.
> - Handler fix and regression tests: PR #67 (merged 2026-09-13), `src/index.ts` `nextApiHandler()`.
> - README/ADR-001 reconciliation: PR #68 (2026-09-13) and PR #78 (2026-09-24).
> - Evidence on `master`: the 12 fail-closed tests in `tests/router.test.ts` pass (503 for unavailable, denied, timeout, invalid payload and missing endpoint; no forwarding without an envelope; ladder-model recheck; policy-digest mismatch).
> - Still open, not in this spec: end-to-end parity with a published Core `ExecutionEnvelope` (NOD-002 / ADR-001).
>
> Checkboxes below are the original plan and were not ticked during delivery. Use the evidence above as the record.

**Input**: Design documents from `/specs/002-fail-closed-next-handler/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Spec FR-003/FR-006 require regression tests. Write them first and confirm they fail where the bypass still exists.

**Organization**: One writer in this worktree. Do not edit the main checkout's dirty `feat/nod002-parity-gate` branch. Do not rewrite README until US1+US3 tests are green.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/index.ts`, `src/middleware/forwarder.ts`, `tests/router.test.ts`, `README.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm isolation and current tests

- [ ] T001 Record HEAD and confirm this worktree is `002-fail-closed-next-handler` tracking `origin/master` in `specs/002-fail-closed-next-handler/quickstart.md` (do not write the dirty main checkout)
- [ ] T002 Run `npm test -- tests/router.test.ts` in this worktree and note which Next.js 503 cases already pass

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared spy pattern for “zero `/chat/completions` fetches”

- [ ] T003 Add a shared fetch-spy helper in `tests/router.test.ts` that records `/chat/completions` calls for all later refusal/bypass tests

**Checkpoint**: Helper exists. User stories can start.

---

## Phase 3: User Story 1 - Refused requests stay refused (Priority: P1) 🎯 MVP

**Goal**: Five refusal cases return the refusal and never forward upstream.

**Independent Test**: `npm test -- tests/router.test.ts` — timeout, invalid payload, and no endpoint cases 503 (or existing refusal) with zero `/chat/completions` fetches. Unavailable and denied stay green.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation if the bypass still exists**

- [ ] T004 [US1] Add failing or documenting tests in `tests/router.test.ts` for policy timeout, invalid decision payload, and no decision endpoint (zero `/chat/completions`)
- [ ] T005 [US1] Confirm existing unavailable and denied tests in `tests/router.test.ts` still assert zero `/chat/completions`

### Implementation for User Story 1

- [ ] T006 [US1] Stop continuation after a refusal in `src/index.ts` (`nextApiHandler` must not call `proxy` if middleware returned false or a refusal was already written)
- [ ] T007 [US1] Re-run `npm test -- tests/router.test.ts` and confirm T004–T005 pass and the existing allow-path test still forwards (HTTP 200 to `/chat/completions` when policy allows)

**Checkpoint**: All five FR-002 cases refuse with zero upstream forwards.

---

## Phase 4: User Story 2 - Disclosure stays until the fix is proven (Priority: P1)

**Goal**: README warning remains until US1+US3 tests are green; then rewrite to match fail-closed.

**Independent Test**: README still contains the critical-limitation language until T012. After T012, warning is replaced, alpha and envelope-reconciliation remain.

### Implementation for User Story 2

- [ ] T008 [US2] Confirm `README.md` still contains the `createNextApiHandler` critical-limitation / critical-defect paragraphs (do not edit yet)
- [ ] T012 [US2] After T007 and T011 are green, rewrite those paragraphs in `README.md` and the matching paragraph in `docs/adr/ADR-001-execution-envelope-enforcement.md` to fail-closed language; keep alpha and “still being reconciled”

**Checkpoint**: Docs match proven behavior. Warning was not removed early.

---

## Phase 5: User Story 3 - Every found bypass is closed (Priority: P1)

**Goal**: Missing envelope, un-rechecked local model, missing integrity evidence, and any new bypass found while fixing are closed with tests.

**Independent Test**: Default-path tests refuse or recheck; `/chat/completions` is not called around policy.

### Tests for User Story 3

- [ ] T009 [US3] Add tests in `tests/router.test.ts` that the default path does not forward without an envelope
- [ ] T010 [US3] Add tests in `tests/router.test.ts` that a locally substituted ladder model is rechecked against the envelope or refused
- [ ] T016 [US3] Add a test in `tests/router.test.ts` that missing independent integrity / policy-digest evidence on the default path refuses and does not call `/chat/completions`

### Implementation for User Story 3

- [ ] T011 [US3] Close envelope, ladder-recheck, and integrity-evidence bypasses in `src/index.ts` (reuse helpers from `src/middleware/forwarder.ts` where they already exist); if a new bypass appears, add a test in `tests/router.test.ts` and close it in this lane. Depends on T009, T010, T016.

**Checkpoint**: FR-006 satisfied. Then T012 (README).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T013 Run `npm test` in this worktree
- [ ] T014 Follow `specs/002-fail-closed-next-handler/quickstart.md` end to end
- [ ] T015 Confirm `specs/001-docs-pitch-accuracy/` was not rewritten as a substitute for this fix

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup → Foundational → US1 (MVP) → US3 → US2 (T012 last) → Polish
- T008 (read-only README check) can run anytime after Setup
- T012 depends on T007 and T011
- T016 before T011 (integrity-evidence test first)

### User Story Dependencies

- **US1**: After T003. MVP.
- **US3**: After T003; can overlap T004 writing but `src/index.ts` is one writer
- **US2 T012**: After US1+US3 tests green

### Parallel Opportunities

- T004 and T009 on the same file `tests/router.test.ts` — sequential, not [P]
- One writer. Do not parallelize two edits to `src/index.ts`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001–T003
2. T004–T007 five refusal cases
3. Stop and confirm zero `/chat/completions` on refuse

### Incremental Delivery

1. US1 refuse-then-stop
2. US3 remaining bypasses
3. US2 README last
4. Full `npm test`

---

## Notes

- [P] unused: same-file conflicts
- Next command: `/speckit-analyze`, then `/speckit-implement` (custom checklist `fail-closed.md` is still unchecked until a reviewer ticks it)
