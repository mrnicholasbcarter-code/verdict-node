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

// Known v1 ExecutionEnvelope top-level fields
const KNOWN_EXECUTION_ENVELOPE_FIELDS = new Set([
  'task_spec',
  'eligibility_decision',
  'policy_digest',
  'allowed_capabilities',
  'execution_constraints',
  'verification_requirements',
  'evidence_ids',
  'routing_decision',
  'created_at',
  'schema_version',
]);

// Canonical execution_constraints keys (verdict-core PR #603 / 15d1f8f9)
const KNOWN_CONSTRAINT_FIELDS = new Set([
  'allowed_models',
  'allowed_tools',
  'allowed_agents',
  'budget_usd',
  'max_request_usd',
  'max_latency_ms',
  'risk_ceiling',
  'required_verification',
  'expires_at',
]);

/**
 * Verify an ExecutionEnvelope against Core's canonical rules.
 *
 * This implements the same verification logic as verdict-core's
 * `verify_execution_envelope()`, following the fail-closed contract:
 *
 * 1. Schema Validation (FIRST): Check structure and reject unknown fields
 *    - Unknown fields, wrong types, structural errors → REJECT_UNKNOWN
 *    - Required fields must be present with correct JSON types
 *    - execution_constraints must be a plain object with only canonical keys
 *    - policy_digest must be a non-empty string
 *
 * 2. Eligibility: eligibility_decision.admitted must be true AND no contradictory signals
 *    - admitted is not true → DENY
 *    - denied is truthy → DENY (even if admitted=true)
 *    - decision present and not "accept" → DENY (even if admitted=true)
 *
 * 3. Digest Mismatch: Wrong policy_digest → DIGEST_MISMATCH
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
 * @see https://github.com/mrnicholasbcarter-code/verdict-core/blob/15d1f8f9edcd37250655331a425a07d5767a98eb/docs/contracts/EXECUTION_ENVELOPE_V1.md
 */
export function verifyExecutionEnvelope(
  envelope: unknown,
  options: VerifyExecutionEnvelopeOptions
): EnvelopeVerdict {
  // =========================================================================
  // Step 1: Schema Validation (structural checks FIRST, before specific checks)
  // =========================================================================

  // Step 1a: Basic type check
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  const env = envelope as Record<string, unknown>;

  // Step 1b: Check for unknown top-level fields (strict v1 contract)
  for (const key of Object.keys(env)) {
    if (!KNOWN_EXECUTION_ENVELOPE_FIELDS.has(key)) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // Step 1c: Validate required fields are present
  const required = [
    'task_spec',
    'eligibility_decision',
    'policy_digest',
    'allowed_capabilities',
    'execution_constraints',
    'verification_requirements',
    'evidence_ids',
    'schema_version',
  ];
  for (const field of required) {
    if (!(field in env)) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // Step 1d: Validate policy_digest is a non-empty string (structural check)
  const digest = env.policy_digest;
  if (typeof digest !== 'string' || digest === '') {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1e: Validate execution_constraints is a plain object (structural check)
  const constraints = env.execution_constraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  const cons = constraints as Record<string, unknown>;

  // Step 1f: Check for unknown constraint keys (strict canonical key list)
  for (const key of Object.keys(cons)) {
    if (!KNOWN_CONSTRAINT_FIELDS.has(key)) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // Step 1g: Validate eligibility_decision is a plain object (structural check)
  const eligibility = env.eligibility_decision;
  if (!eligibility || typeof eligibility !== 'object' || Array.isArray(eligibility)) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  const elig = eligibility as Record<string, unknown>;

  // =========================================================================
  // Step 2: Eligibility check (after structure is validated)
  // =========================================================================

  // Check admitted field
  if (elig.admitted !== true) {
    return EnvelopeVerdict.DENY;
  }

  // Check for contradictory "denied" field
  if (elig.denied) {
    return EnvelopeVerdict.DENY;
  }

  // Check for contradictory "decision" field (must be "accept" if present)
  if (elig.decision !== undefined && elig.decision !== 'accept') {
    return EnvelopeVerdict.DENY;
  }

  // =========================================================================
  // Step 3: Digest check (after structure is validated)
  // =========================================================================

  if (digest !== options.expectedPolicyDigest) {
    return EnvelopeVerdict.DIGEST_MISMATCH;
  }

  // =========================================================================
  // Step 4: Expiry check (after structure is validated)
  // =========================================================================

  const expiresAt = cons.expires_at;

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

  // =========================================================================
  // All checks passed
  // =========================================================================

  return EnvelopeVerdict.ACCEPT;
}
