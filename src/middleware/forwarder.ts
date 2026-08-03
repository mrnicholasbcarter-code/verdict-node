import { Request, Response as ExpressResponse, NextFunction } from 'express';
import { z } from 'zod';

// Use global fetch Response type
type FetchResponse = Response;

/**
 * TypeScript Forwarding Middleware with SSE Parity
 *
 * Implements:
 * 1. Non-stream forwarding
 * 2. SSE forwarding
 * 3. Abort and cancellation
 * 4. Timeout handling
 * 5. Legal retry behavior (429, 502, 503, 504)
 * 6. Upstream error translation
 * 7. Headers handling (hop-by-hop stripping, passthrough)
 * 8. Usage tracking
 * 9. Tool calls
 * 10. Parallel tool calls
 * 11. Response formats
 * 12. Unknown-field preservation (passthrough)
 * 13. Malformed-payload validation
 * 14. Package API
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ExecutionEnvelope {
  schema_version: '1';
  policy_digest: string;
  execution_constraints?: {
    allowed_models?: string[];
    allowed_tools?: string[];
    budget_usd?: number;
    max_request_usd?: number;
    [key: string]: unknown;
  };
  expires_at?: string;
  [key: string]: unknown;
}

export type EnvelopeDenialCode =
  | 'envelope_missing'
  | 'envelope_invalid'
  | 'envelope_expired'
  | 'envelope_tampered'
  | 'model_disallowed'
  | 'tool_disallowed'
  | 'budget_exceeded';

export class ExecutionEnvelopeError extends Error {
  readonly code: EnvelopeDenialCode;

  constructor(code: EnvelopeDenialCode, message: string) {
    super(message);
    this.name = 'ExecutionEnvelopeError';
    this.code = code;
  }
}

export interface ForwarderConfig {
  /** Upstream base URL (e.g., 'http://localhost:20132/v1') */
  baseUrl: string;
  /** API key for upstream authentication */
  apiKey?: string;
  /** Optional Core-authorized envelope. Required when enforcement is enabled. */
  executionEnvelope?: unknown;
  /** Enforce the Core envelope before forwarding. */
  requireExecutionEnvelope?: boolean;
  /** Optional expected policy digest for tamper detection. */
  expectedPolicyDigest?: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Maximum number of retries for retryable errors (default: 3) */
  maxRetries?: number;
  /** Retry delay base in milliseconds (default: 1000) */
  retryDelayMs?: number;
  /** Custom headers to forward to upstream */
  forwardHeaders?: string[];
  /** Headers to strip from upstream response (hop-by-hop) */
  stripHeaders?: string[];
  /** Whether to preserve unknown fields from upstream (default: true) */
  preserveUnknownFields?: boolean;
  /** Enable usage tracking */
  trackUsage?: boolean;
  /** Usage callback */
  onUsage?: (usage: UsageInfo) => void;
  /** Error handler for upstream errors */
  onError?: (error: UpstreamError, req: Request, res: ExpressResponse) => void;
}

export function enforceExecutionEnvelope(
  envelope: unknown,
  request: { model: string; tools?: Array<{ function?: { name?: string } }> },
  options: { expectedPolicyDigest?: string; estimatedCostUsd?: number; required?: boolean } = {}
): void {
  if (!envelope && !options.required) return;
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new ExecutionEnvelopeError('envelope_missing', 'Core execution envelope is required');
  }
  const candidate = envelope as Record<string, unknown>;
  if (candidate.schema_version !== '1' || typeof candidate.policy_digest !== 'string') {
    throw new ExecutionEnvelopeError('envelope_invalid', 'Core execution envelope is invalid');
  }
  if (
    options.expectedPolicyDigest !== undefined &&
    candidate.policy_digest !== options.expectedPolicyDigest
  ) {
    throw new ExecutionEnvelopeError('envelope_tampered', 'Core policy digest does not match');
  }
  const expiresAt = candidate.expires_at;
  if (typeof expiresAt === 'string' && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
    throw new ExecutionEnvelopeError('envelope_expired', 'Core execution envelope has expired');
  }
  const constraints = candidate.execution_constraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) return;
  const bounded = constraints as Record<string, unknown>;
  const allowedModels = bounded.allowed_models;
  if (Array.isArray(allowedModels) && allowedModels.every(item => typeof item === 'string') && !allowedModels.includes(request.model)) {
    throw new ExecutionEnvelopeError('model_disallowed', 'Requested model is outside the Core envelope');
  }
  const requestTools = (request.tools ?? [])
    .map(tool => tool.function?.name)
    .filter((name): name is string => typeof name === 'string');
  const allowedTools = bounded.allowed_tools;
  if (Array.isArray(allowedTools) && allowedTools.every(item => typeof item === 'string') && requestTools.some(name => !allowedTools.includes(name))) {
    throw new ExecutionEnvelopeError('tool_disallowed', 'Requested tool is outside the Core envelope');
  }
  const maxCost = bounded.max_request_usd ?? bounded.budget_usd;
  if (typeof maxCost === 'number' && typeof options.estimatedCostUsd === 'number' && options.estimatedCostUsd > maxCost) {
    throw new ExecutionEnvelopeError('budget_exceeded', 'Request exceeds the Core envelope budget');
  }
}

export function createEnvelopeDenial(error: ExecutionEnvelopeError): { error: string; code: EnvelopeDenialCode } {
  return { error: error.message, code: error.code };
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  timestamp: number;
}

export interface UpstreamError extends Error {
  statusCode?: number;
  upstreamStatus?: number;
  retryable?: boolean;
  details?: unknown;
}

// ============================================================================
// OpenAI-compatible Schemas (using zod v4 compatible patterns)
// ============================================================================

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function hasExpectedPrototype(value: object, array: boolean): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return false;
  const parent = Object.getPrototypeOf(prototype);
  if (!array) return parent === null;
  return (
    parent !== null &&
    Object.getPrototypeOf(parent) === null &&
    Object.prototype.hasOwnProperty.call(prototype, 'push')
  );
}

function addUnsafeKeyIssues(
  value: unknown,
  ctx: z.RefinementCtx,
  path: Array<string | number> = []
): void {
  if (Array.isArray(value)) {
    if (!hasExpectedPrototype(value, true)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Array prototype is not allowed.',
        path,
      });
      return;
    }
    value.forEach((item, index) => addUnsafeKeyIssues(item, ctx, [...path, index]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (!hasExpectedPrototype(value, false)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Object prototype is not allowed.',
      path,
    });
    return;
  }
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsafe key "${key}" is not allowed.`,
        path: [...path, key],
      });
    }
    addUnsafeKeyIssues(nestedValue, ctx, [...path, key]);
  }
}

function safeObject<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .passthrough()
    .superRefine((value, ctx) => addUnsafeKeyIssues(value, ctx));
}

function guardRawInput<T extends z.ZodTypeAny>(schema: T): T {
  return z
    .unknown()
    .superRefine((value, ctx) => addUnsafeKeyIssues(value, ctx))
    .pipe(schema) as unknown as T;
}

// Tool schemas
export const OpenAIFunctionCallSchema = safeObject({
  name: z.string().min(1),
  arguments: z.string(),
});

export const OpenAIChatToolFunctionSchema = safeObject({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  strict: z.boolean().optional(),
});

export const OpenAIChatToolSchema = safeObject({
  type: z.literal('function'),
  function: OpenAIChatToolFunctionSchema,
});

export const OpenAIChatToolCallSchema = safeObject({
  id: z.string().min(1),
  type: z.literal('function'),
  function: OpenAIFunctionCallSchema,
});

// Message schema with tool call support
export const OpenAIChatMessageSchema = safeObject({
  role: z.enum(['system', 'user', 'assistant', 'tool', 'function', 'developer']),
  content: z.union([z.string(), z.null(), z.array(z.unknown())]).optional(),
  name: z.string().optional(),
  tool_calls: z.array(OpenAIChatToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
  function_call: OpenAIFunctionCallSchema.optional(),
});

// Response format schema
export const OpenAIResponseFormatSchema = z.union([
  safeObject({ type: z.literal('text') }),
  safeObject({ type: z.literal('json_object') }),
  safeObject({
    type: z.literal('json_schema'),
    json_schema: safeObject({
      name: z.string().min(1),
      description: z.string().min(1).optional(),
      schema: z.record(z.string(), z.unknown()).optional(),
      strict: z.boolean().optional(),
    }),
  }),
]);

// Request schema with full tool support
export const OpenAIChatCompletionRequestSchema = guardRawInput(
  safeObject({
    model: z.string().min(1),
    messages: z.array(OpenAIChatMessageSchema).min(1),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    n: z.number().int().positive().max(128).optional(),
    stream: z.boolean().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_tokens: z.number().int().positive().optional(),
    max_completion_tokens: z.number().int().positive().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    logit_bias: z.record(z.string(), z.number()).optional(),
    logprobs: z.boolean().optional(),
    top_logprobs: z.number().int().min(0).max(20).optional(),
    tools: z.array(OpenAIChatToolSchema).optional(),
    tool_choice: z
      .union([z.literal('none'), z.literal('auto'), z.literal('required'), OpenAIChatToolSchema])
      .optional(),
    parallel_tool_calls: z.boolean().optional(),
    response_format: OpenAIResponseFormatSchema.optional(),
    seed: z.number().int().optional(),
    user: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
);

// Response schemas
const OpenAIChatCompletionChoiceSchema = safeObject({
  index: z.number().int().nonnegative(),
  message: OpenAIChatMessageSchema,
  finish_reason: z
    .enum(['stop', 'length', 'tool_calls', 'content_filter', 'function_call'])
    .nullable(),
  logprobs: z.unknown().nullable().optional(),
});

const OpenAIChatCompletionUsageSchema = safeObject({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  prompt_tokens_details: z.unknown().optional(),
  completion_tokens_details: z.unknown().optional(),
});

export const OpenAIChatCompletionResponseSchema = guardRawInput(
  safeObject({
    id: z.string().min(1),
    object: z.literal('chat.completion'),
    created: z.number().int().positive(),
    model: z.string().min(1),
    choices: z.array(OpenAIChatCompletionChoiceSchema).min(1),
    usage: OpenAIChatCompletionUsageSchema.optional(),
    system_fingerprint: z.string().optional(),
  })
);

// Streaming chunk schemas
const OpenAIChatCompletionChunkChoiceSchema = safeObject({
  index: z.number().int().nonnegative(),
  delta: safeObject({
    role: z.enum(['system', 'user', 'assistant', 'tool', 'function', 'developer']).optional(),
    content: z.string().nullable().optional(),
    tool_calls: z
      .array(
        safeObject({
          index: z.number().int().nonnegative(),
          id: z.string().optional(),
          type: z.literal('function').optional(),
          function: safeObject({
            name: z.string().optional(),
            arguments: z.string().optional(),
          }).optional(),
        })
      )
      .optional(),
    function_call: OpenAIFunctionCallSchema.optional(),
  }),
  finish_reason: z
    .enum(['stop', 'length', 'tool_calls', 'content_filter', 'function_call'])
    .nullable()
    .optional(),
  logprobs: z.unknown().nullable().optional(),
});

export const OpenAIChatCompletionChunkSchema = guardRawInput(
  safeObject({
    id: z.string().min(1),
    object: z.literal('chat.completion.chunk'),
    created: z.number().int().positive(),
    model: z.string().min(1),
    choices: z.array(OpenAIChatCompletionChunkChoiceSchema).min(1),
    system_fingerprint: z.string().optional(),
  })
);

// Types
export type OpenAIChatCompletionRequest = z.infer<typeof OpenAIChatCompletionRequestSchema>;
export type OpenAIChatCompletionResponse = z.infer<typeof OpenAIChatCompletionResponseSchema>;
export type OpenAIChatCompletionChunk = z.infer<typeof OpenAIChatCompletionChunkSchema>;

// ============================================================================
// Hop-by-hop headers (RFC 7230)
// ============================================================================

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
]);

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Omit<Required<ForwarderConfig>, 'executionEnvelope' | 'requireExecutionEnvelope' | 'expectedPolicyDigest'> & {
  executionEnvelope?: unknown;
  requireExecutionEnvelope?: boolean;
  expectedPolicyDigest?: string;
} = {
  baseUrl: '',
  apiKey: '',
  executionEnvelope: undefined,
  requireExecutionEnvelope: false,
  expectedPolicyDigest: undefined,
  timeoutMs: 60000,
  maxRetries: 3,
  retryDelayMs: 1000,
  forwardHeaders: [
    'authorization',
    'content-type',
    'accept',
    'user-agent',
    'x-request-id',
    'x-correlation-id',
  ],
  stripHeaders: [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'content-length',
    'content-encoding',
  ],
  preserveUnknownFields: true,
  trackUsage: false,
  onUsage: () => {},
  onError: () => {},
};

// ============================================================================
// Utility Functions
// ============================================================================

function isRetryableStatus(status: number): boolean {
  // Legal retry behavior: 429 (rate limit), 502 (bad gateway), 503 (unavailable), 504 (gateway timeout)
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function calculateRetryDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff with jitter
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, 30000); // Cap at 30 seconds
}

function buildUpstreamHeaders(
  req: Request,
  config: ForwarderConfig
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  } else if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  // Forward allowed headers
  for (const header of (config.forwardHeaders ?? DEFAULT_CONFIG.forwardHeaders)) {
    const value = req.headers[header.toLowerCase()];
    if (value) {
      headers[header] = Array.isArray(value) ? value[0] : value;
    }
  }

  return headers;
}

function filterResponseHeaders(
  upstreamHeaders: Headers,
  config: ForwarderConfig
): Record<string, string> {
  const filtered: Record<string, string> = {};

  upstreamHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    // Strip hop-by-hop headers
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) return;
    // Strip configured headers
    if ((config.stripHeaders ?? DEFAULT_CONFIG.stripHeaders).some(h => h.toLowerCase() === lowerKey)) return;
    filtered[key] = value;
  });

  return filtered;
}

function createAbortController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

// ============================================================================
// Forwarder Class
// ============================================================================

export class Forwarder {
  private config: ForwarderConfig & typeof DEFAULT_CONFIG;
  private usageCache: Map<string, UsageInfo> = new Map();

  constructor(config: ForwarderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.baseUrl) {
      throw new Error('ForwarderConfig.baseUrl is required');
    }

    // Ensure baseUrl ends with /v1 or similar
    this.config.baseUrl = this.config.baseUrl.replace(/\/+$/, '');
  }

  /**
   * Get the Express middleware for forwarding requests
   */
  middleware() {
    return async (req: Request, res: ExpressResponse, next: NextFunction): Promise<void> => {
      const startTime = Date.now();

      // Parse and validate request body
      const parsedRequest = OpenAIChatCompletionRequestSchema.safeParse(req.body ?? {});

      if (!parsedRequest.success) {
        res.status(400).json({
          error: 'Invalid OpenAI chat completion request.',
          details: parsedRequest.error.issues,
        });
        return;
      }

      const requestBody = parsedRequest.data;
      try {
        enforceExecutionEnvelope(this.config.executionEnvelope, requestBody, {
          expectedPolicyDigest: this.config.expectedPolicyDigest,
          required: this.config.requireExecutionEnvelope,
        });

      } catch (error) {
        if (error instanceof ExecutionEnvelopeError) {
          res.status(403).json(createEnvelopeDenial(error));
          return;
        }
        throw error;
      }
      const isStream = requestBody.stream === true;
      const model = requestBody.model;

      // Create abort controller for timeout handling
      const { controller, timeoutId } = createAbortController(this.config.timeoutMs);

      // Handle client disconnect
      const onClose = () => controller.abort();
      req.on('close', onClose);

      let attempt = 0;
      let lastError: UpstreamError | null = null;

      const cleanup = () => {
        clearTimeout(timeoutId);
        req.off('close', onClose);
      };

      const executeRequest = async (): Promise<void> => {
        while (attempt <= this.config.maxRetries) {
          try {
            const payload = { ...requestBody, model };
            const upstreamUrl = `${this.config.baseUrl}/chat/completions`;

            const response = await fetch(upstreamUrl, {
              method: 'POST',
              headers: buildUpstreamHeaders(req, this.config),
              body: JSON.stringify(payload),
              signal: controller.signal,
            });

            // Check for retryable status
            if (isRetryableStatus(response.status)) {
              const retryAfter = response.headers.get('retry-after');
              const delay = retryAfter
                ? parseInt(retryAfter, 10) * 1000
                : calculateRetryDelay(attempt, this.config.retryDelayMs);

              console.warn(
                `[Forwarder] Model ${model} returned ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})...`
              );

              await new Promise(resolve => setTimeout(resolve, delay));
              attempt++;
              continue;
            }

            if (!response.ok) {
              const errorText = await response.text().catch(() => 'Unknown error');
              const error: UpstreamError = new Error(
                `Upstream error: ${response.status} ${response.statusText}`
              );
              error.statusCode = response.status;
              error.upstreamStatus = response.status;
              error.retryable = isRetryableStatus(response.status);
              error.details = errorText;
              throw error;
            }

            // Forward response headers
            const filteredHeaders = filterResponseHeaders(response.headers, this.config);
            for (const [key, value] of Object.entries(filteredHeaders)) {
              res.setHeader(key, value);
            }
            res.status(response.status);

            // Handle streaming vs non-streaming
            if (isStream) {
              await this.forwardSseResponse(response as unknown as FetchResponse, res);
            } else {
              await this.forwardJsonResponse(response as unknown as FetchResponse, res, model);
            }

            cleanup();
            return;
          } catch (err) {
            cleanup();

            if (err instanceof Error && err.name === 'AbortError') {
              const error: UpstreamError = new Error(
                'Request aborted (timeout or client disconnect)'
              );
              error.statusCode = 408;
              error.retryable = false;
              this.handleError(error, req, res);
              return;
            }

            lastError = err as UpstreamError;

            // Check if we should retry
            if (
              attempt < this.config.maxRetries &&
              (lastError.retryable ?? isRetryableStatus(lastError.upstreamStatus ?? 0))
            ) {
              const delay = calculateRetryDelay(attempt, this.config.retryDelayMs);
              console.warn(
                `[Forwarder] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries}):`,
                lastError.message
              );
              await new Promise(resolve => setTimeout(resolve, delay));
              attempt++;
              continue;
            }

            // No more retries or non-retryable error
            this.handleError(lastError, req, res);
            return;
          }
        }
      };

      try {
        await executeRequest();
      } catch (err) {
        cleanup();
        next(err);
      }
    };
  }

  /**
   * Forward non-streaming JSON response
   */
  private async forwardJsonResponse(
    response: FetchResponse,
    res: ExpressResponse,
    model: string
  ): Promise<void> {
    const payload = await response.json();

    // Validate response payload
    const parsed = OpenAIChatCompletionResponseSchema.safeParse(payload);

    if (!parsed.success) {
      // If preserveUnknownFields is true, still forward the raw payload
      if (this.config.preserveUnknownFields) {
        res.json(payload);

        // Try to extract usage if present
        const rawPayload = payload as Record<string, unknown>;
        if (rawPayload.usage && this.config.trackUsage) {
          this.recordUsage(rawPayload.usage as Record<string, unknown>, model);
        }
        return;
      }

      res.status(502).json({
        error: 'Upstream returned malformed chat completion JSON.',
        details: parsed.error.issues,
      });
      return;
    }

    // Record usage if available
    if (parsed.data.usage && this.config.trackUsage) {
      this.recordUsage(parsed.data.usage, model);
    }

    res.json(parsed.data);
  }

  /**
   * Forward SSE streaming response with validation
   */
  private async forwardSseResponse(response: FetchResponse, res: ExpressResponse): Promise<void> {
    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';

    // Flush headers immediately for streaming
    res.flushHeaders?.();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        buffered += chunkText;

        let boundary = buffered.indexOf('\n\n');
        while (boundary !== -1) {
          const eventText = buffered.slice(0, boundary);
          const lines = eventText
            .split(/\r?\n/)
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trimStart());

          if (lines.length > 0) {
            // Validate each data line
            const error = this.validateSseEventData(lines.join('\n'));
            if (error) {
              throw new Error(`Malformed upstream SSE chunk: ${error}`);
            }
          }

          // Forward the event
          res.write(eventText + '\n\n');
          buffered = buffered.slice(boundary + 2);
          boundary = buffered.indexOf('\n\n');
        }
      }

      // Handle any remaining buffered data
      buffered += decoder.decode();
      if (buffered.length > 0) {
        const lines = buffered
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart());

        if (lines.length > 0) {
          const error = this.validateSseEventData(lines.join('\n'));
          if (error) {
            throw new Error(`Malformed upstream SSE chunk: ${error}`);
          }
        }

        res.write(buffered);
      }

      res.end();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Malformed upstream SSE chunk:')) {
        // Don't write error to stream, just end it
        res.end();
        throw err;
      }
      throw err;
    }
  }

  /**
   * Validate SSE event data
   */
  private validateSseEventData(data: string): string | null {
    const trimmed = data.trim();
    if (trimmed.length === 0 || trimmed === '[DONE]') {
      return null;
    }

    try {
      const parsedJson = JSON.parse(trimmed);
      const parsedChunk = OpenAIChatCompletionChunkSchema.safeParse(parsedJson);

      if (!parsedChunk.success) {
        return parsedChunk.error.message;
      }

      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Unknown SSE validation error';
    }
  }

  /**
   * Record usage information
   */
  private recordUsage(usage: any, model: string): void {
    const usageInfo: UsageInfo = {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
      model,
      timestamp: Date.now(),
    };

    this.usageCache.set(model, usageInfo);
    this.config.onUsage(usageInfo);
  }

  /**
   * Handle upstream errors
   */
  private handleError(error: UpstreamError, req: Request, res: ExpressResponse): void {
    const statusCode = error.statusCode ?? 502;

    res.status(statusCode).json({
      error: error.message,
      upstreamStatus: error.upstreamStatus,
      retryable: error.retryable ?? false,
      details: error.details,
    });

    this.config.onError(error, req, res);
  }

  /**
   * Get cached usage for a model
   */
  getUsage(model: string): UsageInfo | undefined {
    return this.usageCache.get(model);
  }

  /**
   * Get all cached usage
   */
  getAllUsage(): UsageInfo[] {
    return Array.from(this.usageCache.values());
  }

  /**
   * Clear usage cache
   */
  clearUsage(): void {
    this.usageCache.clear();
  }
}

/**
 * Create a forwarder middleware with the given configuration
 */
export function createForwarder(config: ForwarderConfig) {
  const forwarder = new Forwarder(config);
  return forwarder.middleware();
}

// ============================================================================
// Export types and schemas for package API
// ============================================================================
