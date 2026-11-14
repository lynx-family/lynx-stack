---
applyTo: "packages/webpack/cache-events-webpack-plugin/**,packages/react/runtime/src/snapshot/lynx/**,examples/react-externals/**,examples/react-externals-web/**"
---

An async component external does not by itself prevent first-screen hydration.
ReactLynx runtime initialization assigns the real global renderPage, which can
replace the startup cache function before the entry and its other asynchronous
dependencies settle. Test both host orderings: renderPage called before runtime
initialization, and renderPage called after runtime initialization while a
component external remains pending. The latter can serialize an empty root and
produce a hydration CreateElement patch for snapshots that are not registered
on the main thread. Keep the startup proxy installed across handler assignments
until the entire entry settles, then restore the latest real handler before
replaying calls. Diagnostic wrappers must preserve this accessor's setter and
getter rather than bypass its registration semantics.
Delay component evaluation without blocking the main thread
or merely slowing the shared resource fetch, and record the isHydration flag.

Keep browser timing experiments in react-externals-web using its existing web target. Native react-externals must not switch external bundle encoding through a target environment variable. Share timing instrumentation between the examples, but use their own build and host paths.
