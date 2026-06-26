# UI Judge Comment

Creates or updates a pull request comment with `@lynx-js/ui-judge` results.

The action renders Markdown from JSON shaped as one `UiJudgeResult`, an array of
results, or an object with a `results` array. Pass exactly one of `result-file`,
`result-json`, or `body-file`. The `body-file` input is retained for generic
pre-rendered Markdown, but UI Judge CI should use JSON so this action remains
the single owner of PR comment formatting and GEQI Markdown.

Rust UI Judge writes the JSON result payload:

```bash
cargo run -p ui_judge --bin ui-judge -- judge-android-agent \
  --scenarios packages/genui/ui-judge/tests/scenarios/android-geqi.json \
  --result-file ui-judge-results.json \
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
      name: ui-judge-results
      path: ui-judge-results

  - uses: ./.github/actions/ui-judge-comment
    with:
      result-file: ui-judge-results/ui-judge-results.json
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
          "dimensionLabel": "Usability & Interaction Logic",
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
