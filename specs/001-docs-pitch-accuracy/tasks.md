# Tasks: Documentation & Pitch Accuracy

**Input**: Design documents from `/specs/001-docs-pitch-accuracy/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: This is a documentation-only feature; "tests" are editorial/diff
verification steps (see quickstart.md), not automated unit tests. Verification
tasks are included per user story since the spec requires provable
non-regression of protected statements.

**Organization**: Tasks are grouped by user story (US1 = pitch rewrite, US2 =
OmniRoute attribution, US3 = CI badge nice-to-have), plus a separate,
non-implementable tracked task for the out-of-scope code defect.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Capture baseline snapshot of `/home/nick/dev/verdict-node/README.md` for before/after comparison (`git show HEAD:README.md > /tmp/readme-before.md`), per quickstart.md Step 1.
  **Acceptance Criteria**:
  - `/tmp/readme-before.md` exists and is byte-identical to the current committed `README.md`.
  - The snapshot is taken before any edit in this feature begins.
  - The snapshot file is not committed to the repository (scratch artifact only).

---

## Phase 2: Foundational

**Purpose**: Establish the exact set of protected strings/sections that every downstream task must preserve. This MUST be complete before any User Story edit begins.

- [ ] T002 Identify and record the exact line ranges in `README.md` for: (a) the opening pitch/title/tagline block, (b) the Next.js fail-open disclosure, (c) the envelope-reconciliation statement, (d) the alpha status label, (e) the badge row (npm/TypeScript/license), (f) the OmniRoute row in the ecosystem table.
  **Acceptance Criteria**:
  - A written note (in the PR description or a scratch file, not committed) lists line numbers/anchors for all six items above as they exist in the pre-edit README.
  - Every protected item from spec.md (FR-003, FR-004, FR-005, FR-007) has a corresponding recorded location.
  - No line range overlaps incorrectly (e.g., pitch block correctly excludes the badge row).

**Checkpoint**: Foundation ready — all protected content is located and recorded; edits in Phase 3+ can proceed without accidentally overwriting protected text.

---

## Phase 3: User Story 1 - Approachable, Accurate Pitch (Priority: P1) 🎯 MVP

**Goal**: Replace the jargon-heavy opening pitch with the plain-language rewrite while preserving the Next.js fail-open warning, the envelope-reconciliation statement, the alpha label, and the "core decides, node enforces" framing.

**Independent Test**: Read only the rewritten opening section of `README.md` and confirm a non-technical reader can state the library's purpose and its relationship to verdict-core, and that all four protected statements are present and unweakened.

### Implementation for User Story 1

- [ ] T003 [US1] Rewrite the title/tagline/opening paragraph(s) of `/home/nick/dev/verdict-node/README.md` using the drafted plain-language pitch as the basis, lightly copy-edited for flow.
  **Acceptance Criteria**:
  - The rewritten text explains, before or alongside any jargon term, that verdict-node is an Express/Next.js middleware library that checks requests against a safety envelope before forwarding them.
  - The rewritten text explicitly states the "core decides, node enforces at the HTTP edge" relationship to verdict-core (FR-002), using materially equivalent plain language if not verbatim.
  - No jargon term (ExecutionEnvelope, fail-closed, policy digest, canonical routing contract) appears without an adjacent plain-language explanation.
  - The rewrite does not exceed the scope of the pitch block identified in T002 (does not bleed into or alter the badge row or ecosystem table).
  - A second reviewer, given only the new pitch text, can correctly summarize the library's purpose and its relationship to verdict-core in 1-2 sentences (SC-001).

- [ ] T004 [US1] Verify and, if necessary, re-integrate the Next.js fail-open disclosure into the rewritten pitch/README section so it remains present and equally prominent.
  **Acceptance Criteria**:
  - `grep -i "fail-closed\|fail-open"` against the post-edit `README.md` returns at least one match (quickstart.md Step 3).
  - The disclosure's section-level visibility (heading level, position relative to the fold) is equal to or greater than in `/tmp/readme-before.md` — it is not demoted to a footnote, collapsed section, or removed.
  - The disclosure's meaning is unchanged: it still communicates that the Next.js path can forward a request after a denial and should not be treated as a complete safety guarantee.
  - This task blocks T003 sign-off: T003 cannot be marked complete until this task's grep check passes.

- [ ] T005 [US1] Verify the envelope-reconciliation statement ("still being reconciled") survives the rewrite unchanged in substance.
  **Acceptance Criteria**:
  - `grep -i "reconcil"` against the post-edit `README.md` returns at least one match (quickstart.md Step 3).
  - The claim itself (cross-language contract reconciliation is incomplete) is neither strengthened (e.g., claiming full parity) nor removed; wording may be smoothed but meaning is preserved (FR-004).
  - A reviewer comparing `/tmp/readme-before.md` and the post-edit README confirms no change in the factual claim, only optional wording polish.

- [ ] T006 [US1] Verify the "Alpha — not production-ready" label (or equivalent) remains present and at least as prominent.
  **Acceptance Criteria**:
  - `grep -i "alpha"` against the post-edit `README.md` returns at least one match (quickstart.md Step 3).
  - The label's position (e.g., top-of-README badge or callout) is not moved to a less visible location.
  - No new or edited copy anywhere in the pitch section implies production readiness (FR-005).

**Checkpoint**: At this point, the README's pitch is rewritten, plain-language, and every protected statement is verified present. This story is independently mergeable as the MVP of this feature.

---

## Phase 4: User Story 2 - Correctly Attributed Third-Party Claim (Priority: P2)

**Goal**: Hedge the OmniRoute ecosystem-table entry so its "250+ providers, 90+ free tiers" claim is unambiguously attributed to OmniRoute, not stated as this repo's own fact.

**Independent Test**: Read only the OmniRoute row of the ecosystem table and confirm a reader can tell the figures are OmniRoute's own claim about itself.

### Implementation for User Story 2

- [ ] T007 [US2] Edit the OmniRoute row in `README.md`'s ecosystem/comparison table (originally at or near line 234) to add an explicit third-party attribution marker.
  **Acceptance Criteria**:
  - The edited row contains unambiguous attribution language (e.g., "per OmniRoute," "OmniRoute-reported," or a footnote/citation naming OmniRoute as the source of the "250+ providers, 90+ free tiers" figures) (FR-006).
  - A second reviewer reading only this row agrees, without prompting, that the figures are an external claim and not verified/owned by this repository (SC-003).
  - No other cell in the same table row (e.g., project name, one-line description) is altered beyond what is needed for the attribution.
  - The numeric figures themselves ("250+", "90+") are not changed, invented, or independently verified as part of this task — only their attribution is added.

- [ ] T008 [P] [US2] Confirm the verdict-node and verdict-cockpit rows of the same ecosystem table are unchanged by the T007 edit.
  **Acceptance Criteria**:
  - `diff` of the verdict-node and verdict-cockpit table rows between `/tmp/readme-before.md` and the post-edit README shows no differences.
  - Only the OmniRoute row differs between before/after in this table (FR-006 scope discipline).

**Checkpoint**: OmniRoute claim is now correctly attributed; User Stories 1 and 2 together form a coherent, independently verifiable accuracy pass.

---

## Phase 5: User Story 3 - Missing CI Badge Noted as Optional Improvement (Priority: P3)

**Goal**: Track the missing CI status badge as an explicit, non-blocking nice-to-have without touching the three already-accurate badges.

**Independent Test**: Confirm a task exists describing the missing CI badge as optional, and that no task in this feature proposes changing the npm/TypeScript/license badges.

### Implementation for User Story 3

- [ ] T009 [P] [US3] [OPTIONAL / NON-BLOCKING] Add a CI status badge to the badge row of `README.md`, referencing `.github/workflows/ci.yml`.
  **Acceptance Criteria**:
  - If implemented: the new badge follows the same badge format/style as the existing three badges and links to the actual CI workflow's status page.
  - The three existing badges (npm version, TypeScript strict, MIT license) remain byte-for-byte unchanged (`diff` against `/tmp/readme-before.md` shows no change to those three specific badge lines) (FR-007, SC-004).
  - This task is explicitly optional: the feature is considered complete and mergeable whether or not T009 is implemented. It MUST NOT block sign-off of User Stories 1 or 2.
  - If not implemented in this pass, this task remains open and is carried forward as a standalone backlog item, not silently dropped.

**Checkpoint**: All three user stories addressed. CI badge task can ship now or be deferred without affecting the rest of the feature.

---

## Tracked, Out-of-Scope Task: `createNextApiHandler` Fail-Open Code Defect

> **PRIORITY FLAG: needs separate prioritized attention — DO NOT implement here.**
> This task exists for tracking and visibility only. It is intentionally
> given **zero implementation subtasks** in this docs-only feature. Per
> spec.md FR-009/FR-010 and constitution Principle III, fixing this defect
> requires its own feature (spec → plan → tasks → implement), including a
> regression test proving the Next.js path becomes fail-closed. This
> feature's documentation changes MUST NOT be blocked on, nor silently
> resolve, this defect — and MUST NOT soften the existing disclosure of it
> (see T004).

- [ ] T010 **[CODE-DEFECT] [priority: needs separate prioritized attention]** File/confirm a tracked follow-up for the `createNextApiHandler` fail-open bug (continues to call `proxy()` after a 503 denial instead of short-circuiting), to be scheduled as its own spec-kit feature.
  **Acceptance Criteria**:
  - A GitHub issue (or equivalent tracked item) exists describing: the exact defect (fail-open on 503 denial in the Next.js integration path), its safety impact (documented integration path does not actually guarantee fail-closed behavior), and that it requires a code fix plus a regression test.
  - The issue/task is labeled or flagged in a way that is visibly distinct from the docs-accuracy tasks (e.g., a `bug`/`P0`/`P1` label, or explicit "code defect — not a docs task" note).
  - This task's acceptance is satisfied by the existence of a properly flagged tracking item — it does NOT require or permit any code change to `createNextApiHandler`, `middleware()`, `proxy()`, or any file under `src/` as part of this feature.
  - The disclosed warning in `README.md` (verified surviving via T004) continues to reference this defect accurately after this feature merges.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T011 [P] Run the full quickstart.md validation sequence (Steps 3-7) against the final edited `README.md` and record results.
  **Acceptance Criteria**:
  - All grep checks in quickstart.md Step 3 pass (fail-open/fail-closed, reconcil, alpha all present).
  - Badge diff check (Step 4) shows zero differences on the three protected badges.
  - OmniRoute attribution read-through (Step 5) is confirmed by a reviewer other than the editor.
  - Plain-language comprehension check (Step 6) is confirmed by at least one reviewer unfamiliar with the project's jargon.
  - Source-file diff check (Step 7) confirms zero files under `src/` were modified (SC-006).

- [ ] T012 Final diff review of all changes to `README.md` against `/tmp/readme-before.md`, confirming every change traces to FR-001 through FR-007 or FR-011, and that only T009 (if implemented) and no other unrelated edits are present.
  **Acceptance Criteria**:
  - Every hunk in the diff is attributable to a specific FR from spec.md.
  - No hunk touches content outside the pitch block, OmniRoute row, or badge row (unless it is whitespace-only/incidental).
  - The diff is attached to or summarized in the pull request description for reviewer sign-off (SC-005).

---

## Dependencies & Execution Order

- **Setup (T001)**: No dependencies.
- **Foundational (T002)**: Depends on T001; blocks all user story tasks.
- **User Story 1 (T003-T006)**: Depends on Foundational. T004, T005, T006 are verification gates on T003 and should be run immediately after T003's edit, before moving to US2.
- **User Story 2 (T007-T008)**: Depends on Foundational; independent of US1's content but conventionally sequenced after US1 since both land in the same file/PR.
- **User Story 3 (T009)**: Depends on Foundational; fully independent and optional; may be skipped without affecting US1/US2 sign-off.
- **Tracked defect (T010)**: No implementation dependency on any other task; can be filed at any point, but is listed after the user stories to emphasize it is not part of the docs deliverable.
- **Polish (T011-T012)**: Depends on completion of US1 and US2 (US3/T010 optional inputs).

### Parallel Opportunities

- T008 [P] can run in parallel with T007's review once the OmniRoute edit is drafted (T008 only inspects unrelated rows).
- T009 [P] (CI badge) can be done at any time in parallel with US1/US2 work since it touches a different part of the badge row.
- T011 [P] can run in parallel with T010 (filing the tracked defect) since they are unrelated verification vs. tracking activities.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) and Phase 2 (T002).
2. Complete Phase 3 (T003-T006) — the pitch rewrite with all protections verified.
3. **STOP and VALIDATE**: Run quickstart.md Steps 3 and 6 against the US1-only change.
4. This alone is mergeable as the MVP: it delivers the highest-value fix (SC-001, SC-002) independently of US2/US3.

### Incremental Delivery

1. Setup + Foundational → protected-content map ready.
2. US1 (pitch rewrite) → validate → mergeable MVP.
3. US2 (OmniRoute attribution) → validate → merge/extend same PR or follow-up.
4. US3 (CI badge) → optional, non-blocking → merge whenever convenient.
5. File T010 (tracked code defect) at any point; it never blocks 1-4.
6. Polish (T011-T012) once US1+US2 are both in.

## Notes

- No `[P]` marker on T003-T007 individually where they edit the same file/region sequentially, to avoid conflicting edits to `README.md`.
- T010 is deliberately excluded from the Dependencies graph as a blocker — it is tracked, not scheduled, within this feature.
- Total tasks: 12 (T001-T012), of which T010 is explicitly out-of-scope-for-implementation and T009 is explicitly optional/non-blocking.

## Issue mirror

| Task | GitHub Issue |
|------|-------------|
| T001 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/52 |
| T002 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/53 |
| T003 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/54 |
| T004 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/55 |
| T005 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/56 |
| T006 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/57 |
| T007 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/58 |
| T008 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/59 |
| T009 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/60 |
| T010 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/51 (pre-existing) |
| T011 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/61 |
| T012 | https://github.com/mrnicholasbcarter-code/verdict-node/issues/62 |
