import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { verifyExecutionEnvelope, EnvelopeVerdict } from '../src/verifier';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the manifest and fixtures
const fixturesDir = join(__dirname, '../contracts/fixtures/execution-envelope/v1');
const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.json'), 'utf-8'));

function loadFixture(name: string): unknown {
  const content = readFileSync(join(fixturesDir, name), 'utf-8');
  return JSON.parse(content);
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('ExecutionEnvelope v1 Fixtures', () => {
  // First, verify all fixtures match their manifest checksums
  describe('Fixture integrity', () => {
    test('manifest fixtures match their SHA-256 checksums', () => {
      for (const [filename, meta] of Object.entries(manifest.fixtures)) {
        const content = readFileSync(join(fixturesDir, filename), 'utf-8');
        const actualSha = sha256(content);
        expect(actualSha).toBe((meta as { sha256: string; expected_verdict: string }).sha256);
      }
    });
  });

  // Test each canonical fixture
  describe('Canonical fixtures', () => {
    const evaluationTime = manifest.evaluation_time;
    const expectedDigest = manifest.expected_policy_digest;

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

  // Garbage table: invalid inputs that must never return ACCEPT or throw
  describe('Garbage table (never ACCEPT, never throw)', () => {
    const evaluationTime = manifest.evaluation_time;
    const expectedDigest = manifest.expected_policy_digest;

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
    const evaluationTime = manifest.evaluation_time;
    const expectedDigest = manifest.expected_policy_digest;

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
