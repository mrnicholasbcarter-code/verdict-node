#!/usr/bin/env node
/**
 * Quickstart demo for @bodanglin/verdict-node
 * Run with: npx tsx scripts/quickstart_demo.ts
 */

import express from 'express';
import { createForwarder } from '../src/middleware/forwarder.js';

const app = express();
app.use(express.json());

// Create the forwarder middleware (createForwarder returns the middleware function)
const forwarderMiddleware = createForwarder({
  baseUrl: 'http://localhost:20132/v1',
  timeoutMs: 30000,
  maxRetries: 3,
  trackUsage: true,
});

app.use('/v1/chat/completions', forwarderMiddleware);

const PORT = process.env.PORT || 8080;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Verdict Node Gateway running on http://localhost:${PORT}`);
    console.log(`📡 Forwarding to http://localhost:20132/v1`);
    console.log('');
    console.log('Example usage:');
    console.log(`  curl -X POST http://localhost:${PORT}/v1/chat/completions \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'`);
    console.log('');
    console.log('Press Ctrl+C to stop');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    server.close(() => process.exit(0));
  });
}

export { app, forwarderMiddleware };
