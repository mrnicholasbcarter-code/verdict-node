# Quickstart: 002-fail-closed-next-handler

Work only in this worktree. Do not edit the dirty `feat/nod002-parity-gate` checkout. Do not rewrite README until tests pass.

## 1. Tests first

From the worktree root:

```bash
npm test -- tests/router.test.ts
```

Add cases for timeout, invalid decision payload, and no decision endpoint. Each must be 503 (or the existing refusal) with **no** `/chat/completions` fetch.

## 2. Bypass cases

Same file (or adjacent): missing envelope on the default path does not forward; substituted ladder model is rechecked or refused.

## 3. Allow path still works

Existing compatibility and allow tests stay green.

## 4. README last

Only after the suite is green, replace the "Critical limitation / Critical defect" paragraphs so they match fail-closed behavior. Keep alpha and envelope-reconciliation statements.

## 5. CI

`npm test` and lint as in `package.json`.
