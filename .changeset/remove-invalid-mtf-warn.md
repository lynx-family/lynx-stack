---
"@lynx-js/react": patch
---

Stop warning when `runWorklet` receives an invalid or missing main-thread function object. Invalid worklet contexts are still ignored, but nullish handler values no longer produce noisy `MainThreadFunction: Invalid function object` console output.
