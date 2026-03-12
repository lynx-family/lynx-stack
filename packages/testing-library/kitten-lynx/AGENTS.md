# @lynx-js/kitten-lynx-test-infra

This document provides context, architecture guidelines, and workflows for agents interacting with the `kitten-lynx` framework.

## Overview

`kitten-lynx` is a Puppeteer-like testing library designed for interacting with the Lynx browser engine and Lynx Explorer Android application. It utilizes the `@lynx-js/devtool-connector` (stateless, short-lived connection architecture) to communicate with Lynx apps running on Android devices via ADB.

Through the Chrome DevTools Protocol (CDP), `kitten-lynx` enables:

- Starting and tearing down `LynxView` instances.
- Navigating to Lynx bundle URLs and reading the DOM structure.
- Querying elements via `DOM.querySelector`.
- Reading styles, attributes, and precise boundary boxes of elements.
- Simulating native touches through `Input.emulateTouchFromMouseEvent`.

## Architecture Details

### Connections & Sessions

1. **Lynx.ts**: The entry point. Initializes `Connector` with `AndroidTransport`, discovers ADB devices, restarts the target app, and polls `listClients()` to find the Lynx client. Accepts `ConnectOptions` to target a specific device and app package.
2. **LynxView.ts**: Manages individual pages. Attaches to a CDP session via `sendListSessionMessage()`, sends `Page.navigate` to load a Lynx bundle, then polls sessions by URL to find and re-attach to the correct session (apps may have multiple Lynx views).
3. **CDPChannel.ts**: A stateless wrapper that sends CDP commands via `connector.sendCDPMessage()`. Each call is a short-lived request/response — no persistent connection is maintained.
4. **ElementNode.ts**: A wrapper around `nodeId`s matching an element. Implements interactive methods like `getAttribute()`, `computedStyleMap()`, and `tap()`.

### Key Design Patterns

- **Stateless connector**: The `devtool-connector` does not maintain persistent WebSocket connections. Each `sendCDPMessage` / `sendListSessionMessage` call is a self-contained request through ADB/USB transport.
- **Retry-based initialization**: After restarting the app, polling loops handle the delay before the devtool server is ready. `onAttachedToTarget()` only assigns `_channel` after all CDP domain enables succeed, making the whole operation retryable.
- **Session URL matching**: After `Page.navigate`, the Lynx runtime creates a new session for the navigated URL. `goto()` polls `sendListSessionMessage()` and matches sessions by URL (full URL, filename, or suffix) to find the correct one.

### Prerequisites

For the library to interact successfully:

- The host machine (or CI environment) must have an Android environment (emulator or real device) running with ADB enabled and authorized.
- The Lynx Explorer APK must be installed on the device (e.g., `adb install /path/to/LynxExplorer.apk`). The latest apk could be found here `https://github.com/lynx-family/lynx/releases`
- Typical commands use `pnpm run test` starting `vitest` logic inside the Node wrapper.

### Known Gotchas

- **`Page.navigate` does not work like Chrome**: In Lynx, `Page.navigate` tells the runtime to load a new bundle, which creates a **new session** rather than updating the current one in place. You must poll `sendListSessionMessage()` to find the new session by URL and re-attach to it.
- **`App.openPage` is not implemented** in Lynx Explorer 3.6.0. Do not rely on `sendAppMessage('App.openPage')` for navigation.
- **Network access & Local Serving**: If the Android environment lacks direct internet access to your host machine's local server (common in some CI setups):
  1. Serve your Lynx bundles from the host (e.g., `python3 -m http.server 8080`).
  2. Use `adb reverse tcp:8080 tcp:8080` to map the host port to the device.
  3. Navigate to `http://localhost:8080/your.bundle`.
- **Multiple ADB targets**: When multiple ADB devices are connected (e.g. physical phone + emulator), use `ConnectOptions.deviceId` to target a specific one (e.g. `192.168.240.112:5555`). Otherwise the first available client is used, which may be on the wrong device.
- **CDP timeouts**: The connector uses a 5-second `AbortSignal.timeout`. Keep test operations tolerant of emulator boot/warm-up times.

## Adding Features

When extending the `kitten-lynx` testing library, adhere to these rules:

1. **Protocol Typings**: Only update `Protocol` types in `src/CDPChannel.ts` when implementing new standard CDP requests (e.g. `Page.reload`, `DOM.getOuterHTML`).
2. **Puppeteer Equivalency**: Maintain an API design similar to Puppeteer/Playwright. Add element-level logic inside the `ElementNode` class (e.g., `type()`, `boundingBox()`) and page-level logic inside `LynxView` (e.g., `evaluate()`, `screenshot()`).
3. **Session Reconnection**: Be mindful of device timeouts. CDP requests time out after 5000ms. Keep connection tests tolerant of emulator boot/warm-up times gracefully in test suites (`tests/lynx.spec.ts`).
4. **Vitest Verification**: Before pushing feature changes, verify functionality using `pnpm run build && pnpm run test` inside the package root folder.
