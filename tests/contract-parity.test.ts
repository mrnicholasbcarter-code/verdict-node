import { contractSchemas, parseContract } from '@bodanglin/verdict-contracts';
import { createFallbackRoutingDecision } from '../src/adapters/contract-to-middleware';
import {
  enforceExecutionEnvelope,
  ExecutionEnvelopeError,
  createEnvelopeDenial,
} from '../src/middleware/forwarder';

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
    const validEnvelope = {
      schema_version: '1',
      policy_digest: 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      execution_constraints: {
        allowed_models: ['gpt-4o', 'claude-3-5-sonnet'],
        allowed_tools: ['read_file', 'write_file'],
        max_request_usd: 1.0,
      },
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };

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
  });
});
