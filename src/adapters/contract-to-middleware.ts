import type { RoutingDecision as CanonicalRoutingDecision } from '@bodanglin/verdict-contracts';

/**
 * Middleware-facing routing decision - simplified for Express/Next.js middleware
 * This is the format expected by the existing LlmGateNode implementation
 */
export interface MiddlewareRoutingDecision {
  model: string;
  provider: string;
  tier: number; // 0-3
  reason: string;
  latencyMs: number;
}

/**
 * Adapter to convert canonical RoutingDecision to MiddlewareRoutingDecision
 *
 * The canonical format has:
 * - selected_route: { runtime_id, model, provider, headroom_pct, latency_ms, decision, escalated, escalation_reason, logged, task_class }
 * - task_spec: TaskSpec
 * - candidate_snapshot: string | object | null
 * - exclusions: ExclusionReason[]
 * - policy_floor: "isolated" | "protected" | "standard" | "best_effort" | "none"
 * - planner_mode: string
 * - explanation: string
 * - adaptive_influence: object
 * - fallback_plan: FallbackStep[]
 * - correlation_id: string | null
 * - request_id: string | null
 * - policy_version: string
 * - schema_version: "1"
 *
 * The middleware format expects:
 * - model: string
 * - provider: string
 * - tier: number (0-3)
 * - reason: string
 * - latencyMs: number
 */
export function adaptRoutingDecision(canonical: CanonicalRoutingDecision): MiddlewareRoutingDecision {
  const route = canonical.selected_route as Record<string, unknown>;

  // Extract model and provider from runtime_id or direct fields
  const runtimeId = (route.runtime_id as string) || '';
  const [provider, model] = runtimeId.split('/').filter(Boolean);

  // Map policy_floor to tier (0-3)
  const tierMap: Record<string, number> = {
    isolated: 0,
    protected: 1,
    standard: 2,
    best_effort: 3,
    none: 3,
    medium: 2,
    high: 3,
  };

  // Use latency from route or fallback to 0
  const latencyMs = (route.latency_ms as number) || 0;

  // Build reason from explanation, exclusions, and decision
  const decision = (route.decision as string) || 'routed';
  const escalated = (route.escalated as boolean) || false;
  const escalationReason = (route.escalation_reason as string) || '';
  const explanation = canonical.explanation || '';

  const reasons: string[] = [];
  if (explanation) reasons.push(explanation);
  if (decision !== 'routed') reasons.push(`decision: ${decision}`);
  if (escalated && escalationReason) reasons.push(`escalated: ${escalationReason}`);
  if (canonical.exclusions && canonical.exclusions.length > 0) {
    reasons.push(`excluded: ${canonical.exclusions.map((e: any) => e.reason || e.model || 'unknown').join(', ')}`);
  }

  return {
    model: model || (route.model as string) || 'unknown',
    provider: provider || (route.provider as string) || 'unknown',
    tier: tierMap[canonical.policy_floor] ?? 3,
    reason: reasons.join('; ') || 'canonical routing decision',
    latencyMs,
  };
}

/**
 * Extract runtime_id from canonical routing decision for middleware use
 */
export function extractRuntimeId(canonical: CanonicalRoutingDecision): string {
  const route = canonical.selected_route as Record<string, unknown>;
  return (route.runtime_id as string) || `${route.provider}/${route.model}` || 'unknown/unknown';
}

/**
 * Create a minimal canonical routing decision for testing/fallback
 */
export function createFallbackRoutingDecision(
  model: string,
  provider: string,
  reason: string = 'fallback'
): CanonicalRoutingDecision {
  return {
    selected_route: {
      runtime_id: `${provider}/${model}`,
      model,
      provider,
      headroom_pct: 0,
      latency_ms: 0,
      decision: 'routed',
      escalated: false,
      escalation_reason: '',
      logged: false,
      task_class: 'unknown',
    },
    task_spec: {
      objective: '',
      task_type: 'unknown',
      effort: 'unknown',
      reasoning: 'unknown',
      capabilities: [],
      required_capabilities: [],
      tools: [],
      context: null,
      context_requirements: {},
      tool_requirements: {},
      privacy: 'unknown',
      risk: 'unknown',
      budget: {},
      latency: null,
      latency_limit_ms: null,
      workflow: null,
      approvals: [],
      criticality: 'unknown',
      verification: null,
      parallelism: 'serial',
      destructive_operation: false,
      production_impact: false,
      degraded_mode_policy: 'deny',
      metadata: {},
      schema_version: '1',
    },
    candidate_snapshot: null,
    exclusions: [],
    policy_floor: 'none',
    planner_mode: 'fallback',
    explanation: reason,
    adaptive_influence: {},
    fallback_plan: [],
    correlation_id: null,
    request_id: null,
    policy_version: '1',
    schema_version: '1',
  };
}

// Re-export the canonical type for convenience
export type { CanonicalRoutingDecision };