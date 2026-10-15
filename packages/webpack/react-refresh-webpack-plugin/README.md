<h2 align="center">@lynx-js/react-refresh-webpack-plugin</h2>

A webpack plugin to hot refresh for Lynx

## Main Thread Functions

Rspeedy's ReactLynx HMR integration updates Main Thread Functions and their
shared dependencies before refreshing the corresponding background components.
This also refreshes existing event bindings when a dependency changes without
changing the function's worklet ID. No additional application API is required.

The main thread loads versioned updates through Native `fetchBundle` and
`loadScript`. Background bundles do not carry worklet implementations for
cross-thread HMR; the compiler supplies their definitions to the main-thread
bundle. A failed update on either thread, or a missing main-thread
completion, triggers a full page reload. Pending updates from the old page are
discarded. Compatible component updates preserve `useState`; memoized values,
including `useMainThreadRef`, follow the existing Fast Refresh reset behavior.

This integration applies to application HMR and uses the host's existing Native
loading and DevTool reload capabilities. It does not add standalone lazy-bundle
HMR or change production bundles.
