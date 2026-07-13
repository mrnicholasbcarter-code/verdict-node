# llm-gate-node

<div align="center">
  <p><strong>Intelligent Express & TypeScript Middleware Proxy for Autonomous AI Agents and Swarms</strong></p>
  <p>Sits between client agents (Claude Code, Cursor, Codex, Jcode) and multiplexers (9router, omniroute) to execute dynamic, self-optimizing prompt routing.</p>
  
  <p>
    <a href="https://github.com/nickhq/llm-gate-node/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build Status" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-strict-blue" alt="TypeScript" /></a>
    <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/express-v4-lightgrey" alt="Express" /></a>
    <a href="https://github.com/colinhacks/zod"><img src="https://img.shields.io/badge/validation-zod-purple" alt="Zod Validation" /></a>
    <a href="https://github.com/nickhq/llm-gate-node/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  </p>
</div>

---

## Overview

`llm-gate-node` is a high-availability, enterprise-grade Express/TypeScript middleware proxy designed to intercept and optimize LLM calls made by autonomous agents (such as **Claude Code**, **Cursor**, **Codex**, and **Jcode**). Acting as a smart "brain" in your request lifecycle, it evaluates incoming prompt payloads, classifies their criticality, and forwards them to a backend multiplexer like **9router** or **omniroute**.

By employing a **Self-Optimizing Neural Architecture (SONA)**, the proxy dynamically tracks upstream provider success rates, quotas, and latencies. It automatically learns the most cost-effective routing layout—offloading routine, low-risk requests to optimized models to **save $0/hr on costs** (effectively running background tasks at zero marginal cost when utilizing free-tier or local instances) while preserving premium, high-cost frontier model quotas exclusively for mission-critical tasks.

---

## Core Architecture

`llm-gate-node` acts as a drop-in gateway. It intercepts standard OpenAI-compatible API calls, passes them through a heuristic criticality classifier, runs the SONA sorting algorithm, checks live provider headroom, and routes the request down to the active model group.

```mermaid
graph LR
    %% Definition of Nodes
    Client[Client<br/>(Claude Code, Cursor, Codex, Jcode)]
    Brain["llm-gate-node (brain)"]
    Adapter["9router (adapter)"]
    Models["Models<br/>(Claude 3.5 Sonnet, Llama 3, Gemini 1.5 Pro)"]

    %% Flow Relationships
    Client -->|OpenAI-Compatible Call| Brain
    Brain -->|Optimized Route & Failover| Adapter
    Adapter -->|Request Multiplexing| Models

    %% Custom Styling
    style Client fill:#1e1e2f,stroke:#6c5ce7,stroke-width:2px,color:#ffffff
    style Brain fill:#2d2d44,stroke:#a8a8ff,stroke-width:3px,color:#ffffff
    style Adapter fill:#1e1e2f,stroke:#00cec9,stroke-width:2px,color:#ffffff
    style Models fill:#2d2d44,stroke:#00b894,stroke-width:2px,color:#ffffff
```

---

## Used By

`llm-gate-node` is deployed in demanding production setups to regulate LLM budgets, failover paths, and latency envelopes:

*   **Autonomous Engineering Swarms:** Powering background developers (like Claude Code and Jcode) that make thousands of checks, tests, and edits hourly.
*   **Enterprise IDE Proxy Servers:** Centralized gateways routing developer traffic from Cursor and VS Code to unified billing backends.
*   **Quantitative Trading Systems:** Safeguarding high-priority financial execution triggers (T0_CRITICAL) while offloading backtesting logs.
*   **Continuous Integration Pipelines:** Auto-analyzing test failures and logs on low-cost models without burning premium API limits.

---

## Key Features

*   🧠 **SONA (Self-Optimizing Neural Architecture):** Adaptive Q-learning route prioritization using live-updated success rates and heuristic latency calculations.
*   🛡️ **Deep Object Validation:** Powered by Zod schemas to sanitize and enforce OpenAI-compatible formats, preventing LLM hallucinations or client-breaking responses.
*   ⚡ **Dynamic Fallback Ladders:** Cascades sequentially down to healthy models when HTTP `402` (Out of Funds), `429` (Rate Limited), or network drops occur.
*   🚦 **Criticality Classification:** Heuristic matching separates mission-critical actions (e.g., money paths, live order entries) from routine analysis or documentation tasks.
*   📦 **Universal Framework Adapters:** Standardized patterns for Express, Fastify, Koa, and Hono.
*   🔌 **Zero-Dependency SQLite Sync:** Integrates with local 9router databases to retrieve provider connection IDs without configuration overhead.

---

## SONA: Self-Optimizing Neural Architecture

At the heart of `llm-gate-node` is **SONA** (Self-Optimizing Neural Architecture). Rather than relying on static fallback files or round-robin routing, SONA implements an autonomous feedback loop based on Q-learning.

### How it Works

SONA maintains a local Q-table tracking performance statistics per model:
1.  **Attempts & Successes:** Measures the historical completion rate of requests.
2.  **Latency Sum:** Tracks cumulative response times to evaluate average speed.
3.  **Active Headroom:** Queries `/api/usage` from the multiplexer backend to confirm model quotas.

Each candidate model is assigned a score calculated using an epsilon-greedy heuristic:

$$\text{Score} = \text{Success Rate} + \max\left(0, 0.1 - \frac{\text{Average Latency}}{100,000}\right)$$

### Cost Optimization: Trending to $0/hr

By dynamically mapping prompts to the lowest acceptable capability tier, SONA reduces operational expenses. For basic utility requests (Tier 3), it automatically selects highly optimized, low-cost (or local) models like Llama 3 8B or Gemini Flash. 

By offloading these high-frequency, low-risk requests, your background swarms can scale up infinitely while trending towards **$0/hr in additional costs** for routine tasks. Premium frontier models are kept idle and ready, preserving quota buffers only for Tier 0 (Critical) and Tier 1 (High) tasks.

---

## Installation

Install the package via your preferred Node package manager. Make sure you have `express` and `zod` installed as peer dependencies.

```bash
# Using npm
npm install @nickhq/llm-gate-node express zod

# Using yarn
yarn add @nickhq/llm-gate-node express zod

# Using pnpm
pnpm add @nickhq/llm-gate-node express zod
```

---

## Quickstart

Add the gateway middleware and proxy handlers directly into your Express router:

```typescript
import express from 'express';
import { LLMGateway } from '@nickhq/llm-gate-node';

const app = express();
app.use(express.json());

// Initialize the gateway pointing to your primary frontier model
const gateway = new LLMGateway({
  primaryModel: 'cc/claude-opus-4-8',
  baseUrl: 'http://localhost:20128/v1',
  usageUrl: 'http://localhost:20128/api',
  apiKey: process.env.OPENAI_API_KEY || 'your-key'
});

// Drop-in middleware and proxy handlers
app.post(
  '/v1/chat/completions',
  gateway.middleware(), // 1. Evaluates criticality & selects tier
  gateway.proxy()       // 2. Builds ladder, executes proxying & manages failovers
);

app.listen(3000, () => {
  console.log('LLM Gate Node Proxy running on port 3000');
});
```

---

## Integration Adapters

`llm-gate-node` can easily run on frameworks other than Express using adapters or wrapper functions.

### 1. Fastify Adapter

Fastify requires the `@fastify/middie` plugin to run Express-style middlewares natively, or you can invoke the proxy logic manually:

```typescript
import Fastify from 'fastify';
import middie from '@fastify/middie';
import { LLMGateway } from '@nickhq/llm-gate-node';

async function bootstrap() {
  const fastify = Fastify({ logger: true });
  await fastify.register(middie);

  const gateway = new LLMGateway('cc/claude-opus-4-8');

  // Register Express-compatible middleware
  fastify.use('/v1/chat/completions', gateway.middleware());

  // Execute proxy request using Fastify route handler
  fastify.post('/v1/chat/completions', async (request, reply) => {
    // Standardize req/res shapes for llm-gate-node express methods
    const req = request.raw as any;
    const res = reply.raw as any;
    
    // Inject body parsed by Fastify back into the raw request for the proxy handler
    req.body = request.body;

    await gateway.proxy()(req, res, (err) => {
      if (err) {
        reply.status(500).send({ error: err.message });
      }
    });
  });

  await fastify.listen({ port: 3000 });
}

bootstrap();
```

### 2. Koa Adapter

Use `koa-connect` to run Express middleware structures inside Koa's async context:

```typescript
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import c2k from 'koa-connect';
import { LLMGateway } from '@nickhq/llm-gate-node';

const app = new Koa();
const gateway = new LLMGateway('cc/claude-opus-4-8');

app.use(bodyParser());

// Inject middleware
app.use(async (ctx, next) => {
  if (ctx.path === '/v1/chat/completions' && ctx.method === 'POST') {
    // Adapt Express middleware
    const req = ctx.req as any;
    req.body = ctx.request.body;
    
    await c2k(gateway.middleware())(ctx, next);
  } else {
    await next();
  }
});

// Implement Koa proxy wrapper
app.use(async (ctx) => {
  if (ctx.path === '/v1/chat/completions' && ctx.method === 'POST') {
    const req = ctx.req as any;
    const res = ctx.res;

    await gateway.proxy()(req, res, (err) => {
      if (err) {
        ctx.status = 502;
        ctx.body = { error: err.message };
      }
    });
  }
});

app.listen(3000);
```

### 3. Hono Adapter

For Edge runtime frameworks like Hono running on Node, translate Hono's Context structure into the middleware expectation:

```typescript
import { Hono } from 'hono';
import { LLMGateway } from '@nickhq/llm-gate-node';

const app = new Hono();
const gateway = new LLMGateway('cc/claude-opus-4-8');

app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json();
  
  // Create mock Express request/response interfaces
  const expressReq: any = {
    body,
    headers: c.req.header(),
  };

  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};

  const expressRes: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
      return this;
    },
    json(data: any) {
      responseData = data;
    },
    write(chunk: any) {
      // Handle streaming or buffering as needed
    },
    end() {
      // Close connection
    }
  };

  // Run middleware evaluation
  await gateway.middleware()(expressReq, expressRes, () => {});
  
  // Run proxy execution
  await gateway.proxy()(expressReq, expressRes, (err) => {
    if (err) {
      statusCode = 502;
      responseData = { error: err.message };
    }
  });

  return c.json(responseData, { status: statusCode, headers });
});

export default app;
```

---

## Operational Details & Criticality Heuristics

`llm-gate-node` scans prompt requests to establish their tier before selecting the target list of models from 9router.

### Heuristic Tiers

| Tier | Name | Keywords / Matching Heuristic | Primary Models |
| :--- | :--- | :--- | :--- |
| **Tier 0** | `T0_CRITICAL` | Financial execution, order sizing, live deployment triggers. | `cc/claude-opus-4-8`, `gpt-4o` |
| **Tier 1** | `T_HIGH` | Architectural discussions, adversarial synthesis, debate. | `claude-3-5-sonnet`, `gemini-1.5-pro` |
| **Tier 2** | `T_MID` | Routine codegen, code refactoring, code reviews, audits. | `gpt-4o-mini`, `llama-3-70b` |
| **Tier 3** | `T_BASIC` | Logs search, simple regex validation, basic tasks. | `gemini-1.5-flash`, `llama-3-8b` |

If a task is evaluated as `Tier 3` (Basic), the gateway completely avoids routing to premium endpoints. By utilizing optimized local configurations or zero-cost models, you can save significant API cost and preserve rate limits for your most critical workflows.

---

## Advanced Deployment Examples

### Standalone Express Service

Use this approach to run the proxy as a microservice in front of your developer instances.

```typescript
import express from 'express';
import { LLMGateway, OpenAIChatCompletionRequestSchema } from '@nickhq/llm-gate-node';

const app = express();
const gateway = new LLMGateway({
  primaryModel: process.env.PRIMARY_MODEL || 'cc/claude-opus-4-8',
  baseUrl: process.env.BASE_URL || 'http://localhost:20128/v1',
  usageUrl: process.env.USAGE_URL || 'http://localhost:20128/api',
});

app.use(express.json({ limit: '10mb' }));

app.post('/v1/chat/completions', gateway.middleware(), gateway.proxy());

// Health check endpoint for container orchestrators
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Standalone Gateway Proxy online on port ${PORT}`);
});
```

### Docker Deployment

Create a lightweight container using a multi-stage build structure:

```dockerfile
# Stage 1: Build source files
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production runtime environment
FROM node:22-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Build and run the Docker image locally:

```bash
# Build the container
docker build -t llm-gate-node:latest .

# Run the container mapping port 3000 and pointing to your multiplexer
docker run -d \
  -p 3000:3000 \
  -e PORT=3000 \
  -e PRIMARY_MODEL="cc/claude-opus-4-8" \
  -e BASE_URL="http://host.docker.internal:20128/v1" \
  -e USAGE_URL="http://host.docker.internal:20128/api" \
  --name llm-gate-proxy \
  llm-gate-node:latest
```

### Kubernetes Manifest

Deploy to your Kubernetes cluster with rolling update strategies and liveness probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-gate-proxy
  labels:
    app: llm-gate-proxy
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: llm-gate-proxy
  template:
    metadata:
      labels:
        app: llm-gate-proxy
    spec:
      containers:
        - name: gateway
          image: ghcr.io/your-org/llm-gate-node:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
              name: http
          resources:
            limits:
              cpu: "1"
              memory: 1Gi
            requests:
              cpu: 250m
              memory: 256Mi
          env:
            - name: PORT
              value: "3000"
            - name: PRIMARY_MODEL
              value: "cc/claude-opus-4-8"
            - name: BASE_URL
              value: "http://9router-service.default.svc.cluster.local/v1"
            - name: USAGE_URL
              value: "http://9router-service.default.svc.cluster.local/api"
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-gate-secrets
                  key: api-key
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: llm-gate-proxy-service
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app: llm-gate-proxy
```

---

## Deep Validation Schemas (Zod)

`llm-gate-node` exports several Zod validation schemas. You can use these schemas directly in your application to check structural payloads before sending them over the wire:

```typescript
import { 
  OpenAIChatCompletionRequestSchema, 
  OpenAIChatCompletionResponseSchema,
  RoutingDecisionSchema 
} from '@nickhq/llm-gate-node';

// Validate Chat Request Body
const cleanRequest = OpenAIChatCompletionRequestSchema.safeParse(req.body);
if (!cleanRequest.success) {
  console.error("Invalid Request Payload structure:", cleanRequest.error.format());
}

// Validate Multiplexer Response
const cleanResponse = OpenAIChatCompletionResponseSchema.safeParse(upstreamResponse);
if (!cleanResponse.success) {
  console.error("Malformed LLM response:", cleanResponse.error.format());
}
```

---

## Developer Testing Suite

The code is fully tested with Jest and Supertest. The test matrix covers routing evaluations, payload structure sanitization, and fallback cascade executions.

```bash
# Run tests
npm test

# Run code formatter
npm run format

# Run linter
npm run lint

# Compile TypeScript
npm run build
```

---

## Contributing

We welcome contributions to optimize SONA scoring algorithms, add custom framework adapters, or expand safety validators.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

Please read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` before making any contributions.

---

## License

This project is licensed under the MIT License - see the [LICENSE](file:///home/nick/llm-gate-node/LICENSE) file for details.
