# ExecutionEnvelope v1 Fixtures

These canonical test fixtures are vendored from verdict-core at SHA `15d1f8f9edcd37250655331a425a07d5767a98eb`.

## Source

- **Repository**: https://github.com/mrnicholasbcarter-code/verdict-core
- **Commit**: 15d1f8f9edcd37250655331a425a07d5767a98eb
- **Path**: `contracts/fixtures/execution-envelope/v1/`
- **Manifest SHA-256**: `4e623d90c708de84bd584790020150f57626ee9fe1ff9193bcbe6b570a2b0656`

## Contract Documentation

The full ExecutionEnvelope v1 contract specification is maintained in verdict-core at:
`docs/contracts/EXECUTION_ENVELOPE_V1.md`

## Manifest

`manifest.json` is a **byte-identical copy** from verdict-core.

The manifest file itself has SHA-256: `4e623d90c708de84bd584790020150f57626ee9fe1ff9193bcbe6b570a2b0656`

This constant is verified in `tests/verifier.test.ts` to ensure the vendored manifest stays pinned to Core.

## Fixtures

| File                 | Expected Verdict  | Description                               |
| -------------------- | ----------------- | ----------------------------------------- |
| `accepted.json`      | `ACCEPT`          | Valid envelope, all checks pass           |
| `denied.json`        | `DENY`            | Eligibility decision denies execution     |
| `expired.json`       | `EXPIRED`         | Envelope expired (expires_at in the past) |
| `wrong-digest.json`  | `DIGEST_MISMATCH` | policy_digest does not match expected     |
| `unknown-field.json` | `REJECT_UNKNOWN`  | Contains an unknown field (v1 rejects)    |
| `null-defaults.json` | `ACCEPT`          | Optional fields are null                  |

## Verification Rules

See `docs/contracts/EXECUTION_ENVELOPE_V1.md` in verdict-core for the full specification.

Key rules:

- Never raise on untrusted input
- Reject unknown fields (strict v1 contract)
- `expires_at` is REQUIRED (fail closed on missing expiry)
- Contradictory eligibility signals fail closed (DENY)
- Timezone-naive or unparseable timestamps → EXPIRED

## Canonical execution_constraints Keys

The Core contract now uses ONLY canonical keys in `execution_constraints`:

- `allowed_models`
- `allowed_tools`
- `allowed_agents`
- `budget_usd`
- `max_request_usd`
- `max_latency_ms`
- `risk_ceiling`
- `required_verification`
- `expires_at`

Unknown constraint keys → `REJECT_UNKNOWN`.

## Fixture SHA-256 Verification

Core's manifest now records SHA-256 hashes of **raw file bytes** (language-neutral). Verify with any `sha256sum` tool or programmatically:

```javascript
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const hash = createHash('sha256').update(readFileSync('accepted.json')).digest('hex');
// Should match manifest.fixtures['accepted.json'].sha256
```
