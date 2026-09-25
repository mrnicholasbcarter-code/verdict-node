import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { verifyExecutionEnvelope, EnvelopeVerdict } from '../src/verifier';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the manifests and fixtures
const v1FixturesDir = join(__dirname, '../contracts/fixtures/execution-envelope/v1');
const v1MutationsDir = join(__dirname, '../contracts/fixtures/execution-envelope/v1-mutations');

const v1Manifest = JSON.parse(readFileSync(join(v1FixturesDir, 'manifest.json'), 'utf-8'));
const mutationsManifest = JSON.parse(readFileSync(join(v1MutationsDir, 'manifest.json'), 'utf-8'));

function loadFixture(name: string): unknown {
  const content = readFileSync(join(v1FixturesDir, name), 'utf-8');
  return JSON.parse(content);
}

/**
 * Compute raw file SHA-256 (language-neutral)
 */
function fileSha256(path: string): string {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

describe('ExecutionEnvelope v1 Fixtures', () => {
  // Verify the vendored manifests are byte-identical to Core
  describe('Manifest integrity', () => {
    test('v1/manifest.json file SHA-256 matches Core bd70412f', () => {
      const manifestPath = join(v1FixturesDir, 'manifest.json');
      const actualSha = fileSha256(manifestPath);
      const expectedSha = '4e623d90c708de84bd584790020150f57626ee9fe1ff9193bcbe6b570a2b0656';
      expect(actualSha).toBe(expectedSha);
    });

    test('v1-mutations/manifest.json file SHA-256 matches Core bd70412f', () => {
      const manifestPath = join(v1MutationsDir, 'manifest.json');
      const actualSha = fileSha256(manifestPath);
      const expectedSha = '6fe1daca31d75fb2f7db7e9796ee5ae76ed7e5111a64e334d046f7eff2383a07';
      expect(actualSha).toBe(expectedSha);
    });

    test('v1-mutations/cases.json file SHA-256 matches manifest.cases_digest', () => {
      const casesPath = join(v1MutationsDir, 'cases.json');
      const actualSha = fileSha256(casesPath);
      // manifest.cases_digest is "sha256:<hex>", extract the hex part
      const expectedDigest = mutationsManifest.cases_digest;
      expect(expectedDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      const expectedSha = expectedDigest.replace('sha256:', '');
      expect(actualSha).toBe(expectedSha);
    });
  });

  // Verify fixture files match their raw file SHA-256 hashes
  describe('Fixture integrity', () => {
    test('fixture files match their raw file SHA-256 hashes from manifest', () => {
      for (const [filename, meta] of Object.entries(v1Manifest.fixtures)) {
        const fixturePath = join(v1FixturesDir, filename);
        const actualSha = fileSha256(fixturePath);
        expect(actualSha).toBe((meta as { sha256: string; expected_verdict: string }).sha256);
      }
    });
  });

  // Test each canonical fixture
  describe('Canonical fixtures (v1)', () => {
    const evaluationTime = v1Manifest.evaluation_time;
    const expectedDigest = v1Manifest.expected_policy_digest;

    test('accepted.json → ACCEPT', () => {
      const envelope = loadFixture('accepted.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.ACCEPT);
    });

    test('denied.json → DENY', () => {
      const envelope = loadFixture('denied.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.DENY);
    });

    test('expired.json → EXPIRED', () => {
      const envelope = loadFixture('expired.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('wrong-digest.json → DIGEST_MISMATCH', () => {
      const envelope = loadFixture('wrong-digest.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.DIGEST_MISMATCH);
    });

    test('unknown-field.json → REJECT_UNKNOWN', () => {
      const envelope = loadFixture('unknown-field.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('null-defaults.json → ACCEPT', () => {
      const envelope = loadFixture('null-defaults.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.ACCEPT);
    });
  });

  // Mutation corpus: load base fixture, apply override, verify expected verdict
  describe('Mutation corpus (v1-mutations): Core parity differential', () => {
    const evaluationTime = mutationsManifest.evaluation_time;
    const expectedDigest = mutationsManifest.expected_policy_digest;

    // Load the mutation cases
    const casesPath = join(v1MutationsDir, 'cases.json');
    const cases = JSON.parse(readFileSync(casesPath, 'utf-8')) as Array<{
      id: string;
      base: string;
      override: Record<string, unknown>;
      expected_verdict: string;
    }>;

    // Test each mutation case
    for (const mutationCase of cases) {
      test(`${mutationCase.id} → ${mutationCase.expected_verdict}`, () => {
        // Load base fixture
        const base = loadFixture(mutationCase.base) as Record<string, unknown>;

        // Apply override (top-level keys replaced)
        const envelope = { ...base, ...mutationCase.override };

        // Verify
        const verdict = verifyExecutionEnvelope(envelope, {
          now: evaluationTime,
          expectedPolicyDigest: expectedDigest,
        });

        expect(verdict).toBe(
          EnvelopeVerdict[mutationCase.expected_verdict as keyof typeof EnvelopeVerdict]
        );
      });
    }
  });

  // Garbage table: invalid inputs that must never return ACCEPT or throw
  describe('Garbage table (never ACCEPT, never throw)', () => {
    const evaluationTime = v1Manifest.evaluation_time;
    const expectedDigest = v1Manifest.expected_policy_digest;

    test('primitive number → REJECT_UNKNOWN', () => {
      const verdict = verifyExecutionEnvelope(1, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('null → REJECT_UNKNOWN', () => {
      const verdict = verifyExecutionEnvelope(null, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('string → REJECT_UNKNOWN', () => {
      const verdict = verifyExecutionEnvelope('x', {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('array → REJECT_UNKNOWN', () => {
      const verdict = verifyExecutionEnvelope([], {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('empty object → REJECT_UNKNOWN', () => {
      const verdict = verifyExecutionEnvelope(
        {},
        {
          now: evaluationTime,
          expectedPolicyDigest: expectedDigest,
        }
      );
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });
  });

  // Additional fail-closed validation
  describe('Additional validation rules', () => {
    const evaluationTime = v1Manifest.evaluation_time;
    const expectedDigest = v1Manifest.expected_policy_digest;

    test('unparseable now → EXPIRED', () => {
      const envelope = loadFixture('accepted.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: 'not-a-date',
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('timezone-naive now → EXPIRED', () => {
      const envelope = loadFixture('accepted.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: '2024-01-15T12:00:00', // no Z or offset
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });
  });
});
