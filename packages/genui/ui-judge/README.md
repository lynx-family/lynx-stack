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
pnpm turbo build:lynx --filter a2ui-playground
pnpm --filter @lynx-js/ui-judge test
```

The playground dev server binds to a local TCP port, so sandboxed runs need
local-bind permission.
