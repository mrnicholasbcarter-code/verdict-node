# ExecutionEnvelope v1 Test Fixtures

Vendored from [verdict-core](https://github.com/mrnicholasbcarter-code/verdict-core) at commit **bd70412f8050f89a8a8b6fd9c914e3cdadbf112f**.

## Directories

### v1/
Canonical ExecutionEnvelope v1 fixtures with expected verdicts:
- `accepted.json` - Valid envelope that should ACCEPT
- `denied.json` - Valid envelope with eligibility denial
- `expired.json` - Valid envelope that has expired
- `wrong-digest.json` - Valid envelope with mismatched policy_digest
- `unknown-field.json` - Invalid envelope with unknown top-level field
- `null-defaults.json` - Valid envelope with null optional fields
- `manifest.json` - Fixture metadata (evaluation_time, expected_policy_digest, file SHA-256 hashes)

**Manifest file SHA-256**: `4e623d90c708de84bd584790020150f57626ee9fe1ff9193bcbe6b570a2b0656`

### v1-mutations/
Core parity differential test corpus: 34 mutation cases that override the base fixture (accepted.json) with adversarial/edge-case values and assert the exact Core Python verdict.

- `cases.json` - Array of mutation cases, each with `id`, `base`, `override`, and `expected_verdict`
- `manifest.json` - Corpus metadata (cases_digest, evaluation_time, expected_policy_digest)

**Manifest file SHA-256**: `6fe1daca31d75fb2f7db7e9796ee5ae76ed7e5111a64e334d046f7eff2383a07`

**Cases file digest** (from manifest): `sha256:9f4e29e181987fe7e468f1efdef7393ccaf1297872cc1d78e570cc4c130d211b`

## Usage

```typescript
import { verifyExecutionEnvelope } from './src/verifier';
import manifest from './contracts/fixtures/execution-envelope/v1/manifest.json';
import accepted from './contracts/fixtures/execution-envelope/v1/accepted.json';

const verdict = verifyExecutionEnvelope(accepted, {
  now: manifest.evaluation_time,
  expectedPolicyDigest: manifest.expected_policy_digest,
});
// verdict === 'ACCEPT'
```

## Verification

All tests in `tests/verifier.test.ts` verify:
1. Manifest file integrity (raw SHA-256 matches Core)
2. Fixture file integrity (raw SHA-256 matches manifest)
3. Canonical fixtures return expected verdicts
4. Mutation corpus: all 34 cases return exact Core Python verdicts
5. Garbage table: never ACCEPT, never throw

## Update Process

To re-vendor from a new Core commit:

```bash
# 1. Clone Core at the target commit
git clone https://github.com/mrnicholasbcarter-code/verdict-core.git /tmp/verdict-core
cd /tmp/verdict-core
git checkout <COMMIT_SHA>

# 2. Copy both fixture directories byte-for-byte
cp -r contracts/fixtures/execution-envelope/v1/ <verdict-node>/contracts/fixtures/execution-envelope/
cp -r contracts/fixtures/execution-envelope/v1-mutations/ <verdict-node>/contracts/fixtures/execution-envelope/

# 3. Update this README with new commit SHA and manifest hashes

# 4. Run tests to verify parity
npm test
```

## Contract Version

ExecutionEnvelope v1 schema is stable. See [verdict-core docs](https://github.com/mrnicholasbcarter-code/verdict-core/blob/bd70412f8050f89a8a8b6fd9c914e3cdadbf112f/docs/contracts/EXECUTION_ENVELOPE_V1.md) for the canonical specification.
