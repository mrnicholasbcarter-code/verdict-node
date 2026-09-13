# Research: 002-fail-closed-next-handler

**Date**: 2026-09-06

## Decision: Guard continuation, not only the boolean return

- **Decision**: After the policy middleware runs, the higher-level handler must not call the forwarder if the middleware returned false **or** if a refusal status was already written.
- **Rationale**: `origin/master` already returns false after a 503 in some cases and has two tests (unavailable, denied). The README still documents unconditional forwarding. Remaining gaps are missing refusal cases and other bypasses (clarification C). A second check on "response already written" catches a true/false mismatch.
- **Alternatives considered**: Trust only the boolean — rejected; that is the current claimed fix and still disagrees with the README/ADR. Remove the handler — rejected; it is the public Next-style API.

## Decision: Close remaining bypasses on this path in the same lane

- **Decision**: On the default (policy required) path: do not forward without an envelope; do not swap in a local ladder model without rechecking it against the envelope; supply independent policy-digest evidence or refuse. Any new bypass found while fixing is closed here (spec C).
- **Rationale**: FR-006 / User Story 3. Standalone Express forwarder already fail-closes missing envelopes; the higher-level proxy still skips when envelope is absent.
- **Alternatives considered**: Track envelope/ladder as later issues — rejected by clarify C.

## Decision: README warning stays until tests for all FR-002 cases and found bypasses pass

- **Decision**: Do not rewrite the critical-limitation paragraphs until the regression suite is green in this worktree. Then rewrite to match fail-closed behavior and keep alpha + envelope-reconciliation language.
- **Rationale**: Constitution III.
- **Alternatives considered**: Update README first — forbidden.

## Decision: Tests live next to the existing Next.js handler tests

- **Decision**: Extend `tests/router.test.ts` "Next.js /api compatibility" with timeout, invalid payload, no endpoint, envelope-required, and ladder-recheck cases. Spy on `fetch` for `/chat/completions`.
- **Rationale**: Same harness as the two existing 503 tests.
- **Alternatives considered**: New file only — extra split without need.

## Live `origin/master` note

`src/index.ts` `nextApiHandler` already has `if (!authorized) return`. Middleware returns false after 503 when policy is required. Tests cover unavailable and denied only. README/ADR still describe the old unconditional `proxy()` call. This plan treats that as incomplete, not done.
