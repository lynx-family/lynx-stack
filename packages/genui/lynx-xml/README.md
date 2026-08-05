# Lynx XML

Utilities for the zero-build Lynx XML protocol used by GenUI. An LLM produces
one artifact containing Lynx CSS, main-thread Element PAPI JavaScript, and an
optional background-thread script:

```xml
<!DOCTYPE lynx>
<style>/* Lynx CSS */</style>
<script main-thread>/* Element PAPI rendering */</script>
<script background>/* optional background work */</script>
```

The Node-only generation prompt directly loads the installed
`@lynx-js/skill-vanilla-lynx` package. Its explicit CSS rules are derived from
`@byted-lynx/lynx-api-docs` documents
`lynx-vs-web/unsupported-features.md` and
`lynx-vs-web/css-differences.md`; generation does not depend on a CSS support
Skill or compatibility query tool.
It also includes the complete
`examples/lynx-markup-hangzhou/public/hangzhou-trip.xml` artifact as a worked
example. Keep the packaged copy in `examples/hangzhou-trip.xml` synchronized
with that source. Generated scrollable containers must use
`__CreateScrollView(pageId)` rather than a generic view.
The artifact is consumed directly by Lynx for Web without a ReactLynx or
Rspeedy compilation step.

Generation is non-streaming: wait for the complete model response, validate
the whole artifact, and only then return one JSON result to the Playground.

```ts
import { validateLynxXml } from '@lynx-js/genui/lynx-xml';
import { buildLynxXmlSystemPrompt } from '@lynx-js/genui/lynx-xml/prompt';
```
