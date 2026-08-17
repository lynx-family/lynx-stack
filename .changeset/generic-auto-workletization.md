---
"@lynx-js/motion": minor
"@lynx-js/react": minor
"@lynx-js/react-signals": patch
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-refresh-webpack-plugin": patch
"@lynx-js/react-webpack-plugin": minor
---

Add generic auto-workletization through a versioned package declaration
protocol. Libraries can publish import-resolved call and JSX positions, the
compiler reduces direct function literals at those positions to the existing
`"main thread"` directive normal form, and builds emit an auditable inference
report while verifying identical main-thread and background inference.

`@lynx-js/react` now publishes `MainThreadFn` and the `mainThread(fn)` marker,
and declares its existing main-thread receiving APIs through the same package
manifest used by third-party libraries.

`@lynx-js/motion` publishes generated declarations for declarative transition
callbacks and `transformTemplate`, so unchanged Motion examples with easing
function arrays and transform templates compile and run without directives.
