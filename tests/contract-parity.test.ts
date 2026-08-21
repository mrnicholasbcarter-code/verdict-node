import { contractSchemas, parseContract } from '@bodanglin/verdict-contracts';
import { createFallbackRoutingDecision } from '../src/adapters/contract-to-middleware';
import {
  enforceExecutionEnvelope,
  ExecutionEnvelopeError,
  createEnvelopeDenial,
} from '../src/middleware/forwarder';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

describe('canonical routing contract parity', () => {
  it('creates fallback decisions accepted by the canonical schema', () => {
    const decision = createFallbackRoutingDecision('gpt-4o-mini', 'openai', 'test fallback');

    expect(contractSchemas.routing_decision.safeParse(decision).success).toBe(true);
    expect(parseContract('routing_decision', decision)).toEqual(decision);
  });

  it('rejects unknown top-level contract fields', () => {
    const decision = {
      ...createFallbackRoutingDecision('gpt-4o-mini', 'openai'),
      unexpected: true,
    };

    expect(contractSchemas.routing_decision.safeParse(decision).success).toBe(false);
    expect(() => parseContract('routing_decision', decision)).toThrow(/unexpected/i);
  });

  it('rejects malformed routing decisions before adaptation', () => {
    expect(() => parseContract('routing_decision', { policy_floor: 'none' })).toThrow(
      /selected_route/i
    );
  });

  describe('ExecutionEnvelope enforcement', () => {
    function createValidEnvelope(overrides: Record<string, unknown> = {}) {
      return {
        schema_version: '1',
        task_spec: {
          objective: 'test task',
          task_type: 'chat',
          effort: 'medium',
          reasoning: 'medium',
          privacy: 'unknown',
          risk: 'unknown',
          parallelism: 'serial',
          degraded_mode_policy: 'deny',
          capabilities: [],
          required_capabilities: [],
          tools: [],
          approvals: [],
          budget: {},
          latency: {},
          workflow: null,
          metadata: {},
        },
        eligibility_decision: { admitted: ['gpt-4o'], reason: 'test' },
        policy_digest: 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        allowed_capabilities: ['chat'],
        execution_constraints: {
          allowed_models: ['gpt-4o', 'claude-3-5-sonnet'],
          allowed_tools: ['read_file', 'write_file'],
          max_request_usd: 1.0,
        },
        verification_requirements: { checks: [] },
        evidence_ids: ['evidence-1'],
        routing_decision: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        ...overrides,
      };
    }

    const validEnvelope = createValidEnvelope();

    it('passes for valid envelope and allowed request', () => {
      expect(() =>
        enforceExecutionEnvelope(validEnvelope, {
          model: 'gpt-4o',
          tools: [{ function: { name: 'read_file' } }],
        })
      ).not.toThrow();
    });

    it('rejects missing envelope when required', () => {
      expect(() => enforceExecutionEnvelope(null, { model: 'gpt-4o' }, { required: true })).toThrow(
        ExecutionEnvelopeError
      );
      try {
        enforceExecutionEnvelope(null, { model: 'gpt-4o' }, { required: true });
      } catch (err: any) {
        expect(err.code).toBe('envelope_missing');
        expect(createEnvelopeDenial(err).code).toBe('envelope_missing');
      }
    });

    it('rejects expired envelope', () => {
      const expired = {
        ...validEnvelope,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      };
      expect(() => enforceExecutionEnvelope(expired, { model: 'gpt-4o' })).toThrow(
        ExecutionEnvelopeError
      );
    });

    it('rejects disallowed model', () => {
      expect(() =>
        enforceExecutionEnvelope(validEnvelope, { model: 'unauthorized-model' })
      ).toThrow(ExecutionEnvelopeError);
    });

    it('rejects disallowed tool', () => {
      expect(() =>
        enforceExecutionEnvelope(validEnvelope, {
          model: 'gpt-4o',
          tools: [{ function: { name: 'unauthorized_tool' } }],
        })
      ).toThrow(ExecutionEnvelopeError);
    });

    it('rejects request exceeding budget', () => {
      expect(() =>
        enforceExecutionEnvelope(validEnvelope, { model: 'gpt-4o' }, { estimatedCostUsd: 2.0 })
      ).toThrow(ExecutionEnvelopeError);
    });

    it('rejects unknown top-level envelope fields', () => {
      const tampered = { ...validEnvelope, injected_capability: 'admin' };
      expect(() => enforceExecutionEnvelope(tampered, { model: 'gpt-4o' })).toThrow(
        ExecutionEnvelopeError
      );
      try {
        enforceExecutionEnvelope(tampered, { model: 'gpt-4o' });
      } catch (err: any) {
        expect(err.code).toBe('envelope_invalid');
      }
    });

    it('rejects malformed non-object constraints', () => {
      const malformed = { ...validEnvelope, execution_constraints: null };
      expect(() => enforceExecutionEnvelope(malformed, { model: 'gpt-4o' })).toThrow(
        ExecutionEnvelopeError
      );
      const arrayConstraints = { ...validEnvelope, execution_constraints: [] };
      expect(() => enforceExecutionEnvelope(arrayConstraints, { model: 'gpt-4o' })).toThrow(
        ExecutionEnvelopeError
      );
    });

    it('rejects an envelope that omits execution_constraints entirely', () => {
      const { execution_constraints: _omitted, ...minimal } = validEnvelope;
      expect(() => enforceExecutionEnvelope(minimal, { model: 'gpt-4o' })).toThrow(
        ExecutionEnvelopeError
      );
    });
  });
});

describe('ExecutionEnvelope schema parity — invalid fixtures rejected by both Python and TypeScript', () => {
  const fixturesDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../test_fixtures/envelopes'
  );

  function loadFixture(name: string): unknown {
    const filePath = path.join(fixturesDir, name);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  // Valid envelope should pass
  it('accepts the valid envelope fixture', () => {
    const envelope = loadFixture('valid_envelope.json');
    const result = contractSchemas.execution_envelope.safeParse(envelope);
    expect(result.success).toBe(true);
  });

  // Invalid fixtures should all be rejected
  const invalidFixtures = [
    'invalid_missing_task_spec.json',
    'invalid_empty_policy_digest.json',
    'invalid_empty_evidence_id_item.json',
    'invalid_wrong_type_task_spec.json',
    'invalid_wrong_type_allowed_capabilities.json',
    'invalid_wrong_type_execution_constraints.json',
    'invalid_wrong_type_verification_requirements.json',
    'invalid_unknown_field.json',
    'invalid_task_spec_missing_objective.json',
    'invalid_task_spec_empty_objective.json',
    'invalid_empty_allowed_capability_item.json',
  ];

  // These fixtures have empty arrays which are allowed by the schema (z.array allows empty)
  const allowedEmptyArrayFixtures = [
    'invalid_empty_allowed_capabilities.json',
    'invalid_empty_evidence_ids.json',
  ];

  for (const fixture of invalidFixtures) {
    it(`rejects ${fixture}`, () => {
      const envelope = loadFixture(fixture);
      const result = contractSchemas.execution_envelope.safeParse(envelope);
      expect(result.success).toBe(false);
    });
  }

  // Parity: parseContract should also reject all invalid fixtures with proper error category
  for (const fixture of invalidFixtures) {
    it(`parseContract rejects ${fixture} with validation error`, () => {
      const envelope = loadFixture(fixture);
      expect(() => parseContract('execution_envelope', envelope)).toThrow(/execution_envelope/);
    });
  }

  // Empty arrays are allowed by the schema
  for (const fixture of allowedEmptyArrayFixtures) {
    it(`accepts ${fixture} (empty arrays are valid)`, () => {
      const envelope = loadFixture(fixture);
      const result = contractSchemas.execution_envelope.safeParse(envelope);
      expect(result.success).toBe(true);
    });
  }
});
