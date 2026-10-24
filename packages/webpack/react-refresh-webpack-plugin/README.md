<h2 align="center">@lynx-js/react-refresh-webpack-plugin</h2>

A webpack plugin to hot refresh for Lynx

## Main Thread Functions

Rspeedy's ReactLynx HMR integration updates Main Thread Functions and their
shared dependencies before refreshing the corresponding background components.
This also refreshes existing event bindings when a dependency changes without
changing the function's worklet ID. No additional application API is required.
Application updates include already loaded async chunks and the first worklet
added to a background-only module within an async scope.

Each thread loads its own versioned update bundle through Native `fetchBundle`
and `loadScript`. The shared HMR loader reads a manifest section and the sections
for the requested update chunks. Background sections retain the existing SDK
runtime wrapper and app scope; normal lazy loading keeps its existing loader. A failed update on either thread, or a missing main-thread
completion, triggers a full page reload. Coordinated updates allow up to ten
seconds for main-thread completion, then up to ten seconds for background
application. Pending updates from the old page are discarded. Compatible component updates preserve `useState`; memoized values,
including `useMainThreadRef`, follow the existing Fast Refresh reset behavior.

This integration applies to application HMR and uses the host's existing Native
loading and DevTool reload capabilities. It does not add standalone lazy-bundle
HMR or change production bundles.

If the host lacks main-thread `fetchBundle` or `loadScript`, the coordinator
disables main-thread updates and retains the existing background HMR path.
Background Native loading also requires the SDK to initialize the app wrapper:
hosts without these APIs or that initialization capability retain the original
background loader. The manifest probes initialization before update code runs.
Actual Native load or application failures still trigger a reload. These
fallbacks do not add Main Thread Function HMR to hosts without main-thread loading.
