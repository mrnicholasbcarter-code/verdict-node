import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { verifyExecutionEnvelope, EnvelopeVerdict } from '../src/verifier';

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
        expect(actualSha).toBe(
          (meta as { sha256: string; expected_verdict: string }).sha256
        );
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
      const verdict = verifyExecutionEnvelope({}, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('execution_constraints as string → REJECT_UNKNOWN', () => {
      const envelope = {
        ...loadFixture('accepted.json'),
        execution_constraints: 'invalid',
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.REJECT_UNKNOWN);
    });

    test('execution_constraints as null → EXPIRED (missing expires_at)', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        execution_constraints: null,
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('contradictory eligibility (admitted=true, denied=true) → DENY', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        eligibility_decision: {
          admitted: true,
          denied: true,
        },
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.DENY);
    });

    test('contradictory eligibility (admitted=true, decision="deny") → DENY', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        eligibility_decision: {
          admitted: true,
          decision: 'deny',
        },
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).not.toBe(EnvelopeVerdict.ACCEPT);
      expect(verdict).toBe(EnvelopeVerdict.DENY);
    });
  });

  // Fail-closed expiry rules
  describe('Expiry validation (fail closed)', () => {
    const expectedDigest = manifest.expected_policy_digest;

    test('missing execution_constraints → EXPIRED', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const { execution_constraints: _removed, ...envelope } = base;
      const verdict = verifyExecutionEnvelope(envelope, {
        now: manifest.evaluation_time,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('missing expires_at → EXPIRED', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const constraints = base.execution_constraints as Record<string, unknown>;
      const { expires_at: _removed, ...newConstraints } = constraints;
      const envelope = {
        ...base,
        execution_constraints: newConstraints,
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: manifest.evaluation_time,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('unparseable now → EXPIRED', () => {
      const envelope = loadFixture('accepted.json');
      const verdict = verifyExecutionEnvelope(envelope, {
        now: 'not-a-date',
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('unparseable expires_at → EXPIRED', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        execution_constraints: {
          expires_at: 'not-a-date',
        },
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: manifest.evaluation_time,
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

    test('timezone-naive expires_at → EXPIRED', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        execution_constraints: {
          expires_at: '2024-01-15T13:00:00', // no Z or offset
        },
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: manifest.evaluation_time,
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });

    test('now >= expires_at → EXPIRED', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        execution_constraints: {
          expires_at: '2024-01-15T12:00:00Z',
        },
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: '2024-01-15T12:00:00Z', // exactly equal
        expectedPolicyDigest: expectedDigest,
      });
      expect(verdict).toBe(EnvelopeVerdict.EXPIRED);
    });
  });

  // Digest validation
  describe('Digest validation', () => {
    const evaluationTime = manifest.evaluation_time;

    test('missing policy_digest → DIGEST_MISMATCH', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const { policy_digest: _removed, ...envelope } = base;
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: manifest.expected_policy_digest,
      });
      expect(verdict).toBe(EnvelopeVerdict.DIGEST_MISMATCH);
    });

    test('empty policy_digest → DIGEST_MISMATCH', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        policy_digest: '',
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: manifest.expected_policy_digest,
      });
      expect(verdict).toBe(EnvelopeVerdict.DIGEST_MISMATCH);
    });

    test('wrong policy_digest → DIGEST_MISMATCH', () => {
      const base = loadFixture('accepted.json') as Record<string, unknown>;
      const envelope = {
        ...base,
        policy_digest: 'b'.repeat(64),
      };
      const verdict = verifyExecutionEnvelope(envelope, {
        now: evaluationTime,
        expectedPolicyDigest: manifest.expected_policy_digest,
      });
      expect(verdict).toBe(EnvelopeVerdict.DIGEST_MISMATCH);
    });
  });
});
