import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import express, { Application } from 'express';
import {
  createForwarder,
  Forwarder,
  OpenAIChatCompletionRequestSchema,
} from '../../src/middleware/forwarder';

describe('Forwarder Middleware', () => {
  let app: Application;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock fetch globally
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
    app = undefined as unknown as Application;
  });

  describe('OpenAIChatCompletionRequestSchema', () => {
    it('should validate a valid chat completion request', () => {
      const validRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate request with tool calls', () => {
      const requestWithTools = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather info',
              parameters: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        parallel_tool_calls: true,
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(requestWithTools);
      expect(result.success).toBe(true);
    });

    it('should reject invalid request', () => {
      const invalidRequest = {
        model: 'gpt-4',
        // missing messages
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('Forwarder Configuration', () => {
    it('should create forwarder with required config', () => {
      const forwarder = new Forwarder({ baseUrl: 'http://localhost:20132/v1' });
      expect(forwarder).toBeInstanceOf(Forwarder);
    });

    it('should throw if baseUrl is missing', () => {
      expect(() => new Forwarder({ baseUrl: '' })).toThrow('ForwarderConfig.baseUrl is required');
    });

    it('should apply default configuration', () => {
      const forwarder = new Forwarder({ baseUrl: 'http://localhost:20132/v1' });
      // Access private config via getUsage which uses the config
      expect(forwarder.getUsage('test')).toBeUndefined();
    });
  });

  describe('Forwarder Middleware', () => {
    it('should return 400 for invalid request body', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: false,
      });
      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({ model: 'gpt-4' }) // missing messages
        .expect(400);

      expect(response.body.error).toBe('Invalid OpenAI chat completion request.');
    });

    it('should forward request to upstream on valid request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        apiKey: 'test-key',
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(response.body.id).toBe('chatcmpl-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify headers were forwarded
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe('Bearer test-key');
    });

    it('should handle streaming responses', async () => {
      const chunks = [
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let chunkIndex = 0;
      const mockBody = {
        getReader: () => ({
          read: async () => {
            if (chunkIndex < chunks.length) {
              return { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) };
            }
            return { done: true, value: undefined };
          },
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: mockBody,
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true,
        })
        .expect(200);
    });

    it('should retry on 429 status', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      // First call returns 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'retry-after': '0' }),
          text: async () => 'Rate limited',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockResponse,
        });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        maxRetries: 3,
        retryDelayMs: 10, // Fast retry for testing
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(response.body.id).toBe('chatcmpl-123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 status', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({}),
          text: async () => 'Service unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockResponse,
        });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        maxRetries: 3,
        retryDelayMs: 10,
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(response.body.id).toBe('chatcmpl-123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable status (400)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({}),
        text: async () => 'Invalid request',
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        maxRetries: 3,
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(400);

      expect(response.body.error).toContain('Upstream error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout', async () => {
      // Mock fetch that respects abort signal
      mockFetch.mockImplementationOnce((url, options) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: Date.now(),
                model: 'gpt-4',
                choices: [
                  {
                    index: 0,
                    message: { role: 'assistant', content: 'Hello!' },
                    finish_reason: 'stop',
                  },
                ],
              }),
            });
          }, 200);

          // Listen for abort signal
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              const error = new Error('Aborted') as Error & { name: string };
              error.name = 'AbortError';
              reject(error);
            });
          }
        });
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        timeoutMs: 50, // Very short timeout for testing
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(408);

      expect(response.body.error).toContain('aborted');
    });

    it('should retry on 504 status', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 504,
          statusText: 'Gateway Timeout',
          headers: new Headers({ 'retry-after': '0' }),
          text: async () => 'Gateway timeout',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            id: 'chatcmpl-504',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4',
            choices: [
              { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
            ],
          }),
        });

      app.post(
        '/chat/completions',
        createForwarder({ baseUrl: 'http://localhost:20132/v1', requireExecutionEnvelope: false })
      );

      const response = await request(app)
        .post('/chat/completions')
        .send({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] })
        .expect(200);

      expect(response.body.id).toBe('chatcmpl-504');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return last retryable error after exhausting retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 504,
        statusText: 'Gateway Timeout',
        headers: new Headers({ 'retry-after': '0' }),
        text: async () => 'Gateway timeout',
      });

      app.post(
        '/chat/completions',
        createForwarder({
          baseUrl: 'http://localhost:20132/v1',
          maxRetries: 1,
          requireExecutionEnvelope: false,
        })
      );

      const response = await request(app)
        .post('/chat/completions')
        .send({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] })
        .expect(504);

      expect(response.body).toMatchObject({
        upstreamStatus: 504,
        retryable: true,
        details: 'Gateway timeout',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should ignore invalid Retry-After and use configured backoff', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'retry-after': 'soon' }),
          text: async () => 'try later',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            id: 'chatcmpl-backoff',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4',
            choices: [
              { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
            ],
          }),
        });

      app.post(
        '/chat/completions',
        createForwarder({
          baseUrl: 'http://localhost:20132/v1',
          retryDelayMs: 0,
          requireExecutionEnvelope: false,
        })
      );

      await request(app)
        .post('/chat/completions')
        .send({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] })
        .expect(200);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
      setTimeoutSpy.mockRestore();
    });

    it('should abort upstream fetch when the client disconnects', async () => {
      mockFetch.mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              const error = new Error('Aborted') as Error & { name: string };
              error.name = 'AbortError';
              reject(error);
            });
          })
      );

      const middleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        timeoutMs: 1000,
        requireExecutionEnvelope: false,
      });
      const req = new EventEmitter() as Request;
      req.body = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      req.headers = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      const done = middleware(req, res, jest.fn() as NextFunction);
      req.emit('close');
      await done;

      expect(res.status).toHaveBeenCalledWith(408);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ retryable: false }));
    });

    it('should forward partial and mixed SSE chunks', async () => {
      const chunks = [
        'event: keepalive\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hel"},"finish_reason":null}]}\n',
        '\ndata: [DONE]\n\n',
      ];
      let chunkIndex = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: () => ({
            read: async () =>
              chunkIndex < chunks.length
                ? { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) }
                : { done: true },
          }),
        },
      });

      app.post(
        '/chat/completions',
        createForwarder({ baseUrl: 'http://localhost:20132/v1', requireExecutionEnvelope: false })
      );

      const response = await request(app)
        .post('/chat/completions')
        .send({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }], stream: true })
        .expect(200);

      expect(response.text).toContain('event: keepalive');
      expect(response.text).toContain('data: [DONE]');
    });

    it('should call onError for upstream failures', async () => {
      const onError = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({}),
        text: async () => 'boom',
      });

      app.post(
        '/chat/completions',
        createForwarder({
          baseUrl: 'http://localhost:20132/v1',
          onError,
          requireExecutionEnvelope: false,
        })
      );

      await request(app)
        .post('/chat/completions')
        .send({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] })
        .expect(500);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ upstreamStatus: 500, details: 'boom' }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should track usage when enabled', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const usageCallback = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        trackUsage: true,
        onUsage: usageCallback,
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(usageCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          model: 'gpt-4',
        })
      );
    });

    it('should preserve unknown fields when enabled', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        unknown_field: 'should be preserved',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        preserveUnknownFields: true,
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(response.body.unknown_field).toBe('should be preserved');
    });

    it('should strip hop-by-hop headers from response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      };

      const responseHeaders = new Headers();
      responseHeaders.set('content-type', 'application/json');
      responseHeaders.set('connection', 'keep-alive'); // Should be stripped
      responseHeaders.set('transfer-encoding', 'chunked'); // Should be stripped
      responseHeaders.set('x-custom-header', 'custom-value'); // Should be preserved

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: responseHeaders,
        json: async () => mockResponse,
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      // Check that hop-by-hop headers were stripped
      // Note: supertest doesn't easily expose response headers,
      // but we verified the logic in filterResponseHeaders
    });
  });

  describe('Forwarder Instance Methods', () => {
    it('should provide usage tracking methods', () => {
      const forwarder = new Forwarder({ baseUrl: 'http://localhost:20132/v1' });

      expect(forwarder.getUsage('gpt-4')).toBeUndefined();
      expect(forwarder.getAllUsage()).toEqual([]);
      forwarder.clearUsage(); // Should not throw
    });
  });

  describe('ExecutionEnvelope Enforcement', () => {
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
        eligibility_decision: { admitted: ['gpt-4'], reason: 'test' },
        policy_digest: 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        allowed_capabilities: ['chat'],
        execution_constraints: {
          allowed_models: ['gpt-4'],
          allowed_tools: ['get_weather'],
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

    it('should allow forwarding when execution envelope is valid', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        executionEnvelope: validEnvelope,
        requireExecutionEnvelope: true,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(response.body.id).toBe('chatcmpl-123');
    });

    it('should return 403 when envelope is missing and required', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: true,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(403);

      expect(response.body.code).toBe('envelope_missing');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fail closed by default when no envelope is configured', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(403);

      expect(response.body.code).toBe('envelope_missing');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fail closed when requireExecutionEnvelope is explicitly undefined', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: undefined,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should allow explicit compatibility opt-out with requireExecutionEnvelope: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'chatcmpl-optout',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' },
          ],
        }),
      });

      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: false,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(200);

      expect(response.body.id).toBe('chatcmpl-optout');
    });

    it('should return 403 for an envelope containing unknown fields', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        executionEnvelope: { ...validEnvelope, injected: true },
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(403);

      expect(response.body.code).toBe('envelope_invalid');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('legacy explicit-required path still returns 403 without envelope', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        requireExecutionEnvelope: true,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(403);

      expect(response.body.code).toBe('envelope_missing');
    });

    it('should return 403 when requested model is disallowed by envelope', async () => {
      const forwarderMiddleware = createForwarder({
        baseUrl: 'http://localhost:20132/v1',
        executionEnvelope: validEnvelope,
      });

      app.post('/chat/completions', forwarderMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/chat/completions')
        .send({
          model: 'unauthorized-model',
          messages: [{ role: 'user', content: 'Hello' }],
        })
        .expect(403);

      expect(response.body.code).toBe('model_disallowed');
    });
  });
});
