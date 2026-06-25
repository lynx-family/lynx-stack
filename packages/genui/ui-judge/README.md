# @lynx-js/ui-judge

`@lynx-js/ui-judge` compares a prepared reference screenshot with a rendered
screenshot. It aligns the two images, writes a visual diff artifact, and asks an
OpenAI-compatible Rust model client to score visual fidelity.

The TypeScript API does not open webpages or capture screenshots. Callers own
rendering and screenshot capture, then pass both images into
`runVisualEvaluation`.

```ts
import { runVisualEvaluation } from '@lynx-js/ui-judge';

const result = await runVisualEvaluation(
  {
    referenceImage: 'data:image/png;base64,...',
    renderedImage: 'data:image/png;base64,...',
  },
  {
    agent: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    },
  },
);

console.log(result.score, result.reason);
console.log(result.artifacts.diffImageBase64);
```

`referenceImage` and `renderedImage` accept plain base64,
`data:image/...;base64,...`, or an `http://` / `https://` image URL for PNG,
JPEG, or WebP images.

The visual evaluation result follows this shape:

```ts
interface VisualEvaluationResponse {
  ok: true;
  score?: number;
  reason?: string;
  artifacts: {
    referenceImageBase64: string;
    renderedImageBase64: string;
    alignedReferenceImageBase64: string;
    alignedRenderedImageBase64: string;
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

The TypeScript API delegates image loading, alignment, diffing, and model
evaluation to the Rust `ui-judge` binary. Configure the model through the
`agent` options or the `OPENAI_*` / `A2UI_BENCH_JUDGE_*` environment variables.
Official OpenAI base URLs default to the Responses API; custom base URLs
default to chat completions for compatibility.

`@lynx-js/ui-judge` intentionally exposes only a programming API for visual
evaluation. It does not create an HTTP endpoint or enforce caller
authentication. If an implementation wires user-controlled requests into
`runVisualEvaluation`, that implementation must enforce its own trust boundary,
including authentication, URL allowlists, and private-network filtering for
remote image URLs.

The Rust implementation lives in the same package under `rust/`. It owns image
loading and normalization, screenshot alignment, block diffing, visual
evaluation, device connection, protocol handling, Android e2e coverage, Android
task scoring, GEQI dimensions, and PR report generation. The TypeScript package
is now a thin compatibility facade over the Rust CLI.

Rust Android scoring is exposed through the `ui-judge` binary:

```bash
cargo run -p ui_judge --bin ui-judge -- judge-android-agent \
  --scenarios packages/genui/ui-judge/tests/scenarios/android-geqi.json \
  --result-file ui-judge-results.json \
  --comment-file ui-judge-comment.md \
  --device-id emulator-5554 \
  --all-geqi
```

The scenario JSON supplies Android Lynx page URLs, tasks, and optional text to
wait for before scoring. The Rust scorer captures the Android screenshot and
asks an OpenAI-compatible model for integer scores from 0 through 5. It supports
`OPENAI_*`, `A2UI_BENCH_JUDGE_*`, and legacy `MIDSCENE_MODEL_*` environment
variable names as endpoint aliases, but it does not depend on Midscene.

Screenshot visual evaluation is also exposed through the same binary:

```bash
cargo run -p ui_judge --bin ui-judge -- visual-evaluation \
  --request-file request.json \
  --result-file result.json
```

Run package tests through Rust:

```bash
cargo test -p ui_judge --all-targets --all-features
```
