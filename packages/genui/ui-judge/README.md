# @lynx-js/ui-judge

`@lynx-js/ui-judge` judges an existing Playwright page with Midscene.

The first public API is `judgePage`. Callers own the Playwright page lifecycle,
including navigation, viewport, cookies, route mocks, and authentication. The
judge reads `page.url()` for the returned JSON object and produces a single
score from `0` to `5`.

```ts
import { test } from '@playwright/test';

import { judgePage } from '@lynx-js/ui-judge';

test('judges generated UI', async ({ page }) => {
  await page.goto('http://localhost:3000/render.html');

  const result = await judgePage({
    dimension: 'usability-interaction',
    page,
    task:
      'The page should render a login form with email, password, and submit.',
    steps: ['Click the submit button.'],
  });
});
```

`runVisualEvaluation` compares one prepared reference image with a rendered Lynx
page URL. The `referenceImage` field accepts plain base64, a
`data:image/...;base64,...` URL, or an `http://` / `https://` image URL.

```ts
import { runVisualEvaluation } from '@lynx-js/ui-judge';

const result = await runVisualEvaluation({
  referenceImage: 'data:image/png;base64,...',
  templateUrl: 'http://localhost:3000/render.html',
  capture: {
    waitTimeMs: 500,
  },
});

console.log(result.score, result.reason);
console.log(result.artifacts.diffImageBase64);
```

The visual evaluation result follows this shape:

```ts
interface VisualEvaluationResponse {
  ok: true;
  score?: number;
  reason?: string;
  artifacts: {
    referenceImageBase64: string;
    deviceImageBase64: string;
    alignedReferenceImageBase64: string;
    alignedDeviceImageBase64: string;
    diffImageBase64: string;
  };
  metrics: {
    alignResult: AlignResult | null;
    compareResult: CompareResult;
    evaluationResult: EvaluationResult;
  };
  warnings?: string[];
}
```

Tests and custom runtimes can inject `capture` and `evaluate` functions into
`runVisualEvaluation`.

`@lynx-js/ui-judge` intentionally exposes only a programming API for visual
evaluation. It does not create an HTTP endpoint or perform caller
authentication. If an implementation wires user-controlled requests into
`runVisualEvaluation`, that implementation must enforce its own trust boundary,
such as authentication, URL allowlists, and private-network filtering for
`referenceImage` and `templateUrl`.

`judgeAndroidAgent` judges an Android Lynx screen through a Kitten-Lynx page.
Callers own the Kitten-Lynx device/app lifecycle, including connection,
navigation, and teardown. The judge reads `page.url()` for the returned JSON
object, mirroring `judgePage`.

```ts
import { Lynx } from '@lynx-js/kitten-lynx-test-infra';
import { judgeAndroidAgent } from '@lynx-js/ui-judge';

const lynx = await Lynx.connect({ appPackage: 'com.lynx.explorer' });
const page = await lynx.newPage();
await page.goto('http://localhost:8080/main.lynx.bundle');

const result = await judgeAndroidAgent({
  page,
  task: 'The Lynx app should show a checkout confirmation screen.',
  steps: ['Dismiss permission dialog if it appears.'],
});
```

When `dimension` is omitted, `judgePage` keeps the legacy
`visual-correctness` prompt. GEQI scoring can pass one of these dimensions:

- `usability-interaction`
- `visual-aesthetics`
- `consistency-standards`
- `architecture-writing`
- `accessibility-performance`

Midscene reads its model configuration from the standard Midscene environment
variables, such as `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_API_KEY`,
`MIDSCENE_MODEL_NAME`, and `MIDSCENE_MODEL_FAMILY`.

The Playwright test suite uses the real Midscene service when
`MIDSCENE_MODEL_NAME` is present. Without model configuration, the model-backed
test is skipped and the error-path test still runs.

The model-backed package test uses the A2UI playground preview server instead
of a scratch HTTP fixture. It opens the playground's `render.html` demo route
with `speed=0`, for example
`/render.html?protocol=a2ui&demoUrl=.%2Fa2ui.web.js&theme=light&demo=recs&speed=0`.
Prepare the playground artifacts first:

```sh
pnpm turbo build:lynx --filter genui-playground
pnpm --filter @lynx-js/ui-judge test
```

The playground dev server binds to a local TCP port, so sandboxed runs need
local-bind permission.
