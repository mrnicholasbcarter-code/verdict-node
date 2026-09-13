# Contract: Handler continuation after policy check

Public factory: `createNextApiHandler` (higher-level HTTP handler).

## Refusal (must not forward)

When the policy check cannot allow the request, the handler:

- Writes a refusal to the caller (existing 503 body for unavailable/denied).
- Does **not** call the upstream model endpoint.
- Applies for: no decision, explicit deny, timeout, invalid payload, no decision endpoint.

## Allow (default path)

When the policy check allows:

- An envelope MUST be present and enforced before upstream fetch.
- Any locally chosen fallback model MUST be rechecked against that envelope.
- Integrity evidence MUST be independent or the request is refused.

## Compatibility opt-out

Explicit opt-out of policy (`requireCoreDecision: false`) is not a policy-gated path. It must stay labeled as compatibility, not as Core-authorized execution.

## Tests

See [quickstart.md](../quickstart.md). Spies on upstream `/chat/completions` must stay at zero on every refusal and every closed bypass.
