# Data Model: 002-fail-closed-next-handler

## Entities

### Policy check result

| Field | Meaning |
|-------|---------|
| allowed | True only when a valid allow decision is present |
| refusal | Already-written caller response when not allowed |
| envelope | Authorization record attached only on allow |

### Continuation decision

| State | Rule |
|-------|------|
| refuse | Return the refusal. Zero upstream forwards. |
| allow | Forward only after envelope checks (default path). |
| compatibility opt-out | Explicit non-default path; not represented as policy-gated. |

### Bypass (must be closed on default path)

| Bypass | Required close |
|--------|----------------|
| Continue after refusal | Stop; do not forward |
| Missing envelope | Refuse; do not forward |
| Local model swap | Recheck against envelope or refuse |
| Missing integrity evidence | Refuse or attach independent digest evidence |

## State transitions

```text
request
  -> policy check
      -> refusal written -> STOP (no upstream)
      -> allow + envelope ok -> forward
      -> allow + envelope missing/invalid (default path) -> STOP
      -> new bypass found -> STOP until closed
```
