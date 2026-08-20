/**
 * Emit the TypeScript accept/reject verdict for every shared envelope fixture.
 *
 * Part of the NOD-002 contract-parity CI gate: the JSON output is diffed
 * against the Python runner (`scripts/envelope_parity_verdicts.py`); any
 * difference means the two runtimes no longer enforce the same
 * ExecutionEnvelope invariants and the gate fails.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseContract } from '@bodanglin/verdict-contracts';

const fixturesDir = join(process.cwd(), 'test_fixtures', 'envelopes');
const verdicts = {};

for (const name of readdirSync(fixturesDir)
  .filter(entry => entry.endsWith('.json'))
  .sort()) {
  const payload = JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
  try {
    parseContract('execution_envelope', payload);
    verdicts[name] = 'accept';
  } catch {
    verdicts[name] = 'reject';
  }
}

process.stdout.write(`${JSON.stringify(verdicts, null, 2)}\n`);
