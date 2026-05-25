# UI Judge Comment

Creates or updates a pull request comment with `@lynx-js/ui-judge` results.

The action expects JSON shaped as one `UiJudgeResult`, an array of results, or
an object with a `results` array.

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
      "dimension": "visual-correctness",
      "score": 5,
      "steps": [],
      "url": "http://127.0.0.1:3000/render.html?demo=recs"
    }
  ]
}
```

Inputs:

- `result-file`: path to a JSON result file.
- `result-json`: inline JSON result payload. Use this instead of
  `result-file`.
- `pr-number`: pull request number. Defaults to the `pull_request` event.
- `title`: comment heading. Defaults to `UI Judge`.
- `marker`: hidden marker used to update a previous comment.
- `update-existing`: update the previous marked comment. Defaults to `true`.
- `dry-run`: print the comment body without calling the GitHub API.
- `github-token`: token for the GitHub API. Defaults to `github.token`.
