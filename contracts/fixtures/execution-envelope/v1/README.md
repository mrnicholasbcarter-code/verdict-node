# ExecutionEnvelope v1 Fixtures

These canonical test fixtures are vendored from verdict-core at SHA `80ebaf23278473bb48bde807c1c3867e980a6e14`.

## Source

- **Repository**: https://github.com/mrnicholasbcarter-code/verdict-core
- **Commit**: 80ebaf23278473bb48bde807c1c3867e980a6e14
- **Path**: `contracts/fixtures/execution-envelope/v1/`

## Contract Documentation

The full ExecutionEnvelope v1 contract specification is maintained in verdict-core at:
`docs/contracts/EXECUTION_ENVELOPE_V1.md`

## Manifest

`manifest.json` contains SHA-256 checksums and expected verdicts for each fixture.

## Fixtures

| File | Expected Verdict | Description |
|------|-----------------|-------------|
| `accepted.json` | `ACCEPT` | Valid envelope, all checks pass |
| `denied.json` | `DENY` | Eligibility decision denies execution |
| `expired.json` | `EXPIRED` | Envelope expired (expires_at in the past) |
| `wrong-digest.json` | `DIGEST_MISMATCH` | policy_digest does not match expected |
| `unknown-field.json` | `REJECT_UNKNOWN` | Contains an unknown field (v1 rejects) |
| `null-defaults.json` | `ACCEPT` | Optional fields are null |

## Verification Rules

See `docs/contracts/EXECUTION_ENVELOPE_V1.md` in verdict-core for the full specification.

Key rules:
- Never raise on untrusted input
- Reject unknown fields (strict v1 contract)
- `expires_at` is REQUIRED (fail closed on missing expiry)
- Contradictory eligibility signals fail closed (DENY)
- Timezone-naive or unparseable timestamps → EXPIRED
