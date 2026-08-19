# ADR-001: ExecutionEnvelope Edge Enforcement for Gateway Adapters

- **Status:** Accepted — Partially implemented; NOD-002 remains open
- **Date:** 2026-08-03
- **Scope:** Cross-language contract enforcement between Verdict Core and Verdict Node (`@bodanglin/verdict-node`)

## Context

Verdict Core is the intended policy and execution-authorization authority. To keep transport middleware such as `verdict-node` from weakening Core's constraints, edge adapters must enforce a canonical `ExecutionEnvelope` before forwarding requests upstream. Core and Node do not yet share a reconciled envelope schema and issuance-to-enforcement fixture, so the implementation remains partial.

## Decision

We establish the required edge-level `ExecutionEnvelope` validation rules for Verdict Node:

1. **Pre-Forward Validation:** Every policy-gated forwarding path MUST validate the presence, schema version (`1`), expiration time, and policy digest of a canonical `ExecutionEnvelope` before initiating HTTP or SSE forwarding.
2. **Fail-Closed Policy Enforcement:**
   - Missing or unparseable envelopes fail closed with `envelope_missing` / `envelope_invalid` (HTTP 403).
   - Expired envelopes fail closed with `envelope_expired` (HTTP 403).
   - Policy digest mismatches fail closed with `envelope_tampered` (HTTP 403).
   - Every actual upstream model, including substituted or fallback models, is checked against `execution_constraints.allowed_models`; violations fail with `model_disallowed` (HTTP 403).
   - Requests invoking tools outside `execution_constraints.allowed_tools` fail closed with `tool_disallowed` (HTTP 403).
   - Requests exceeding `execution_constraints.budget_usd` or `max_request_usd` fail closed with `budget_exceeded` (HTTP 403).
3. **Parity Assurance:** Core and Node MUST consume one versioned envelope contract and shared positive and negative fixtures. Node does not re-implement eligibility or policy evaluation.
4. **Compatibility Isolation:** Explicit opt-outs MAY bypass envelope enforcement only for compatibility deployments, which MUST NOT be represented as Core-authorized execution.

## Implementation Status

- `src/middleware/forwarder.ts` implements fail-closed envelope validation by default before non-streaming JSON and streaming SSE forwarding. It checks the request model and does not substitute it.
- `src/index.ts` validates an attached envelope in the higher-level gateway, but it currently skips enforcement when the envelope is absent, does not supply independent policy-digest evidence, and does not revalidate locally substituted ladder models.
- **Critical defect:** `src/index.ts`'s `nextApiHandler()` unconditionally invokes `proxy()` after `middleware()` returns, even when `middleware()` wrote HTTP 503 without calling `next()`. The proxy path then skips envelope validation (no envelope attached) and may fetch upstream. This path is not fail-closed.
- The published Core contract, Core issuance path, shared fixtures, and CI conformance coverage are not yet aligned.

## Consequences

- This ADR defines the required authority boundary; it does not certify that all production forwarding paths currently satisfy it.
- The standalone forwarder returns machine-readable envelope denial codes for the checks it implements.
- NOD-002 remains open until one canonical Core envelope is accepted and enforced across every production forwarding path and verified through shared fixtures and CI.
