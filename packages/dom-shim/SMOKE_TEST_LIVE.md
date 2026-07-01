# Benchmark Report — `run-2026-06-14T07-37-14-249Z`

- Model: `gpt-4o`
- Started: 2026-06-14T07:37:14.249Z
- Finished: 2026-06-14T07:37:19.794Z
- Rounds (N): 1
- Concurrency: 4
- Total records: 6

## Summary

| Route | parse_ok | render_ok | convergence | visual_score (mean) | n |
| ----- | -------- | --------- | ----------- | ------------------- | - |
| A     | 1.000    | 0.000     | 0.000       | n/a                 | 2 |
| B     | 1.000    | 0.500     | 0.500       | n/a                 | 2 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 | 2 |

## Per-category breakdown

### interactive

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 0.000     | 0.000       | n/a                 |
| B     | 1.000    | 0.500     | 0.500       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

## Per-prompt detail

| Prompt | Category    | Complexity | A render | B render | C render |
| ------ | ----------- | ---------- | -------- | -------- | -------- |
| P001   | interactive | trivial    | ❌ (1r)  | ✅ (r1)  | ✅ (r1)  |
| P002   | interactive | trivial    | ❌ (1r)  | ❌ (1r)  | ✅ (r1)  |

## Failure analysis (top error patterns per route)

### Route A

| Count | Pattern              |
| ----- | -------------------- |
| 2     | Unexpected token ':' |

### Route B

| Count | Pattern                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | runtime ran without throwing but counters were creates=2 appends=1 flushes=0 — make sure to call **flush**() at the end |

### Route C — no failures (or all dry-run).

## Recommendation

Route **C** leads on render_ok by 0.500 over the runner-up (route B). This is the route the data supports continuing with into Phase 2.

## Caveats

- **Visual scoring not measured.** All `visual_score` values are null. This is expected when running with `--dry-run` (no real LLM calls) or when `ANTHROPIC_API_KEY` is unset. M1/M2/M3 metrics are still meaningful; M4 is absent from the aggregate.
