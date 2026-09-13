# @bodanglin/verdict-node — TypeScript Gateway Adapter

[![npm](https://img.shields.io/npm/v/@bodanglin/verdict-node.svg)](https://www.npmjs.com/package/@bodanglin/verdict-node)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![CI](https://github.com/mrnicholasbcarter-code/verdict-node/actions/workflows/ci.yml/badge.svg)](https://github.com/mrnicholasbcarter-code/verdict-node/actions/workflows/ci.yml)

> **Safety-checking middleware for Express and Next.js apps that call an OpenAI-compatible API.** In short: **Verdict Core decides, verdict-node enforces at the HTTP edge** — this package does not make policy decisions itself, it checks each outgoing request against a decision made elsewhere before letting it through.

---

## What is @bodanglin/verdict-node?

`@bodanglin/verdict-node` is a TypeScript middleware library for Express and Next.js. In plain terms, it sits in front of your app's calls to an OpenAI-compatible API and checks each request before it goes out — it does not decide what is allowed; that is the job of **Verdict Core** (the Python control plane). This package's job is to enforce Core's decision at the HTTP edge: **core decides, node enforces**.

The mechanism it enforces against is called an `ExecutionEnvelope` — plain-language: a signed record of what Core has authorized for a given request. By default, the standalone Express forwarder rejects a request outright ("fail-closed") if it arrives without a valid envelope or fails a policy check. The canonical cross-language contract for that envelope between Core (Python) and Node (TypeScript) is **still being reconciled**, so this alpha must not be represented as complete end-to-end policy enforcement yet. Node also retains its own local classification, discovery, ranking, and fallback behavior for compatibility routing; those heuristics are separate from, and not a substitute for, Core's authorization.

**Works with any OpenAI-compatible client**: Claude Code, Codex, Cursor, Cline, Hermes, Agents SDK, raw HTTP.

---

## Status

**Alpha** — not production-ready. Current implementation provides:

- Fail-closed `ExecutionEnvelope` validation in the standalone forwarder by default
- A shared pre-forward envelope check for streaming and non-streaming requests when an envelope is supplied to the gateway
- Zod request/response schemas
- Heuristic criticality classification and model catalog discovery for compatibility routing
- Bounded fallback ladder for selected HTTP/network failures
- Explicit compatibility opt-outs for deployments that do not yet require Core decisions or envelopes
- Streaming SSE and non-streaming JSON forwarding
- In-memory score cache (process-local)

**Missing** (tracked on release board):

- Verified Ruflo/RuVector IntelligenceService integration
- Persistent learning / cross-process state
- Reliable live quota/headroom data
- Full OpenAI field preservation
- Complete adversarial streaming/fallback contract

### Supported TypeScript toolchain

This release supports TypeScript `5.9.x` with `ts-jest@29.4.x` and Jest 30.
`ts-jest@29.4.x` declares `typescript >=4.3 <7`, so TypeScript 7 is not a
supported configuration for this package. Keep the compiler pinned to the
documented 5.9 line until a ts-jest release with an explicit TypeScript 7 peer
range is available and verified. Issue [#14](https://github.com/mrnicholasbcarter-code/verdict-node/issues/14)
tracks that upgrade; the supported ceiling is intentional rather than hidden
behind an install fallback.

---

## Install

```bash
npm install @bodanglin/verdict-node
# or
pnpm add @bodanglin/verdict-node
# or
yarn add @bodanglin/verdict-node
```

**Peer dependency**: `express@>=5.0.0 <6` only when using Express middleware. Next.js `/api` routes can use the generic handler without mounting Express.

---

## Quick Start

### Express standalone forwarder

```typescript
import express from 'express';
import { createForwarder } from '@bodanglin/verdict-node/middleware';

const app = express();
app.use(express.json());

// Obtain these values from independent trusted Core outputs.
const coreEnvelope: unknown = await loadCoreEnvelope();
const trustedPolicyDigest = await loadTrustedPolicyDigest();

app.use(
  '/v1',
  createForwarder({
    baseUrl: process.env.VERDICT_UPSTREAM ?? 'http://127.0.0.1:20132/v1',
    apiKey: process.env.OMNIROUTE_API_KEY,
    executionEnvelope: coreEnvelope,
    expectedPolicyDigest: trustedPolicyDigest,
  })
);

app.listen(3000, () => console.log('verdict-node listening on :3000'));
```

`executionEnvelope` is currently configured on the middleware instance. Create or scope middleware instances so an envelope cannot be reused for unrelated requests, and derive `trustedPolicyDigest` from an independent trusted policy source rather than from the envelope itself. `requireExecutionEnvelope` defaults to `true`; setting it to `false` is an explicit compatibility opt-out, not Core-authorized execution.

### Next.js `/api` route — Currently Not Fail-Closed

```typescript
// pages/api/chat/completions.ts
import { createNextApiHandler } from '@bodanglin/verdict-node';

export default createNextApiHandler({
  baseUrl: process.env.OMNIROUTE_BASE_URL ?? 'http://127.0.0.1:20132/v1',
  apiKey: process.env.OMNIROUTE_API_KEY,
  decisionEndpoint: process.env.VERDICT_CORE_DECISION_ENDPOINT,
});
```

**Fail-closed handler:** `createNextApiHandler` returns after middleware writes HTTP 503 or another refusal (`headersSent` or `statusCode >= 400`) and does **not** call `proxy()`. Envelope validation, ladder-model recheck, and policy-digest integrity remain fail-closed. Compatibility opt-out (`requireCoreDecision: false`) is explicit only.

---

## Configuration

### `ForwarderConfig`

```typescript
import { createForwarder, type ForwarderConfig } from '@bodanglin/verdict-node/middleware';

const config: ForwarderConfig = {
  baseUrl: process.env.VERDICT_UPSTREAM ?? 'http://127.0.0.1:20132/v1',
  apiKey: process.env.OMNIROUTE_API_KEY,
  executionEnvelope: coreEnvelope,
  expectedPolicyDigest: trustedPolicyDigest,
  timeoutMs: 30_000,
  maxRetries: 3,
};

app.use('/v1', createForwarder(config));
```

### `GatewayConfig`

```typescript
import { createNextApiHandler, type GatewayConfig } from '@bodanglin/verdict-node';

const config: GatewayConfig = {
  baseUrl: process.env.OMNIROUTE_BASE_URL,
  apiKey: process.env.OMNIROUTE_API_KEY,
  decisionEndpoint: process.env.VERDICT_CORE_DECISION_ENDPOINT,
  decisionTimeoutMs: 2_000,
};

export default createNextApiHandler(config);
```

---

## API

### `createForwarder(config: ForwarderConfig): express.RequestHandler`

The standalone Express forwarder validates the configured envelope before its first upstream fetch. By default it rejects missing, invalid, expired, or out-of-bounds envelopes with machine-readable denial codes. It then forwards non-streaming JSON or streaming SSE responses without substituting the request model.

### `createNextApiHandler(config: GatewayConfig): NextApiHandlerLike`

The higher-level gateway **intends** to request a Core routing decision by default and return HTTP 503 when no decision is available. However, the current implementation has a critical defect: after `middleware()` writes a 503 response (no decision or denied), it does not call `next()`, but `nextApiHandler()` unconditionally proceeds to call `proxy()`. The proxy path skips envelope validation when no envelope is attached and may execute an upstream fetch. **This path is not fail-closed.** Current limitations tracked by NOD-002 include this continuation-after-503 defect, a missing-envelope enforcement gap, locally substituted ladder models that are not revalidated against the envelope, and missing policy-digest integrity evidence on this path.

### Types

```typescript
import type { GatewayConfig, OpenAIChatCompletionRequest } from '@bodanglin/verdict-node';
import type {
  ForwarderConfig,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
} from '@bodanglin/verdict-node/middleware';
```

---

## Integration with Verdict Core

Verdict Core is the intended authority for policy-gated execution; Node is an edge and transport adapter. Core and Node do not yet share a fully reconciled, published `ExecutionEnvelope` contract or verified issuance-to-enforcement fixture. Until that work is complete, treat the envelope support here as partial enforcement rather than proof of end-to-end Core authorization.

For the higher-level gateway, point `decisionEndpoint` (or `VERDICT_CORE_DECISION_ENDPOINT`) at the Core routing-decision endpoint. The standalone forwarder instead accepts an envelope through `ForwarderConfig.executionEnvelope` and requires one by default. Both APIs expose explicit compatibility opt-outs; those modes are not policy-gated execution. **Critical defect:** `createNextApiHandler` currently continues into `proxy()` after `middleware()` writes HTTP 503, bypassing envelope validation and potentially forwarding to upstream. NOD-002 remains open until shared Core fixtures, complete envelope parity, the continuation-after-503 fix, and removal of every production-path policy bypass are verified.

---

## Development

```bash
# Install deps
npm install

# Type-check
npm run typecheck

# Lint
npm run lint

# Test
npm test

# Build
npm run build

# Verify package
npm run verify:package
```

---

## Project Structure

```
verdict-node/
├── src/
│   ├── index.ts                         # Gateway and Next.js exports
│   ├── adapters/
│   │   └── contract-to-middleware.ts    # Canonical-decision adapter
│   └── middleware/
│       ├── index.ts                     # Middleware exports
│       ├── forwarder.ts                 # Express JSON/SSE forwarder
│       └── validator.ts                 # Validation helpers
├── tests/
├── scripts/                             # Package verification
├── docs/adr/
└── package.json
```

---

## Ecosystem

| Package                                                           | Purpose                                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`verdict-core`](https://github.com/verdict/verdict-core)         | Python control plane                                                                                                 |
| `@bodanglin/verdict-node`                                         | Express/Next.js middleware (this repo)                                                                               |
| [`verdict-cockpit`](https://github.com/verdict/verdict-cockpit)   | Next.js dashboard                                                                                                    |
| [`verdict-risk`](https://github.com/verdict/verdict-risk)         | Risk engine                                                                                                          |
| [`verdict-edge`](https://github.com/verdict/verdict-edge)         | Edge mining framework                                                                                                |
| [`verdict-backtest`](https://github.com/verdict/verdict-backtest) | Monte Carlo harness                                                                                                  |
| OmniRoute                                                         | Per OmniRoute's own description: 250+ providers, 90+ free tiers (third-party claim, not verified by this repository) |

---

## Links

- **Verdict Core**: https://github.com/verdict/verdict-core
- **Verdict Cockpit**: https://github.com/verdict/verdict-cockpit
- **Issues**: https://github.com/verdict/verdict-node/issues
- **Discord**: https://discord.gg/verdict

---

## License

MIT — see [LICENSE](LICENSE)
