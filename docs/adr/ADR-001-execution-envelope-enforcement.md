# ADR-021: ExecutionEnvelope Edge Enforcement for Gateway Adapters

- **Status:** Accepted — Implemented in NOD-002
- **Date:** 2026-08-03
- **Scope:** Cross-language contract enforcement between Verdict Core and Verdict Node (`@bodanglin/verdict-node`)

## Context

Verdict Core is the authoritative policy-gated execution control plane. To ensure that transport middleware (such as `verdict-node`) cannot execute requests outside Core-authorized boundaries, edge adapters must enforce canonical `ExecutionEnvelope` constraints before forwarding requests upstream.

## Decision

We establish edge-level `ExecutionEnvelope` validation rules in Verdict Node (`src/middleware/forwarder.ts`):

1. **Pre-Forward Validation:** Edge middleware MUST validate the presence, schema version (`1`), expiration time, and policy digest of an incoming `ExecutionEnvelope` before initiating any HTTP/SSE forwarding.
2. **Fail-Closed Policy Enforcement:**
   - Missing or unparseable envelopes fail closed with `envelope_missing` / `envelope_invalid` (HTTP 403).
   - Expired envelopes fail closed with `envelope_expired` (HTTP 403).
   - Policy digest mismatches fail closed with `envelope_tampered` (HTTP 403).
   - Requests specifying models outside `execution_constraints.allowed_models` fail closed with `model_disallowed` (HTTP 403).
   - Requests invoking tools outside `execution_constraints.allowed_tools` fail closed with `tool_disallowed` (HTTP 403).
   - Requests exceeding `execution_constraints.budget_usd` or `max_request_usd` fail closed with `budget_exceeded` (HTTP 403).
3. **Parity Assurance:** The TypeScript middleware consumes canonical `@bodanglin/verdict-contracts` definitions and does not re-implement eligibility or policy evaluation.

## Consequences

- Edge gateway adapters guarantee that no un-authorized, expired, or out-of-bounds requests reach upstream model providers.
- Enforcement is applied uniformly to both non-streaming (JSON) and streaming (SSE) request flows.
- All denial responses return standardized, machine-readable `EnvelopeDenialCode` payloads.
