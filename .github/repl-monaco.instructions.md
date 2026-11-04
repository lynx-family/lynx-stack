---
applyTo: "packages/repl/**"
---

Monaco 0.55 moved the TypeScript language-service API from `monaco.languages.typescript` to the top-level `monaco.typescript` namespace. Register the REPL's Lynx declarations through `monaco.typescript.javascriptDefaults`; importing language contributions for side effects does not restore the removed namespace.

When upgrading Monaco, validate the production REPL in a browser, not just its bundle compilation. Verify that all three editors initialize, Lynx declarations remain available to JavaScript completion, language workers load, and editing or switching examples updates the preview without uncaught exceptions. Preserve the Monaco 0.56 worker specifiers that resolve through its package exports map.
