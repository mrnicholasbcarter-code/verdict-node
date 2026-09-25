#!/usr/bin/env node

/**
 * Consumer smoke test for @bodanglin/verdict-node
 *
 * Verifies:
 * 1. ESM import of root and ./middleware subpath
 * 2. TypeScript compilation against shipped .d.ts
 * 3. Package file list (only allowlisted files)
 * 4. CJS require() behavior (works on Node >= 20.19 / >= 22.12)
 */

import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const NODE_VERSION = process.version;
const [major, minor] = NODE_VERSION.slice(1).split('.').map(Number);

// Parse Node version to determine require(esm) support
const supportsRequireESM = 
  (major === 20 && minor >= 19) ||
  (major === 22 && minor >= 12) ||
  (major >= 23);

console.log(`Running consumer smoke test on Node ${NODE_VERSION}`);
console.log(`require(esm) support: ${supportsRequireESM ? 'YES' : 'NO'}\n`);

// Create a temp directory
const tempDir = mkdtempSync(join(tmpdir(), 'verdict-node-smoke-'));
console.log(`Temp directory: ${tempDir}`);

let exitCode = 0;

try {
  // 1. Pack the package
  console.log('\n1. Packing the package...');
  const packOutput = execSync('npm pack --quiet', { cwd: projectRoot, encoding: 'utf-8' });
  const tarball = packOutput.trim().split('\n').pop();
  console.log(`   Created: ${tarball}`);

  // Copy tarball to temp directory
  const tarballSrc = join(projectRoot, tarball);
  const tarballDest = join(tempDir, tarball);
  copyFileSync(tarballSrc, tarballDest);

  // 2. Create a consumer package.json
  console.log('\n2. Creating consumer project...');
  const consumerPkg = {
    name: 'verdict-node-consumer-test',
    version: '1.0.0',
    type: 'module',
    dependencies: {
      '@bodanglin/verdict-node': `file:./${tarball}`,
      '@bodanglin/verdict-contracts': '^0.2.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  };

  writeFileSync(join(tempDir, 'package.json'), JSON.stringify(consumerPkg, null, 2));

  // 3. Install the tarball
  console.log('\n3. Installing the package...');
  execSync('npm install --loglevel=error', { cwd: tempDir, stdio: 'inherit' });

  // 4. Test ESM import of root export
  console.log('\n4. Testing ESM import of root export...');
  const esmRootTest = `
import { verifyExecutionEnvelope, EnvelopeVerdict } from '@bodanglin/verdict-node';

console.log('ESM root import: OK');
console.log('  verifyExecutionEnvelope:', typeof verifyExecutionEnvelope);
console.log('  EnvelopeVerdict:', typeof EnvelopeVerdict);

if (typeof verifyExecutionEnvelope !== 'function') {
  console.error('ERROR: verifyExecutionEnvelope is not a function');
  process.exit(1);
}
`;
  writeFileSync(join(tempDir, 'test-esm-root.mjs'), esmRootTest);
  execSync('node test-esm-root.mjs', { cwd: tempDir, stdio: 'inherit' });

  // 5. Test ESM import of ./middleware subpath
  console.log('\n5. Testing ESM import of ./middleware subpath...');
  const esmMiddlewareTest = `
import { validate, createForwarder } from '@bodanglin/verdict-node/middleware';

console.log('ESM middleware import: OK');
console.log('  validate:', typeof validate);
console.log('  createForwarder:', typeof createForwarder);

if (typeof validate !== 'function' || typeof createForwarder !== 'function') {
  console.error('ERROR: middleware exports not available');
  process.exit(1);
}
`;
  writeFileSync(join(tempDir, 'test-esm-middleware.mjs'), esmMiddlewareTest);
  execSync('node test-esm-middleware.mjs', { cwd: tempDir, stdio: 'inherit' });

  // 6. Test TypeScript compilation
  console.log('\n6. Testing TypeScript compilation...');
  const tsTest = `
import { verifyExecutionEnvelope, EnvelopeVerdict, type VerifyExecutionEnvelopeOptions } from '@bodanglin/verdict-node';
import { validate, createForwarder, type ForwarderConfig } from '@bodanglin/verdict-node/middleware';

const options: VerifyExecutionEnvelopeOptions = {
  now: '2024-01-15T12:00:00Z',
  expectedPolicyDigest: 'a'.repeat(64),
};

const config: ForwarderConfig = {
  baseUrl: 'http://localhost:8000',
};

console.log('TypeScript compilation: OK');
`;
  writeFileSync(join(tempDir, 'test-types.ts'), tsTest);

  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
    },
  };
  writeFileSync(join(tempDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  execSync('npx tsc --noEmit', { cwd: tempDir, stdio: 'inherit' });

  // 7. Test CJS require() behavior according to Node version
  console.log('\n7. Testing CJS require() behavior...');
  const cjsTest = `
const supportsRequireESM = ${supportsRequireESM};

try {
  const mod = require('@bodanglin/verdict-node');
  
  if (supportsRequireESM) {
    console.log('CJS require: SUPPORTED (as documented for Node >= 20.19 / >= 22.12)');
    console.log('  Exports:', Object.keys(mod).join(', '));
    
    if (typeof mod.verifyExecutionEnvelope !== 'function') {
      console.error('ERROR: verifyExecutionEnvelope is not a function in CJS');
      process.exit(1);
    }
  } else {
    console.error('ERROR: require() should have failed on Node ${NODE_VERSION}');
    console.error('  This version does not support require(esm)');
    process.exit(1);
  }
} catch (err) {
  if (err.code === 'ERR_REQUIRE_ESM') {
    if (supportsRequireESM) {
      console.error('ERROR: require() failed on Node ${NODE_VERSION} but should work');
      console.error('  This version supports require(esm)');
      throw err;
    } else {
      console.log('CJS require: NOT SUPPORTED (expected on Node ${NODE_VERSION})');
      console.log('  This version does not support require(esm)');
      console.log('  Use ESM imports or upgrade to Node >= 20.19 / >= 22.12');
    }
  } else {
    console.error('CJS require: UNEXPECTED ERROR', err.message);
    throw err;
  }
}
`;
  writeFileSync(join(tempDir, 'test-cjs.cjs'), cjsTest);
  execSync('node test-cjs.cjs', { cwd: tempDir, stdio: 'inherit' });

  // 8. Verify package file list
  console.log('\n8. Verifying package file list...');
  const packDryRun = execSync('npm pack --dry-run --json', { cwd: projectRoot, encoding: 'utf-8' });
  const packInfo = JSON.parse(packDryRun)[0];
  const files = packInfo.files.map(f => f.path);

  console.log('   Files in package:');
  files.forEach(f => console.log(`     ${f}`));

  const allowedPatterns = [
    /^package\.json$/,
    /^README\.md$/,
    /^LICENSE$/,
    /^CHANGELOG\.md$/,
    /^dist\//,
    /^contracts\//,
  ];

  const disallowedFiles = files.filter(f => {
    return !allowedPatterns.some(pattern => pattern.test(f));
  });

  if (disallowedFiles.length > 0) {
    console.error('\n   ERROR: Unexpected files in package:');
    disallowedFiles.forEach(f => console.error(`     ${f}`));
    throw new Error('Package contains disallowed files');
  }

  console.log('   File list: OK (only allowlisted files)');

  console.log('\n✅ All smoke tests passed!');
} catch (error) {
  console.error('\n❌ Smoke test failed:', error.message);
  exitCode = 1;
} finally {
  // Cleanup
  console.log(`\nCleaning up ${tempDir}...`);
  rmSync(tempDir, { recursive: true, force: true });
}

process.exit(exitCode);
