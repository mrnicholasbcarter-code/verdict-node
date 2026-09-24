# ExecutionEnvelope v1 Fixtures

These canonical test fixtures are vendored from verdict-core at SHA `80ebaf23278473bb48bde807c1c3867e980a6e14`.

## Source

- **Repository**: https://github.com/mrnicholasbcarter-code/verdict-core
- **Commit**: 80ebaf23278473bb48bde807c1c3867e980a6e14
- **Path**: `contracts/fixtures/execution-envelope/v1/`
- **Manifest SHA-256**: `73f1a9c28028887befb145c064c29ead9bbe6612353390ba7a57d9ed14c3ccd8`

## Contract Documentation

The full ExecutionEnvelope v1 contract specification is maintained in verdict-core at:
`docs/contracts/EXECUTION_ENVELOPE_V1.md`

## Manifest

`manifest.json` is a **byte-identical copy** from verdict-core.

The manifest file itself has SHA-256: `73f1a9c28028887befb145c064c29ead9bbe6612353390ba7a57d9ed14c3ccd8`

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

## Canonical JSON Hashing

Core's manifest records SHA-256 hashes of canonical JSON (Python's `json.dumps` with `sort_keys=True, separators=(",",":")`). These hashes pin the **semantic content** of fixtures, not their file representation.

**Note**: JavaScript's `JSON.stringify` cannot reproduce Python's canonical form byte-for-byte (e.g., Python preserves `1.0` for floats, JS converts to `1`). Therefore, Node consumers verify:

1. The vendored **manifest file** is byte-identical to Core's (SHA-256 = `73f1a9c28028887befb145c064c29ead9bbe6612353390ba7a57d9ed14c3ccd8`)
2. Each fixture returns the **expected verdict** from the manifest

The fixture files themselves may drift until re-vendored; the manifest provides the stable contract.
