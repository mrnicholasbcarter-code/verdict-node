# Feature Specification: Fail-closed after policy refusal

**Feature Branch**: `002-fail-closed-next-handler`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "When the higher-level request handler's policy check has already refused a request (no decision, denied, error, timeout, or invalid payload), the handler MUST return that refusal and MUST NOT forward the request upstream. Add a regression test covering those refusal cases. Do not remove the public disclosure of this defect until the fix and test are merged and CI is green. GitHub issue #51."

## Clarifications

### Session 2026-09-06

- Q: Should this feature only stop forwarding after a policy refusal, or also close the other known bypasses (missing envelope, locally substituted models not rechecked)? → A: This lane closes every audit bypass found, even if new ones appear during the fix.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Refused requests stay refused (Priority: P1)

An operator using the higher-level HTTP handler expects that if the policy check has already told the caller "no" (or "cannot decide"), the request is not also sent to the model provider.

**Why this priority**: This is a safety defect. A refused request that still runs is fail-open.

**Independent Test**: Submit a request in each refusal case below. Confirm the caller only sees the refusal, and the upstream provider is not contacted.

**Acceptance Scenarios**:

1. **Given** the policy service is unreachable or returns a server error, **When** a chat request arrives, **Then** the handler returns the refusal and does not forward upstream.
2. **Given** the policy decision is explicitly denied, **When** a chat request arrives, **Then** the handler returns the refusal and does not forward upstream.
3. **Given** the policy decision times out, **When** a chat request arrives, **Then** the handler returns the refusal and does not forward upstream.
4. **Given** the policy payload is invalid, **When** a chat request arrives, **Then** the handler returns the refusal and does not forward upstream.
5. **Given** no policy endpoint is configured, **When** a chat request arrives, **Then** the handler returns the refusal and does not forward upstream.

---

### User Story 2 - Disclosure stays until the fix is proven (Priority: P1)

A visitor reading the project README still sees a clear warning about this defect until the code fix and its regression test are merged with green required checks.

**Why this priority**: The constitution forbids hiding a known safety gap with documentation.

**Independent Test**: The README warning remains until this feature's merge; after merge and green checks it may be rewritten to match the new behavior.

**Acceptance Scenarios**:

1. **Given** this feature is not yet merged, **When** someone reads the primary README, **Then** the existing critical-limitation warning is still present and not softened.
2. **Given** this feature is merged and required checks are green, **When** the README is updated, **Then** the warning is replaced with accurate fail-closed language, not deleted silently before the proof exists.

---

### User Story 3 - Every found bypass is closed in this lane (Priority: P1)

An operator must not have a second path that still sends a request after policy has refused it, or that skips policy by omitting an envelope or by swapping in a local model that was not rechecked.

**Why this priority**: Chosen clarification C. Leaving a discovered bypass unfixed would keep the handler fail-open.

**Independent Test**: For each bypass found in the audit or during this fix, a test shows the request is refused or rechecked, not forwarded around policy.

**Acceptance Scenarios**:

1. **Given** a known audit bypass (missing envelope, locally substituted model not rechecked, or missing integrity evidence on this path), **When** this feature is delivered, **Then** that bypass is closed with a test, not deferred.
2. **Given** a new bypass is found while fixing this handler, **When** the feature is declared done, **Then** that bypass is also closed and tested in this lane.

---

### Edge Cases

- Policy check writes a refusal and then the handler would have continued into the forwarder: must stop.
- Missing request envelope: must not forward around policy.
- A locally substituted model that was not rechecked against policy: must not forward.
- A true allow (policy allowed, and on the default path envelope plus integrity evidence present) continues to forward. Requiring an envelope on that path closes a bypass; it does not change a true allow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After the policy check has already written a refusal, the handler MUST return that response and MUST NOT contact the upstream provider.
- **FR-002**: FR-001 applies for: no decision, explicit deny, timeout, invalid decision payload, and no decision endpoint configured.
- **FR-003**: A regression test MUST cover every case in FR-002 and MUST fail if the upstream forwarder is invoked after a refusal.
- **FR-004**: The public README disclosure of this defect MUST remain until FR-001, FR-003, and FR-006 have passing tests. The warning MAY be rewritten in the same change as those tests. It MUST NOT be removed in a change that lacks them. Merge ships the fix and the rewrite together.
- **FR-005**: This work MUST NOT silently fold into the already-shipped docs-accuracy feature. It is a separate code-fix lane (issue #51).
- **FR-006**: Every policy bypass found in the audit or during this fix MUST be closed in this lane, with a test. That includes missing-envelope forwarding, locally substituted models not rechecked, missing integrity evidence on this path, and any new bypass discovered while implementing. This feature is not done while a found bypass remains open.

### Key Entities

- **Policy check**: The step that asks the decision service whether a request may run.
- **Refusal**: The response already written when the check cannot allow the request.
- **Upstream forward**: Sending the same request to the model provider after that check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the five refusal cases return the refusal and record zero upstream forwards.
- **SC-002**: The allow path still forwards when the policy check allows the request.
- **SC-003**: The README warning is still present on this branch until the required checks for the fix are green; it is not removed in the same change that lacks a passing regression test.
- **SC-004**: 100% of bypasses found in the audit or during this fix have a passing test that they no longer forward around policy.

## Assumptions

- Issue #51 and constitution v1.0.0 (Principles I, III, IV) govern this work.
- Docs-accuracy (`001-docs-pitch-accuracy`) already shipped and must not be rewritten as a substitute for this fix.
- Isolated worktree from `origin/master`; do not write the dirty `feat/nod002-parity-gate` checkout.
- Rollback is revert of this feature’s change. No extra recovery path.
- Compatibility opt-out (`requireCoreDecision` off) is not a policy-gated path and is out of scope except that it must not be described as Core-authorized.
