import { parseContract, type ExecutionEnvelope } from '@bodanglin/verdict-contracts';

/**
 * Envelope verification verdicts
 * 
 * These match the canonical Python EnvelopeVerdict values from verdict-core.
 */
export enum EnvelopeVerdict {
  ACCEPT = 'ACCEPT',
  DENY = 'DENY',
  EXPIRED = 'EXPIRED',
  DIGEST_MISMATCH = 'DIGEST_MISMATCH',
  REJECT_UNKNOWN = 'REJECT_UNKNOWN',
}

/**
 * Verification options
 */
export interface VerifyExecutionEnvelopeOptions {
  /**
   * Current time for expiry checks (ISO 8601 with timezone REQUIRED).
   * Example: "2024-01-15T12:30:00Z"
   */
  now: string;

  /**
   * Expected policy digest (SHA-256 hex, 64 chars lowercase).
   * The envelope's policy_digest must match this value.
   */
  expectedPolicyDigest: string;
}

/**
 * Verify an ExecutionEnvelope against Core's canonical rules.
 * 
 * This implements the same verification logic as verdict-core's
 * `verify_execution_envelope()`, following the fail-closed contract:
 * 
 * 1. Schema Validation: Parse with ExecutionEnvelope.from_dict() first
 *    - Unknown fields, wrong types, structural errors → REJECT_UNKNOWN
 * 
 * 2. Eligibility: eligibility_decision.admitted must be true AND no contradictory signals
 *    - admitted is not true → DENY
 *    - denied is truthy → DENY (even if admitted=true)
 *    - decision present and not "accept" → DENY (even if admitted=true)
 * 
 * 3. Digest Mismatch: Missing, empty, or wrong policy_digest → DIGEST_MISMATCH
 * 
 * 4. Expiry (bounded lifetime REQUIRED):
 *    - Missing execution_constraints.expires_at → EXPIRED
 *    - Unparseable now or expires_at → EXPIRED
 *    - Timezone-naive timestamps → EXPIRED
 *    - now >= expires_at → EXPIRED
 * 
 * 5. All checks passed → ACCEPT
 * 
 * **The verifier never throws on untrusted input; malformed data returns REJECT_UNKNOWN.**
 * 
 * @param envelope - The envelope to verify (unknown shape from untrusted source)
 * @param options - Verification parameters (now and expectedPolicyDigest are REQUIRED)
 * @returns The verdict enum value
 * 
 * @see https://github.com/mrnicholasbcarter-code/verdict-core/blob/80ebaf23278473bb48bde807c1c3867e980a6e14/docs/contracts/EXECUTION_ENVELOPE_V1.md
 */
export function verifyExecutionEnvelope(
  envelope: unknown,
  options: VerifyExecutionEnvelopeOptions
): EnvelopeVerdict {
  // Step 1: Schema validation
  // The envelope must be a valid ExecutionEnvelope object
  let parsed: ExecutionEnvelope;
  try {
    // parseContract will reject unknown fields and validate structure
    parsed = parseContract('execution_envelope', envelope) as ExecutionEnvelope;
  } catch (error) {
    // Any parsing error (unknown fields, wrong types, etc.) → REJECT_UNKNOWN
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 2: Eligibility check
  // admitted must be true, and no contradictory deny signals
  const eligibility = parsed.eligibility_decision as Record<string, unknown>;
  
  // Check admitted field
  if (eligibility.admitted !== true) {
    return EnvelopeVerdict.DENY;
  }

  // Check for contradictory "denied" field
  if (eligibility.denied) {
    return EnvelopeVerdict.DENY;
  }

  // Check for contradictory "decision" field (must be "accept" if present)
  if (eligibility.decision !== undefined && eligibility.decision !== 'accept') {
    return EnvelopeVerdict.DENY;
  }

  // Step 3: Digest check
  const digest = parsed.policy_digest;
  if (!digest || digest !== options.expectedPolicyDigest) {
    return EnvelopeVerdict.DIGEST_MISMATCH;
  }

  // Step 4: Expiry check (bounded lifetime REQUIRED)
  const constraints = parsed.execution_constraints as Record<string, unknown> | undefined;
  
  // Missing execution_constraints → EXPIRED
  if (!constraints) {
    return EnvelopeVerdict.EXPIRED;
  }

  const expiresAt = constraints.expires_at;
  
  // Missing expires_at → EXPIRED (fail closed: envelopes MUST have bounded lifetime)
  if (typeof expiresAt !== 'string') {
    return EnvelopeVerdict.EXPIRED;
  }

  // Parse timestamps
  const nowMs = Date.parse(options.now);
  const expiresAtMs = Date.parse(expiresAt);

  // Unparseable timestamps → EXPIRED
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs)) {
    return EnvelopeVerdict.EXPIRED;
  }

  // Check for timezone-naive timestamps (fail closed)
  // ISO 8601 with timezone must end with 'Z' or contain '+' or '-' offset
  const hasTimezone = (ts: string): boolean => {
    return ts.endsWith('Z') || ts.includes('+') || ts.lastIndexOf('-') > 10;
  };

  if (!hasTimezone(options.now) || !hasTimezone(expiresAt)) {
    return EnvelopeVerdict.EXPIRED;
  }

  // Check if expired
  if (nowMs >= expiresAtMs) {
    return EnvelopeVerdict.EXPIRED;
  }

  // All checks passed
  return EnvelopeVerdict.ACCEPT;
}
