---
"create-rspeedy": patch
---

Fix the generated `useFlappy` templates to initialize the engine ref with the `ref.current == null` pattern so scaffolded apps pass the React hooks ref lint check in CI.
