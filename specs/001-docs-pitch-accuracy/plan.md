# Implementation Plan: Documentation & Pitch Accuracy

**Branch**: `001-docs-pitch-accuracy` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-docs-pitch-accuracy/spec.md`

## Summary

Rewrite the verdict-node README's opening pitch into plain, non-jargon language
while preserving three protected, already-accurate statements (Next.js
fail-open warning, envelope-reconciliation-in-progress statement, alpha
label) and the "downstream enforcement client of verdict-core" framing; hedge
the OmniRoute ecosystem-table entry as an attributed third-party claim; leave
the three verified badges untouched; and track two out-of-scope items
(missing CI badge, `createNextApiHandler` fail-open code defect) as separate,
clearly flagged tasks that this feature's implementation does not resolve.
This is a documentation-only change — no source code, dependencies, or test
framework are touched by this feature's implementable scope.

## Technical Context

**Language/Version**: N/A (Markdown documentation edit only; repository is TypeScript, but no `.ts` source is touched by this feature)

**Primary Dependencies**: N/A — no new dependencies

**Storage**: N/A

**Testing**: Editorial/diff review, not automated unit tests. Verification is a manual/scripted text-diff check confirming protected phrases are present pre- and post-edit (see quickstart.md).

**Target Platform**: GitHub-rendered Markdown (README.md), npm registry package description if applicable

**Project Type**: Library (TypeScript Express/Next.js middleware) — this feature touches only its documentation surface

**Performance Goals**: N/A

**Constraints**: Must not alter the three verified-accurate badges (npm version, TypeScript strict, MIT license) byte-for-byte; must not weaken, remove, or relocate the disclosed Next.js fail-open warning; must not touch production source files (`src/**`)

**Scale/Scope**: Single file primarily (`README.md`); optionally any doc that mirrors the same pitch/badge/ecosystem-table content

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.0.0:

- **Principle I (Downstream Enforcement Client, Not a Peer Product)**: PASS — FR-002 requires the "core decides, node enforces at the HTTP edge" framing be explicit in the rewritten pitch.
- **Principle II (Verifiable Claims Only)**: PASS — FR-006 and FR-011 require the OmniRoute claim be attributed as third-party; no new unverifiable claims are introduced.
- **Principle III (Disclosed Defects Stay Disclosed Until Fixed)**: PASS — FR-003, FR-009, and FR-010 explicitly forbid softening/removing the Next.js fail-open warning and forbid fixing the underlying code defect within this feature (the defect fix is a prerequisite for ever removing the warning, tracked separately).
- **Principle IV (Alpha Status Is Explicit Until Declared Otherwise)**: PASS — FR-005 requires the alpha label be retained at equal or greater prominence.

No violations identified. No entries required in Complexity Tracking.

**Post-Phase-1 re-check**: No design decisions in Phase 1 (below) introduce new constitution risk — the design is a documentation edit plus two tracked-but-deferred tasks, both of which reinforce rather than weaken Principle III. PASS (unchanged).

## Project Structure

### Documentation (this feature)

```text
specs/001-docs-pitch-accuracy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output (validation guide)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

No `data-model.md` or `contracts/` are produced: this feature has no new data
entities, persistence, or external interface contracts — it edits static
Markdown content in an existing file.

### Source Code (repository root)

```text
README.md                        # primary edit target (pitch, ecosystem table, badges)
.github/workflows/ci.yml         # referenced only (CI badge task), not modified by this feature's implementation
src/middleware/next.ts (or similar)  # referenced only for the fail-open defect tracking task; NOT edited by this feature
```

**Structure Decision**: Single-file documentation edit against the existing
repository root (`README.md`). No new directories, packages, or modules are
created. The two out-of-scope tracked tasks (CI badge, fail-open defect)
reference existing files (`.github/workflows/ci.yml`, the Next.js handler
source) for identification purposes only; this feature's tasks.md will mark
those tasks explicitly non-blocking/out-of-scope-for-implementation.

## Complexity Tracking

No constitution violations identified; this section is intentionally empty.
