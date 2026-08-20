#!/usr/bin/env python3
"""Emit the Python accept/reject verdict for every shared envelope fixture.

Part of the NOD-002 contract-parity CI gate: the JSON output is diffed against
the TypeScript runner (``scripts/envelope-parity-verdicts.mjs``); any
difference means the two runtimes no longer enforce the same ExecutionEnvelope
invariants and the gate fails.

Requires ``verdict-core`` to be installed (the CI job installs it from git).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from verdict.contracts import ContractValidationError, ExecutionEnvelope

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "test_fixtures" / "envelopes"


def main() -> int:
    verdicts: dict[str, str] = {}
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        try:
            ExecutionEnvelope.from_dict(payload)
            verdicts[path.name] = "accept"
        except ContractValidationError:
            verdicts[path.name] = "reject"
    json.dump(verdicts, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
