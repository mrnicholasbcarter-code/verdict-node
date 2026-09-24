# Contributing

Thank you for helping. This is an **alpha** TypeScript package. Verdict Core makes policy decisions; this package enforces them at the HTTP edge. Changes must not add a second policy authority.

## Setup

Node.js 24 (CI) and npm. Install and verify:

```bash
npm ci
npm run typecheck
npm run format:check
npm run build
npm test
npm run verify:package
```

`npm test` runs Jest in ESM mode (`--experimental-vm-modules`). Do not call `npx jest` directly.

CI also builds `@bodanglin/verdict-contracts` from a verdict-core checkout and runs `verdict compat check` against `.verdict/compat-manifest.json`.

## Expectations

- Add or update a test for every behavior change. Security-relevant paths (envelope validation, refusal handling) need a regression test that fails before the fix.
- Refusals must fail closed. Never forward upstream after a refusal response.
- There is no enforced coverage threshold. Current line coverage is about 83% (`npm test -- --coverage`).
- Keep README claims matched to shipped behavior.

## Pull requests

- One logical change per PR, with a description of what changed and how it was verified.
- CI (typecheck, format, build, tests, package verification, contract parity, compat check) must pass.

See [SECURITY.md](SECURITY.md) to report vulnerabilities privately.
