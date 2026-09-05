# Feature Specification: Documentation & Pitch Accuracy

**Feature Branch**: `001-docs-pitch-accuracy`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Fix documentation/pitch accuracy for verdict-node README and related docs, based on a completed read-only audit (plain-language pitch rewrite preserving disclosed Next.js fail-open warning and the accurate 'still being reconciled' envelope-contract statement; hedge the third-party OmniRoute claim as attributed, not owned; optionally note missing CI badge; track the createNextApiHandler fail-open code defect as a separate, non-blocking, prioritized-attention tracked task, out of scope for this docs feature)."

## Clarifications

### Session 2026-09-05

- No critical ambiguities found. Full taxonomy scan performed (functional scope, data model, interaction/UX, non-functional quality, integrations, edge cases, constraints/tradeoffs, terminology, completion signals, misc placeholders) against this spec's FR-001–FR-011, Assumptions, and Success Criteria. All categories were Clear or explicitly resolved by the existing Assumptions section (audit treated as ground truth, "related docs" scope boundary, rewrite-basis handling, "prioritized attention" meaning for the deferred code-defect task, editorial-not-runtime testing framing). No question would materially change task decomposition, architecture, or test design for this documentation-only feature. Proceeding to implementation without further questions is appropriate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approachable, Accurate Pitch for a New Evaluator (Priority: P1)

A developer evaluating verdict-node for the first time reads the README's opening pitch and immediately understands, in plain language, what the library does, how it relates to verdict-core, and what its current limitations are — without needing to already know terms like "execution envelope" or "fail-closed."

**Why this priority**: The pitch is the first thing every reader sees. An inaccurate or jargon-heavy pitch either misleads readers about safety guarantees or turns away readers who could otherwise adopt or evaluate the project correctly. This is the highest-value, most visible fix.

**Independent Test**: Can be fully tested by reading only the README's opening section (title, tagline, first descriptive paragraph) and confirming: (1) a non-technical reader can state in their own words what the library does and how it relates to verdict-core, (2) the Next.js fail-open warning is present and no less prominent than before the rewrite, (3) the "still being reconciled" envelope-contract statement is unchanged in substance, (4) verdict-node is described as verdict-core's downstream enforcement client, never as an independent product.

**Acceptance Scenarios**:

1. **Given** the current README pitch uses jargon ("ExecutionEnvelope," "fail-closed," "policy digest," "canonical routing contract") without plain-language grounding, **When** the pitch is rewritten, **Then** the opening section explains the library's purpose in plain language before or alongside any technical term, such that a reader unfamiliar with the jargon can still understand the library's purpose and relationship to verdict-core.
2. **Given** the README currently discloses that the Next.js integration path is not fail-closed, **When** the pitch section is rewritten for approachability, **Then** the disclosure of the Next.js fail-open bug remains present, equally prominent (same section-level visibility, not demoted to a footnote or removed), and equally clear in meaning.
3. **Given** the README currently states the cross-language (Python/TypeScript) envelope contract "is still being reconciled," **When** the pitch is rewritten, **Then** this statement's substance is preserved unchanged (wording may be smoothed for plain language but the claim itself — reconciliation is incomplete — is not altered, strengthened, or removed).
4. **Given** verdict-node is architecturally the downstream enforcement client of verdict-core, **When** any part of the pitch, README, or package description is rewritten, **Then** the text explicitly frames the relationship as "core decides, node enforces at the HTTP edge" (or materially equivalent plain-language framing) and never implies verdict-node is a standalone or peer product.
5. **Given** the project is alpha software, **When** the pitch is rewritten, **Then** the "Alpha — not production-ready" label (or equivalent) remains present and at least as prominent as before.

---

### User Story 2 - Correctly Attributed Third-Party Claim (Priority: P2)

A reader scanning the README's ecosystem/comparison table sees the OmniRoute reference ("250+ providers, 90+ free tiers") and can immediately tell this is a claim made by a third-party product, not a claim this repository is making or vouching for.

**Why this priority**: This is a narrower, single-line accuracy fix. It matters for trust and correctness but affects a smaller surface area than the top-of-README pitch, so it is P2.

**Independent Test**: Can be fully tested by reading the ecosystem table row referencing OmniRoute in isolation and confirming a reader can tell the "250+ providers, 90+ free tiers" figure is OmniRoute's own claim about itself, not a verified or owned fact of this repository.

**Acceptance Scenarios**:

1. **Given** README.md's ecosystem table currently states "OmniRoute — 250+ providers, 90+ free tiers" with no attribution marker, **When** the table is updated, **Then** the entry is hedged/attributed (e.g., "per OmniRoute's own description," "OmniRoute-reported," or a footnote citing OmniRoute as the source) such that it is unambiguous this is an external, unverified, third-party claim.
2. **Given** the hedge is added, **When** the rest of the ecosystem table (rows for verdict-node itself and verdict-cockpit) is reviewed, **Then** those rows — which describe this project's own repos — are left unchanged, since they are not third-party claims.

---

### User Story 3 - Missing CI Badge Noted as Optional Improvement (Priority: P3)

A maintainer reviewing the README's badge row notices that a CI workflow exists in the repository but has no corresponding status badge, and this gap is tracked as a nice-to-have rather than silently left unnoticed or conflated with the badges that are already accurate.

**Why this priority**: This is a cosmetic completeness gap, not an accuracy problem — the existing badges (npm version, TypeScript strict, MIT license) are already correct and must not be touched. Lowest priority; explicitly non-blocking.

**Independent Test**: Can be fully tested by confirming a task or note exists describing the missing CI badge as a nice-to-have, without any change having been forced into this feature's must-ship scope.

**Acceptance Scenarios**:

1. **Given** `.github/workflows/ci.yml` exists with no corresponding README badge, **When** this feature's task list is produced, **Then** a task exists to add a CI status badge, explicitly marked optional/nice-to-have and not a release blocker for this feature.
2. **Given** the npm version, TypeScript strict, and MIT license badges are already verified accurate, **When** the CI badge task is scoped, **Then** no task in this feature proposes changing those three existing badges.

---

### Edge Cases

- What happens if a future contributor tries to remove or shorten the Next.js fail-open warning during an unrelated docs cleanup? → Per governing constitution Principle III, any such change must be rejected unless the underlying `createNextApiHandler` code defect has been fixed and verified; this specification's tasks must not include or permit that removal.
- What happens if the OmniRoute attribution hedge is worded so vaguely that it still reads as this repo's own claim? → The acceptance test requires the hedge to be unambiguous; task validation must include a read-through check by someone other than the editor.
- What happens if the plain-language rewrite accidentally drops the word "alpha" or a qualifier like "known bug" while simplifying language? → Explicitly disallowed by FR-004 and FR-005 below; task acceptance criteria must check for presence of these qualifiers post-edit.
- How does this feature interact with the separate, out-of-scope `createNextApiHandler` fail-open code defect? → This feature only touches documentation; the code defect is tracked as a separate task (see FR-009) and must not be fixed as a side effect of this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The README's opening pitch (title, tagline, and introductory paragraph(s)) MUST be rewritten in plain, approachable language that a non-technical reader can follow, while remaining technically accurate.
- **FR-002**: The rewritten pitch MUST explicitly frame verdict-node as verdict-core's downstream enforcement client (e.g., "core decides, node enforces at the HTTP edge"), and MUST NOT describe or imply verdict-node as an independent or peer product.
- **FR-003**: The rewritten pitch and surrounding sections MUST preserve the existing disclosure that the Next.js integration path (`createNextApiHandler`) is not fail-closed, at equal or greater prominence (same or higher section-level visibility) compared to the current README.
- **FR-004**: The rewritten pitch and surrounding sections MUST preserve, without softening, the existing accurate statement that the cross-language (Python/TypeScript) envelope contract is still being reconciled.
- **FR-005**: The rewritten pitch and surrounding sections MUST retain the "Alpha — not production-ready" status label (or equivalent), at equal or greater prominence.
- **FR-006**: The README's ecosystem/comparison table entry for OmniRoute ("250+ providers, 90+ free tiers") MUST be updated to clearly attribute the figures to OmniRoute as a third-party claim, not as a fact verified or owned by this repository.
- **FR-007**: The three existing verified-accurate badges (npm version, TypeScript strict, MIT license) MUST NOT be modified by this feature.
- **FR-008**: This feature's task list MUST include a separate, explicitly-flagged, non-blocking task tracking the addition of a CI status badge, given `.github/workflows/ci.yml` exists without one.
- **FR-009**: This feature's task list MUST include a separate, explicitly-flagged task tracking the `createNextApiHandler` fail-open code defect (continues to `proxy()` after a 503 denial) as a code-level bug requiring a fix and regression test — this task MUST be clearly marked as OUT OF SCOPE for implementation within this docs-accuracy feature, and MUST be flagged for prioritized, separate attention.
- **FR-010**: No task produced by this feature's planning MAY specify or permit editing production code (e.g., `createNextApiHandler`, `middleware()`, `proxy()`); this feature is documentation-only in its implementable scope, with the code defect tracked but explicitly deferred.
- **FR-011**: All new or edited documentation claims MUST be verifiable from this repository's own source, config, or tests, per project constitution Principle II; any third-party claim MUST be attributed as such.

### Key Entities

- **README pitch section**: The title, tagline, and introductory paragraphs at the top of `README.md` that describe what verdict-node is and does.
- **Ecosystem/comparison table**: The README table listing related projects and tools, including the OmniRoute third-party reference row.
- **Disclosed defect warning**: The existing README text disclosing that `createNextApiHandler` is not fail-closed; a protected artifact that must survive this feature unweakened.
- **CI badge task**: A tracked, optional improvement item to add a status badge for the existing `.github/workflows/ci.yml` workflow.
- **Fail-open code defect**: The underlying `createNextApiHandler` bug (continues to `proxy()` after a 503 denial); tracked as a separate task, explicitly out of scope for code changes in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader with no prior knowledge of "execution envelope," "fail-closed," or "policy digest" can correctly summarize, in one or two sentences after reading only the rewritten pitch, what verdict-node does and how it relates to verdict-core.
- **SC-002**: 100% of the protected statements (Next.js fail-open warning, envelope-contract reconciliation statement, alpha label) are present and unweakened in the post-edit README, verified by direct text comparison against the pre-edit baseline.
- **SC-003**: The OmniRoute README entry contains an explicit third-party attribution marker, verified by direct inspection, with zero ambiguity about ownership of the claim in a read-through by a second reviewer.
- **SC-004**: The three previously-verified-accurate badges (npm version, TypeScript strict, MIT license) remain byte-for-byte unchanged in the final README.
- **SC-005**: 100% of tasks generated for this feature that touch documentation are traceable to FR-001 through FR-007 or FR-011; the CI badge task and the fail-open code-defect task are each traceable to their own distinct, separately-flagged FR (FR-008 and FR-009 respectively) and are excluded from any "must ship together" grouping with the pitch/attribution tasks.
- **SC-006**: Zero production source files (`.ts` files under `src/` or equivalent) are modified as part of completing this feature's in-scope (documentation) tasks.

## Assumptions

- The audit referenced in the feature input is treated as ground truth for this specification; this feature does not re-run or re-verify the audit's findings, only acts on them.
- "Related docs" in scope means README.md and any documentation files it directly links to that repeat the pitch, badges, or ecosystem table content; it does not extend to unrelated documentation (e.g., internal architecture docs) unless they repeat the same inaccurate claims.
- The drafted plain-language rewrite provided in the feature input is the basis for the final pitch text but MAY be lightly copy-edited for flow, so long as FR-002 through FR-005 remain satisfied.
- "Prioritized attention" for the fail-open code defect task means it should be flagged with a priority label recognizable outside this feature's own tracking (e.g., a P0/P1-equivalent label or explicit "needs code fix" flag) when mirrored to GitHub issues, but the actual code fix work itself is out of scope for this feature's implementation phase.
- No new user-facing behavior is introduced by this feature; it is a documentation-accuracy correction, so standard "user scenario" testing here means editorial/documentation-review testing, not runtime software testing.
