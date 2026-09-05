# Phase 0 Research: Documentation & Pitch Accuracy

No `NEEDS CLARIFICATION` markers remain in the Technical Context — this is a
documentation-only feature with no unresolved technology choices. This file
records the small number of judgment calls made while scoping the plan.

## Decision: Treat this as a documentation-only feature (no code changes)

- **Decision**: Implementation scope is limited to Markdown documentation
  (primarily `README.md`); the `createNextApiHandler` fail-open defect is
  tracked as a task but explicitly excluded from this feature's
  implementable work.
- **Rationale**: The originating audit already separated the two concerns
  (docs accuracy vs. a real code defect); conflating them would let a
  docs-cleanup pass silently absorb or bury a safety-relevant bug fix, which
  the project constitution (Principle III) forbids.
- **Alternatives considered**: Bundling the code fix into this feature was
  considered and rejected — it would inflate scope, mix a safety-critical
  code change into a low-risk documentation PR, and make the docs change
  harder to review and revert independently.

## Decision: Verification method is text/diff review, not unit tests

- **Decision**: "Tests" for this feature are a before/after text comparison
  confirming protected phrases (fail-open warning, reconciliation statement,
  alpha label, three badges) are present and unweakened, plus a manual
  read-through for the OmniRoute attribution clarity.
- **Rationale**: There is no runtime behavior to unit-test; the deliverable
  is static prose. A diff-based check is the most direct, low-overhead way
  to enforce the "must not remove/soften" constraints from the spec.
- **Alternatives considered**: A markdown-linting script that greps for the
  exact protected strings was considered as a stronger automated gate;
  documented as an optional follow-up in quickstart.md rather than a hard
  requirement, since exact-string matching would break on any legitimate
  copy-edit and create false failures.

## Decision: "Related docs" scope boundary

- **Decision**: In-scope docs are `README.md` and any file it directly
  duplicates content from (pitch, badges, ecosystem table); out of scope is
  any unrelated documentation that doesn't repeat these specific claims.
- **Rationale**: Keeps the feature bounded and matches the audit's findings,
  which were all located in `README.md`.
- **Alternatives considered**: A repo-wide documentation sweep was
  considered and rejected as out of scope — no audit evidence indicates the
  same inaccuracies exist elsewhere.
