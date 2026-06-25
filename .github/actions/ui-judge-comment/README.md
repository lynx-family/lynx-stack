# UI Judge Comment

Creates or updates a pull request comment with `@lynx-js/ui-judge` results.

The action accepts either a pre-rendered markdown `body-file` or JSON shaped as
one `UiJudgeResult`, an array of results, or an object with a `results` array.
Pass exactly one of `body-file`, `result-file`, or `result-json`.

Rust UI Judge can write the markdown body directly:

```bash
cargo run -p ui_judge --bin ui-judge -- judge-android-agent \
  --scenarios packages/genui/ui-judge/tests/scenarios/android-geqi.json \
  --result-file ui-judge-results.json \
  --comment-file ui-judge-comment.md \
  --all-geqi
```

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write

steps:
  - uses: actions/download-artifact@v4
    with:
      name: ui-judge-report
      path: ui-judge-report

  - uses: ./.github/actions/ui-judge-comment
    with:
      body-file: ui-judge-report/ui-judge-comment.md
```

The existing JSON result path is still supported:

```yaml
permissions:
  pull-requests: write

steps:
  - run: pnpm --filter @lynx-js/ui-judge test
    env:
      UI_JUDGE_RESULT_FILE: ${{ github.workspace }}/ui-judge-results.json

  - uses: ./.github/actions/ui-judge-comment
    with:
      result-file: ui-judge-results.json
```

Example result payload:

```json
{
  "results": [
    {
      "demoId": "recs",
      "dimension": "visual-correctness",
      "dimensions": [
        {
          "dimension": "usability-interaction",
          "dimensionLabel": "Usability & Interaction",
          "score": 4,
          "steps": [],
          "url": "http://127.0.0.1:3000/render.html?demo=recs",
          "weight": 30
        }
      ],
      "score": 3,
      "steps": [],
      "url": "http://127.0.0.1:3000/render.html?demo=recs"
    }
  ]
}
```

When a result includes weighted GEQI `dimensions`, the comment renders one row
per example, adds one column per GEQI dimension, and shows the weighted
100-point GEQI score without replacing the visual-correctness score.

Inputs:

- `body-file`: path to a pre-rendered markdown comment body.
- `result-file`: path to a JSON result file.
- `result-json`: inline JSON result payload. Use this instead of
  `result-file`.
- `pr-number`: pull request number. Defaults to the `pull_request` event.
- `title`: comment heading. Defaults to `UI Judge`.
- `marker`: hidden marker used to update a previous comment.
- `update-existing`: update the previous marked comment. Defaults to `true`.
- `dry-run`: print the comment body without calling the GitHub API.
- `github-token`: token for the GitHub API. Defaults to `github.token`.
