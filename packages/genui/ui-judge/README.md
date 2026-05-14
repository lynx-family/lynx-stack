# @lynx-js/ui-judge

`@lynx-js/ui-judge` opens an arbitrary URL with Playwright and asks Midscene to
judge the rendered UI.

The first public API is `judgeUrl`. It returns a JSON-serializable object with a
single `visual-correctness` score from `0` to `5`.

```ts
import { judgeUrl } from '@lynx-js/ui-judge';

const result = await judgeUrl({
  url: 'http://localhost:3000/render.html',
  task: 'The page should render a login form with email, password, and submit.',
  steps: ['Click the submit button.'],
});
```

Midscene reads its model configuration from the standard Midscene environment
variables, such as `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_API_KEY`,
`MIDSCENE_MODEL_NAME`, and `MIDSCENE_MODEL_FAMILY`.

The Playwright test suite uses the real Midscene service when
`MIDSCENE_MODEL_NAME` is present. Without model configuration, the model-backed
test is skipped and the error-path test still runs.
