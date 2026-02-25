# @lynx-test/kitten-lynx

This document provides context, architecture guidelines, and workflows for agents interacting with the `kitten-lynx` framework.

## Overview

`kitten-lynx` is a Puppeteer-like testing library designed for interacting with the Lynx browser engine and Lynx Explorer Android application. It utilizes the `@lynx-js/debug-router-connector` to establish WebSocket connections via ADB to an Android Emulator running the `com.lynx.explorer` app.

Through the Chrome DevTools Protocol (CDP), `kitten-lynx` enables:

- Starting and tearing down `LynxView` instances.
- Spawning pages using deep link intents (`adb shell am start`).
- Navigating and reading the DOM structure.
- Querying elements via `DOM.querySelector`.
- Reading styles, attributes, and precise boundary boxes of elements.
- Simulating native touches through `Input.emulateTouchFromMouseEvent`.

## Architecture Details

### Connections & Sessions

1. **Lynx.ts**: The entry point. Handles `DebugRouterConnector` initialization, spawning devices, waiting for a client attachment, and enabling DevTools switches inside Lynx (`enable_devtool`).
2. **LynxView.ts**: Manages individual pages. Executes `adb` intents to start the Lynx Shell Activity for a specific URL, then establishes a CDP session utilizing `onAttachedToTarget`.
3. **CDPChannel.ts**: A wrapper that abstracts sending and receiving asynchronous `Customized` CDP commands over the router.
4. **ElementNode.ts**: A wrapper around `nodeId`s matching an element. Implements interactive methods like `getAttribute()`, `computedStyleMap()`, and `tap()`.

### Prerequisites

For the library to interact successfully:

- Host machine must have Docker installed with the `ubuntu-24.04-emu` image containing the Android SDK and configured ADB.
- Inside the emulator, the Lynx Explorer APK must be installed.
- ADB port `5555` should be exposed or forwarded to control the emulator programmatically.
- Typical commands use `pnpm run test` starting `vitest` logic inside the Node wrapper.

## Adding Features

When extending the `kitten-lynx` testing library, adhere to these rules:

1. **Protocol Typings**: Only update `Protocol` types in `src/CDPChannel.ts` when implementing new standard CDP requests (e.g. `Page.reload`, `DOM.getOuterHTML`).
2. **Puppeteer Equivalency**: Maintain an API design similar to Puppeteer/Playwright. Add element-level logic inside the `ElementNode` class (e.g., `type()`, `boundingBox()`) and page-level logic inside `LynxView` (e.g., `evaluate()`, `screenshot()`).
3. **Session Reconnection**: Be mindful of device timeouts. CDP requests time out after 5000ms. Keep connection tests tolerant of emulator boot/warm-up times gracefully in test suites (`tests/lynx.spec.ts`).
4. **Vitest Verification**: Before pushing feature changes, verify functionality using `pnpm run build && pnpm run test` inside the package root folder.
