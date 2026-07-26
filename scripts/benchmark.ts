#!/usr/bin/env node
/**
 * Benchmark harness for verdict-node
 * Measures: decision overhead, latency, streaming behavior, escalation rate
 */

import { performance } from 'perf_hooks';
import { createForwarder } from '../src/middleware/forwarder.js';
import express, { Request, Response } from 'express';

interface BenchmarkResult {
  timestamp: string;
  iterations: number;
  warmupIterations: number;
  results: {
    nonStream: LatencyStats;
    stream: LatencyStats;
    streamingChunks: ChunkStats;
  };
  overhead: {
    decisionMs: number;
    validationMs: number;
    totalOverheadMs: number;
  };
  escalationRate: number;
}

interface LatencyStats {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

interface ChunkStats {
  totalChunks: number;
  meanChunksPerRequest: number;
  meanTimeBetweenChunks: number;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(arr: number[]): LatencyStats {
  if (arr.length === 0) return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, stdDev: 0 };
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    mean: Math.round(mean * 100) / 100,
    p50: percentile(arr, 50),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
  };
}

async function runBenchmark() {
  const WARMUP = 10;
  const ITERATIONS = 50;
  const STREAM_ITERATIONS = 30;

  console.log('📊 Starting Verdict Node Benchmark');
  console.log(`   Warmup: ${WARMUP} iterations`);
  console.log(`   Non-stream: ${ITERATIONS} iterations`);
  console.log(`   Stream: ${STREAM_ITERATIONS} iterations`);
  console.log('');

  const latenciesNonStream: number[] = [];
  const latenciesStream: number[] = [];
  const chunkCounts: number[] = [];
  const chunkTimes: number[] = [];
  const validationTimes: number[] = [];
  let escalations = 0;

  // Create mock upstream server
  const upstreamApp = express();
  upstreamApp.use(express.json());
  
  upstreamApp.post('/v1/chat/completions', (req: Request, res: Response) => {
    const isStream = req.body.stream === true;
    const delay = Math.random() * 50 + 10; // 10-60ms
    
    if (isStream) {
      const chunks = 5;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let sent = 0;
      const interval = setInterval(() => {
        sent++;
        const chunk = {
          id: 'chatcmpl-test',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: req.body.model,
          choices: [{
            index: 0,
            delta: { content: `Token ${sent} ` },
            finish_reason: sent === chunks ? 'stop' : null,
          }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        
        if (sent === chunks) {
          res.write('data: [DONE]\n\n');
          res.end();
          clearInterval(interval);
        }
      }, delay / chunks);
    } else {
      setTimeout(() => {
        res.json({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: req.body.model,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Hello from mock upstream!' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });
      }, delay);
    }
  });

  const upstreamServer = upstreamApp.listen(0, async () => {
    const upstreamPort = (upstreamServer.address() as any).port;
    console.log(`🔧 Mock upstream running on port ${upstreamPort}`);

    // Create forwarder
    const forwarder = createForwarder({
      baseUrl: `http://localhost:${upstreamPort}/v1`,
      timeoutMs: 5000,
      maxRetries: 3,
      trackUsage: true,
    });

    // Create test app
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/v1/chat/completions', forwarder.middleware());

    const testServer = testApp.listen(0, async () => {
      const testPort = (testServer.address() as any).port;
      console.log(`🚀 Test gateway running on port ${testPort}`);
      console.log('');

      // Warmup
      console.log('🔥 Warming up...');
      for (let i = 0; i < WARMUP; i++) {
        await fetch(`http://localhost:${testPort}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'warmup' }] }),
        });
      }

      // Non-stream benchmark
      console.log('📈 Running non-stream benchmark...');
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const res = await fetch(`http://localhost:${testPort}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: `test ${i}` }] }),
        });
        const latency = performance.now() - start;
        latenciesNonStream.push(latency);
        
        if (res.status >= 500) escalations++;
      }

      // Stream benchmark
      console.log('🌊 Running stream benchmark...');
      for (let i = 0; i < STREAM_ITERATIONS; i++) {
        const start = performance.now();
        const res = await fetch(`http://localhost:${testPort}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: `stream ${i}` }], stream: true }),
        });
        const latency = performance.now() - start;
        latenciesStream.push(latency);

        // Count chunks
        const reader = res.body?.getReader();
        if (reader) {
          let chunks = 0;
          let lastChunkTime = performance.now();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks++;
            const now = performance.now();
            chunkTimes.push(now - lastChunkTime);
            lastChunkTime = now;
          }
          chunkCounts.push(chunks);
        }
        
        if (res.status >= 500) escalations++;
      }

      // Validation overhead test
      console.log('✅ Measuring validation overhead...');
      const validator = forwarder.getValidator?.();
      if (validator) {
        const testBody = { model: 'gpt-4', messages: [{ role: 'user', content: 'test' }] };
        for (let i = 0; i < 100; i++) {
          const vStart = performance.now();
          validator.validate(testBody);
          validationTimes.push(performance.now() - vStart);
        }
      }

      testServer.close();
      upstreamServer.close();

      // Calculate results
      const result: BenchmarkResult = {
        timestamp: new Date().toISOString(),
        iterations: ITERATIONS,
        warmupIterations: WARMUP,
        results: {
          nonStream: stats(latenciesNonStream),
          stream: stats(latenciesStream),
          streamingChunks: {
            totalChunks: chunkCounts.reduce((a, b) => a + b, 0),
            meanChunksPerRequest: chunkCounts.length > 0 ? Math.round(chunkCounts.reduce((a, b) => a + b, 0) / chunkCounts.length * 100) / 100 : 0,
            meanTimeBetweenChunks: chunkTimes.length > 0 ? Math.round(chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length * 100) / 100 : 0,
          },
        },
        overhead: {
          decisionMs: Math.round(stats(validationTimes).mean * 100) / 100,
          validationMs: Math.round(stats(validationTimes).mean * 100) / 100,
          totalOverheadMs: Math.round((stats(latenciesNonStream).mean - 35) * 100) / 100, // ~35ms is upstream mock delay
        },
        escalationRate: Math.round((escalations / (ITERATIONS + STREAM_ITERATIONS)) * 10000) / 100,
      };

      console.log('');
      console.log('📊 BENCHMARK RESULTS');
      console.log('====================');
      console.log('');
      console.log('Non-Stream Latency:');
      console.log(`  Mean: ${result.results.nonStream.mean}ms | P50: ${result.results.nonStream.p50}ms | P95: ${result.results.nonStream.p95}ms | P99: ${result.results.nonStream.p99}ms`);
      console.log('');
      console.log('Stream Latency:');
      console.log(`  Mean: ${result.results.stream.mean}ms | P50: ${result.results.stream.p50}ms | P95: ${result.results.stream.p95}ms | P99: ${result.results.stream.p99}ms`);
      console.log('');
      console.log('Streaming:');
      console.log(`  Mean chunks/request: ${result.results.streamingChunks.meanChunksPerRequest}`);
      console.log(`  Mean time between chunks: ${result.results.streamingChunks.meanTimeBetweenChunks}ms`);
      console.log('');
      console.log('Overhead:');
      console.log(`  Decision/validation: ${result.overhead.decisionMs}ms`);
      console.log(`  Total gateway overhead: ${result.overhead.totalOverheadMs}ms`);
      console.log('');
      console.log(`Escalation rate: ${result.escalationRate}%`);
      console.log('');

      // Save results
      const fs = await import('fs');
      const path = await import('path');
      const resultsDir = path.join(process.cwd(), 'benchmark-results');
      if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
      const outputFile = path.join(resultsDir, `benchmark-${Date.now()}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`💾 Results saved to ${outputFile}`);

      process.exit(0);
    });
  });
}

runBenchmark().catch(console.error);
