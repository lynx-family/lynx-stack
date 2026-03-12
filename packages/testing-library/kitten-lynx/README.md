# Kitten-Lynx (🐾 testing-library)

**Kitten-Lynx** is a Puppeteer-like / Playwright-like testing library. It is designed specifically for interacting with the **Lynx browser engine** and the **Lynx Explorer Android application**.

If you are an AI Agent (or a developer) reading this, this document is optimized to be as clear and straightforward as possible to help you write tests and understand the architecture without guessing.

---

## 🌟 What does it do?

Using the Chrome DevTools Protocol (CDP) over USB/ADB, `kitten-lynx` gives you the power to:

1. Automatically open the Lynx Explorer app on an Android emulator or physical device.
2. Navigate to `.lynx.bundle` URLs.
3. Access the Lynx DOM (Document Object Model) tree.
4. Find elements using CSS Selectors (e.g. `page.locator('#my-id')`).
5. Read element styles and attributes.
6. Simulate native touch gestures (like tapping on buttons).

---

## 🏗️ Architecture Explained (For Agents)

In standard Web Playwright/Puppeteer, you connect to a persistent browser WebSocket. **Lynx is different.**

1. **Stateless Connector:** This library uses `@lynx-js/devtool-connector` which operates via Android Debug Bridge (ADB). It sends isolated Request/Response commands. There is no long-living socket.
2. **Session Hopping:** When you tell Lynx to navigate to a new URL, Lynx creates an entirely **new debugging session**.
3. **`Lynx.ts`**: Handles the physical device connection, force-stops the app, restarts it, and ensures the Master devtool switch is ON.
4. **`KittenLynxView.ts`**: Represents a single "Page". When you call `goto(url)`, it sends the navigate command, and then intensely **polls** the ADB session list until it finds the new session matching your URL, and re-attaches to it.
5. **`ElementNode.ts`**: Represents a physical tag (like `<view>` or `<text>`). Cached via `WeakRef` to save memory. Uses native coordinate math via `DOM.getBoxModel` to simulate real screen taps.

---

## 🚀 Quick Start Guide

### Prerequisites

- You must have an Android Emulator or device running via `adb`.
- The Lynx Explorer APK must be installed (`adb install LynxExplorer.apk`).
- (In CI) Ensure your test runner can reach your local bundle dev server (you might need `adb reverse tcp:8080 tcp:8080`).

### Example Test Script

Here is the blueprint for a standard test written using `kitten-lynx` and `vitest`:

```typescript
import { expect, test, beforeAll, afterAll } from 'vitest';
import { Lynx } from '@lynx-js/kitten-lynx';
import type { KittenLynxView } from '@lynx-js/kitten-lynx';

let lynx: Lynx;
let page: KittenLynxView;

// Setup: Connect to device
beforeAll(async () => {
  // Connects to the first available ADB device and opens com.lynx.explorer
  lynx = await Lynx.connect();
  page = await lynx.newPage();
}, 60000); // Give ADB enough time to boot!

// Teardown: Clean up resources
afterAll(async () => {
  await lynx.close();
});

test('Basic Navigation and Interaction', async () => {
  // 1. Navigate to the bundle (Will poll until the session is found)
  await page.goto('http://10.0.2.2:8080/dist/main.lynx.bundle');

  // 2. Locate an element by CSS Selector
  const button = await page.locator('#submit-btn');
  expect(button).toBeDefined();

  // 3. Read an attribute.
  // (Note: 'id' maps internally to Lynx's 'idSelector')
  const idValue = await button!.getAttribute('id');
  expect(idValue).toBe('submit-btn');

  // 4. Read computed CSS styles
  const styles = await button!.computedStyleMap();
  expect(styles.get('display')).toBe('flex');

  // 5. Simulate a native tap
  await button!.tap();

  // 6. Assert DOM changes (re-query the new element)
  const successText = await page.locator('.success-message');
  expect(successText).toBeDefined();
}, 30000);
```

---

## ⚠️ Known Gotchas & Pitfalls

If you are writing scripts and tests, memorize these rules:

1. **`goto()` implies a Session Change:** After `page.goto()`, the old node IDs are dead. Always query elements _after_ the navigation finishes.
2. **Timeouts:** Android emulators take time to boot. The devtool ADB bridge takes time to synchronize. Always set high timeouts for setup hooks (`beforeAll(..., 60000)`).
3. **No `App.openPage` locally:** Lynx Explorer 3.6.0 does not support `App.openPage` properly in some fallback layers. `kitten-lynx` falls back to a Custom OpenCard event automatically. You do not need to worry about this, but do not be alarmed by terminal warnings.
4. **Id Selector:** Standard web writes `<view id="test">`. Lynx internally uses `idSelector="test"`. The `ElementNode.getAttribute('id')` handles this mapping automatically for you. Do not query `'idSelector'` directly.
5. **DOM Snapshots:** You can call `await page.content()` to get a massive HTML-like string of the current Lynx DOM. This is extremely helpful for debugging what is actually rendering!

---

## 🛠️ Extending the Library

If you need to add a newly supported CDP command:

1. Open `src/CDPChannel.ts`.
2. Add the strictly-typed parameter and return shapes to the `Protocol` interface block at the top of the file.
3. Call `await this._channel.send('Domain.methodName', params)` in `KittenLynxView` or `ElementNode`.
4. Run `pnpm run build && pnpm run test` before committing.
