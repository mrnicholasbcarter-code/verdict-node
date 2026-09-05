# Quickstart: Validating Documentation & Pitch Accuracy

This is a documentation-only feature. Validation is editorial/diff-based, not
a runtime test suite. Use this guide to confirm the change meets the spec's
Success Criteria (SC-001 through SC-006) before merge.

## Prerequisites

- A checkout of this repository on the feature branch (`001-docs-pitch-accuracy` or equivalent).
- The pre-edit `README.md` available for comparison (e.g., via `git show main:README.md` or the original audit snapshot).

## Step 1 — Capture the baseline

```bash
git show HEAD:README.md > /tmp/readme-before.md
```

## Step 2 — Apply the documentation edits

(Performed during `/speckit-implement` — not part of this planning pass.)
Edits touch only:
- The opening pitch/title/tagline block.
- The OmniRoute row in the ecosystem/comparison table.
- Optionally, the badge row (CI badge addition only — the three existing badges must not change).

## Step 3 — Verify protected statements survive (SC-002)

Confirm the following phrases (or clear paraphrases carrying the same claim)
are present in the edited `README.md`:

```bash
grep -i "fail-closed\|fail-open" README.md      # Next.js warning must still appear
grep -i "reconcil" README.md                     # envelope contract statement must still appear
grep -i "alpha" README.md                        # alpha status label must still appear
```

Each command MUST return at least one match. If any returns no match, the
edit has removed a protected statement and must be reverted/fixed before
proceeding.

## Step 4 — Verify badges are unchanged (SC-004)

```bash
diff <(grep -i "npm/v/\|badge.*typescript\|badge.*license" /tmp/readme-before.md) \
     <(grep -i "npm/v/\|badge.*typescript\|badge.*license" README.md)
```

Expected: no diff output (the three badge lines are identical).

## Step 5 — Verify the OmniRoute attribution (SC-003)

Manually read the OmniRoute row in the ecosystem table and confirm a second
reviewer agrees the figures are unambiguously attributed to OmniRoute itself
(e.g., "per OmniRoute," "OmniRoute states," a footnote citing OmniRoute),
not stated as this repository's own verified fact.

## Step 6 — Verify plain-language comprehension (SC-001)

Ask a reviewer unfamiliar with terms like "ExecutionEnvelope" or
"fail-closed" to read only the rewritten pitch and restate, in their own
words, what verdict-node does and how it relates to verdict-core. Success:
they can do so without needing the jargon defined first.

## Step 7 — Verify no source code was touched (SC-006)

```bash
git diff --name-only HEAD | grep -E '^src/' && echo "FAIL: source files touched" || echo "PASS: no source files touched"
```

## Optional automated check

For a lightweight repeatable regression check on the three protected
phrases, consider adding a CI step running the `grep` checks from Step 3 —
noted here as an optional follow-up, not a requirement of this feature
(see research.md, Decision: Verification method is text/diff review).
