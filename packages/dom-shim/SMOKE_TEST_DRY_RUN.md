# Benchmark Report — `run-2026-06-14T05-10-02-264Z`

- Model: `claude-opus-4-7`
- Started: 2026-06-14T05:10:02.264Z
- Finished: 2026-06-14T05:10:02.274Z
- Rounds (N): 1
- Concurrency: 4
- Total records: 6

## Summary

| Route | parse_ok | render_ok | convergence | visual_score (mean) | n |
| ----- | -------- | --------- | ----------- | ------------------- | - |
| A     | 1.000    | 1.000     | 1.000       | n/a                 | 2 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 | 2 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 | 2 |

## Per-category breakdown

### interactive

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

## Per-prompt detail

| Prompt | Category    | Complexity | A render | B render | C render |
| ------ | ----------- | ---------- | -------- | -------- | -------- |
| P001   | interactive | trivial    | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P002   | interactive | trivial    | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |

## Failure analysis (top error patterns per route)

### Route A — no failures (or all dry-run).

### Route B — no failures (or all dry-run).

### Route C — no failures (or all dry-run).

## Caveats

- **Visual scoring not measured.** All `visual_score` values are null. This is expected when running with `--dry-run` (no real LLM calls) or when `ANTHROPIC_API_KEY` is unset. M1/M2/M3 metrics are still meaningful; M4 is absent from the aggregate.
