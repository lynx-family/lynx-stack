# Benchmark Report — `run-2026-06-14T08-31-39-600Z`

- Model: `gpt-4o`
- Started: 2026-06-14T08:31:39.600Z
- Finished: 2026-06-14T08:32:21.970Z
- Rounds (N): 3
- Concurrency: 4
- Total records: 32

## Summary

| Route | parse_ok | render_ok | convergence | visual_score (mean) | n  |
| ----- | -------- | --------- | ----------- | ------------------- | -- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 | 10 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 | 10 |
| C     | 0.800    | 0.800     | 1.000       | n/a                 | 10 |

## Per-category breakdown

### interactive

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

### form

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

### layout

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

### list

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 0.500    | 0.500     | 1.000       | n/a                 |

### media

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

### navigation

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 1.000    | 1.000     | 1.000       | n/a                 |

### data-display

| Route | parse_ok | render_ok | convergence | visual_score (mean) |
| ----- | -------- | --------- | ----------- | ------------------- |
| A     | 1.000    | 1.000     | 1.000       | n/a                 |
| B     | 1.000    | 1.000     | 1.000       | n/a                 |
| C     | 0.500    | 0.500     | 1.000       | n/a                 |

## Per-prompt detail

| Prompt | Category     | Complexity | A render | B render | C render |
| ------ | ------------ | ---------- | -------- | -------- | -------- |
| P007   | interactive  | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P014   | form         | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P015   | form         | complex    | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P023   | layout       | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P029   | list         | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P030   | list         | complex    | ✅ (r1)  | ✅ (r1)  | ✅ (r2)  |
| P034   | media        | complex    | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P041   | navigation   | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |
| P048   | data-display | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r2)  |
| P049   | data-display | moderate   | ✅ (r1)  | ✅ (r1)  | ✅ (r1)  |

## Failure analysis (top error patterns per route)

### Route A — no failures (or all dry-run).

### Route B — no failures (or all dry-run).

### Route C

| Count | Pattern                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | Schema validation: [{"instancePath":"/children/1/children/1","schemaPath":"#/additionalProperties","keyword":"additional |
| 1     | Schema validation: [{"instancePath":"/children/0/tag","schemaPath":"#/properties/tag/enum","keyword":"enum","params":{"a |

## Caveats

- **Visual scoring not measured.** All `visual_score` values are null. This is expected when running with `--dry-run` (no real LLM calls) or when `ANTHROPIC_API_KEY` is unset. M1/M2/M3 metrics are still meaningful; M4 is absent from the aggregate.
