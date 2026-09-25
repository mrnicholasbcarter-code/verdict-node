import { contractSchemas } from '@bodanglin/verdict-contracts';

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

// Valid risk_ceiling enum values
const VALID_RISK_CEILING = new Set(['unknown', 'low', 'medium', 'high', 'critical']);

/**
 * Verify an ExecutionEnvelope against Core's canonical rules.
 *
 * This implements the same verification logic as verdict-core's
 * `verify_execution_envelope()`, following the fail-closed contract:
 *
 * 1. Schema Validation (FIRST): Check structure and reject unknown fields
 *    - Unknown fields, wrong types, structural errors → REJECT_UNKNOWN
 *    - Required fields must be present with correct JSON types
 *    - Top-level fields validated against Core schema types
 *    - Nested objects (task_spec, verification_requirements) validated against Zod schemas
 *    - execution_constraints must be a plain object with only canonical keys
 *    - policy_digest must be 64 lowercase hex chars (no prefix)
 *    - execution_constraints VALUES validated (bd70412f):
 *      * budget_usd, max_request_usd: non-negative numbers (not booleans)
 *      * max_latency_ms: non-negative integer (1.0 ok, 1.5 not; not booleans)
 *      * risk_ceiling: enum {unknown, low, medium, high, critical}
 *      * allowed_models, allowed_tools, allowed_agents, required_verification: arrays of non-empty strings
 *      * expires_at: string
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
 * @see https://github.com/mrnicholasbcarter-code/verdict-core/blob/bd70412f8050f89a8a8b6fd9c914e3cdadbf112f/docs/contracts/EXECUTION_ENVELOPE_V1.md
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

  // Step 1d: Validate schema_version is exactly "1"
  const schemaVersion = env.schema_version;
  if (schemaVersion !== '1') {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1e: Validate policy_digest is 64 LOWERCASE hex chars (bd70412f: no uppercase, no prefix)
  const digest = env.policy_digest;
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1f: Validate allowed_capabilities is array of strings
  const allowedCapabilities = env.allowed_capabilities;
  if (
    !Array.isArray(allowedCapabilities) ||
    !allowedCapabilities.every(item => typeof item === 'string')
  ) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1g: Validate evidence_ids is array of strings
  const evidenceIds = env.evidence_ids;
  if (!Array.isArray(evidenceIds) || !evidenceIds.every(item => typeof item === 'string')) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1h: Validate routing_decision is null or plain object
  const routingDecision = env.routing_decision;
  if (
    routingDecision !== undefined &&
    routingDecision !== null &&
    (typeof routingDecision !== 'object' || Array.isArray(routingDecision))
  ) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1i: Validate created_at is null or string (if present)
  const createdAt = env.created_at;
  if (createdAt !== undefined && createdAt !== null && typeof createdAt !== 'string') {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1j: Validate execution_constraints is a plain object (structural check)
  const constraints = env.execution_constraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  const cons = constraints as Record<string, unknown>;

  // Step 1k: Check for unknown constraint keys (strict canonical key list)
  for (const key of Object.keys(cons)) {
    if (!KNOWN_CONSTRAINT_FIELDS.has(key)) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // Step 1l: Validate constraint VALUES (bd70412f)
  // budget_usd: non-negative number (not boolean)
  if ('budget_usd' in cons) {
    const budgetUsd = cons.budget_usd;
    if (typeof budgetUsd !== 'number' || budgetUsd < 0) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // max_request_usd: non-negative number (not boolean)
  if ('max_request_usd' in cons) {
    const maxRequestUsd = cons.max_request_usd;
    if (typeof maxRequestUsd !== 'number' || maxRequestUsd < 0) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // max_latency_ms: non-negative integer (1.0 ok, 1.5 not; not boolean)
  if ('max_latency_ms' in cons) {
    const maxLatencyMs = cons.max_latency_ms;
    if (typeof maxLatencyMs !== 'number' || maxLatencyMs < 0 || !Number.isInteger(maxLatencyMs)) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // risk_ceiling: enum {unknown, low, medium, high, critical}
  if ('risk_ceiling' in cons) {
    const riskCeiling = cons.risk_ceiling;
    if (typeof riskCeiling !== 'string' || !VALID_RISK_CEILING.has(riskCeiling)) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // allowed_models: array of non-empty strings
  if ('allowed_models' in cons) {
    const allowedModels = cons.allowed_models;
    if (
      !Array.isArray(allowedModels) ||
      !allowedModels.every(item => typeof item === 'string' && item.length > 0)
    ) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // allowed_tools: array of non-empty strings
  if ('allowed_tools' in cons) {
    const allowedTools = cons.allowed_tools;
    if (
      !Array.isArray(allowedTools) ||
      !allowedTools.every(item => typeof item === 'string' && item.length > 0)
    ) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // allowed_agents: array of non-empty strings
  if ('allowed_agents' in cons) {
    const allowedAgents = cons.allowed_agents;
    if (
      !Array.isArray(allowedAgents) ||
      !allowedAgents.every(item => typeof item === 'string' && item.length > 0)
    ) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // required_verification: array of non-empty strings
  if ('required_verification' in cons) {
    const requiredVerification = cons.required_verification;
    if (
      !Array.isArray(requiredVerification) ||
      !requiredVerification.every(item => typeof item === 'string' && item.length > 0)
    ) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // expires_at: must be a string if present (verified later for actual expiry)
  if ('expires_at' in cons) {
    const expiresAt = cons.expires_at;
    if (typeof expiresAt !== 'string') {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  }

  // Step 1m: Validate eligibility_decision is a plain object (structural check)
  const eligibility = env.eligibility_decision;
  if (!eligibility || typeof eligibility !== 'object' || Array.isArray(eligibility)) {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  const elig = eligibility as Record<string, unknown>;

  // Step 1n: Validate nested task_spec against canonical Zod schema
  const taskSpec = env.task_spec;
  try {
    const parsed = contractSchemas.task_spec.safeParse(taskSpec);
    if (!parsed.success) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  } catch {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

  // Step 1o: Validate nested verification_requirements against canonical Zod schema
  const verificationReqs = env.verification_requirements;
  try {
    const parsed = contractSchemas.verification_plan.safeParse(verificationReqs);
    if (!parsed.success) {
      return EnvelopeVerdict.REJECT_UNKNOWN;
    }
  } catch {
    return EnvelopeVerdict.REJECT_UNKNOWN;
  }

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
