# @lynx-js/ui-judge

`@lynx-js/ui-judge` compares a prepared reference screenshot with a rendered
screenshot. It aligns the two images, writes a visual diff artifact, and asks an
agent SDK-backed model to score visual fidelity.

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
`data:image/...;base64,...`, or an `http://` / `https://` image URL.

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

Tests and custom runtimes can inject `evaluate` or an `agent` into
`runVisualEvaluation`. By default the package creates a Mastra agent backed by
`@ai-sdk/openai`. Official OpenAI base URLs default to the Responses API; custom
base URLs default to chat completions for compatibility.

`@lynx-js/ui-judge` intentionally exposes only a programming API for visual
evaluation. It does not create an HTTP endpoint or enforce caller
authentication. If an implementation wires user-controlled requests into
`runVisualEvaluation`, that implementation must enforce its own trust boundary,
including authentication, URL allowlists, and private-network filtering for
remote image URLs.

The Rust Kitten-Lynx/Android automation lives in the same package under
`rust/`. It owns device connection, protocol handling, and Android e2e coverage;
the TypeScript package stays focused on screenshot comparison.
