# Implementation Plan: Fail-closed after policy refusal

**Branch**: `002-fail-closed-next-handler` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-fail-closed-next-handler/spec.md`

## Summary

Stop the higher-level handler from forwarding after a policy refusal, and close every remaining default-path bypass (missing envelope, un-rechecked local model, missing integrity evidence, plus any found during the fix). Tests first. README disclosure last.

## Technical Context

**Language/Version**: TypeScript, Node.js >= 18

**Primary Dependencies**: Existing `@bodanglin/verdict-node` library (`src/index.ts` handler + `src/middleware/forwarder.ts` envelope checks)

**Storage**: N/A

**Testing**: Jest (`npm test -- tests/router.test.ts`)

**Target Platform**: Node HTTP adapter (Express and Next-style handler)

**Project Type**: TypeScript library

**Performance Goals**: N/A — correctness of refuse vs forward

**Constraints**: Fail-closed; constitution I/III/IV; clarify C (every found bypass); isolated worktree; no dirty `feat/nod002-parity-gate` writes

**Scale/Scope**: One public handler factory, proxy continuation, envelope/ladder checks, README paragraphs after green tests

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Downstream enforcement client | Pass | Handler enforces Core decisions; does not become a peer router |
| II. Verifiable claims | Pass | README rewrite only after tests prove fail-closed |
| III. Disclosed defects stay disclosed | Pass | Warning remains until FR-001/FR-003/FR-006 tests green |
| IV. Alpha until declared | Pass | Alpha label stays |

Post-Phase 1: still pass. Design does not hide the defect in docs first.

## Project Structure

### Documentation (this feature)

```text
specs/002-fail-closed-next-handler/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/handler-continuation.md
└── tasks.md             # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
src/index.ts                 # nextApiHandler, middleware, proxy
src/middleware/forwarder.ts  # envelope helpers to reuse
tests/router.test.ts         # extend Next.js /api compatibility
README.md                    # last, after tests
docs/adr/ADR-001-*.md        # align defect paragraph after tests
```

**Structure Decision**: No new packages. Fix continuation and default-path enforcement in the existing handler.

## Complexity Tracking

> No constitution violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
