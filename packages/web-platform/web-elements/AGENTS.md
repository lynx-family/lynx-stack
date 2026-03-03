# packages/web-platform/web-elements

## Module Overview

The `web-elements` package is a standalone module providing the Native UI implementation for the LynxJS Web Platform using Web Components. It is built upon a lightweight reactive framework (`element-reactive`) designed for performance and ease of use.

### Key Components

1. **`element-reactive`**: The core framework.
   - **Goal**: Provide a minimal overhead reactive system for Web Components.
   - **Features**:
     - `@Component`: Decorator to register custom elements.
     - `bindToAttribute`: Binds a DOM attribute to a property/function.
     - `bindToStyle`: Binds a CSS style property to a property/function.
     - `boostedQueueMicrotask`: Optimized microtask queue for batching updates.
     - Shadow DOM support by default.
2. **`elements`**: Implementation of Lynx standard elements (e.g., `x-view`, `scroll-view`, `x-image`).
   - These map to Lynx Native elements.
   - Located in `src/elements`.
   - Initialization via `all.ts` registers all elements.
3. **`compat`**: Compatibility layers.
   - Includes `LinearContainer` to polyfill/emulate specific layout behaviors on browsers missing features (like `@container` queries).

## Design Details

- **Reactivity**: Changes to attributes (`observedAttributes`) or styles (`observedCSSProperties`) trigger handlers. Updates are batched using `boostedQueueMicrotask` to minimize DOM thrashing.
- **Shadow DOM**: Most elements use Shadow DOM (`mode: 'open'`) to encapsulate styles and structure.
- **CSS Variables**: Extensive use of CSS variables (e.g., `--lynx-display`) to drive layout and style from the Lynx engine.

## Guidelines for LLMs

When generating or modifying code in this package:

### 1. Code Style & Logic

- **Use `element-reactive` patterns**: When creating new elements, always inherit from `Element` (via `Component` decorator) and use the reactive utilities.
- **Avoid synchronous layout thrashing**: Use the provided `boostedQueueMicrotask` for DOM reads/writes if accurate layout info isn't immediately needed.
- **Comments**: Ensure `index.ts` files and complex logic have clear, descriptive comments matching the implementation.

## Styling and Layout

The `web-elements` package implements a custom **Linear Layout** system on top of CSS Flexbox to mimic native Lynx layout behaviors.

### Linear Layout System (`linear.css`)

Most elements (e.g., `x-view`, `scroll-view`) default to `display: flex`. The linear layout logic is controlled via custom CSS properties:

- `--lynx-display`: Set to `linear` to enable linear layout behavior (mimicking Android LinearLayout).
- `--lynx-linear-orientation`: `vertical` (default) or `horizontal`.
- `--lynx-linear-weight`: Defines the weight of a child in the linear container (similar to `flex-grow` but properly calculated against a weight sum).
- `--lynx-linear-weight-sum`: The total weight sum of the container.
- `--lynx-linear-weight-basis`: The basis size for weighted elements.

### CSS Variables and Customization

Individual elements expose specific CSS variables for styling. Note that for **`x-input`**, **`x-textarea`**, and **`x-image`**, styling properties like placeholders or blur radii are controlled via **attributes** (e.g., `placeholder-color`, `blur-radius`), which internally map to CSS variables.

- **`x-text`**:
  - `--lynx-text-bg-color`: Background color inheritance for nested text.

### Testing

- **Tool**: Use **Playwright** for all E2E and functional tests.
- **Location**: Reviews tests in `tests/` directory.
- **Format**:
  - Use HTML files for test cases (fixtures).
  - **Navigation**: Define and use a helper function `goto(page, fixtureName)` to handle navigation and waiting for resources (like `document.fonts.ready`).
  - Use standard Playwright assertions (`expect(locator).toBeVisible()`, `expect(locator).toHaveCSS()`, etc.).
  - Take screenshot is also allowed for assertions.(use the function `diffScreenShot`)
  - **Coverage**: Ensure tests cover attribute changes, style updates, and event handling.

### 4. Running Tests Locally

To verify specific test cases or fixtures manually:

1. **Dependencies**: Ensure dependencies are installed (`pnpm install`).
2. **Start Server**: Run `pnpm serve` (which executes `rsbuild dev`).
   - **Port**: Defaults to `3080`. If occupied, it will increment (e.g., `3081`). Check the terminal output.
3. **Access Fixtures**: Open the fixture file URL in a browser.
   - **URL Pattern**: `http://localhost:<port>/tests/fixtures/<path_to_fixture>.html`
   - **Example**: To verify `tests/fixtures/x-text/text-in-text.html`, visit `http://localhost:3080/tests/fixtures/x-text/text-in-text.html`.
4. **Verification**: Use agentic browser tools or manual inspection to verify rendering and behavior.

### 5. Performance

- **Main Thread**: These elements run on the main thread. Minimize heavy computation in `attributeChangedCallback`.
- **Batching**: Group DOM updates.

## Shadow DOM Structure (`htmlTemplates.ts` & `src/template.rs`)

The internal structure of web elements is defined in `src/elements/htmlTemplates.ts`. This ensures consistency and encapsulates implementation details. Agents should refer to this file to understand the shadow tree hierarchy (e.g., `ScrollView`'s observer containers, `XInput`'s inner `<input>` element).

**CRITICAL SYNCHRONIZATION**: The templates in `htmlTemplates.ts` are strictly mirrored in the Rust sub-package at `src/template.rs` (a pure Rust lib). Any modifications, additions, or removals of templates in `htmlTemplates.ts` **MUST** be exactly replicated in `src/template.rs`. There is an automated test (`tests/template_sync.rs`) that verifies the generated strings from both TypeScript and Rust match exactly.

## Implementation Guidelines for New Elements

When implementing a new web element, follow these strict guidelines:

1. **Naming Convention**:
   - **Class Name**: PascalCase (e.g., `MyElement`).
   - **Tag Name**: kebab-case. If the name is a single word, prefix with `x-` (e.g., `x-view`, `scroll-view`).
2. **File Structure**:
   - Create a directory in `src/elements/` matching the Class Name.
   - Required files: `index.ts`, `MyElement.ts` (logic), `my-element.css` (styles).
3. **Encapsulation**:
   - Define shadow DOM templates in `src/elements/htmlTemplates.ts`.
4. **Styling**:
   - Write CSS in `my-element.css` in the element's directory.
   - **Import**: Must refer to this CSS file in `elements.css`.
5. **Exports**:
   - Export the component in `src/elements/all.ts`.
   - Add export config to `package.json` under `"exports"` (types and default).
6. **Attribute Handling (Critical)**:
   - **Do NOT** implement attribute logic (handlers decorated with `@registerAttributeHandler`) directly on the main Element class (the one decorated with `@Component`). They will **NOT** be registered.
   - **Pattern**: Create a separate "Attribute Class" (e.g., `XWebViewAttribute.ts`) that implements `AttributeReactiveClass` logic.
   - **Register**: Pass this Attribute Class as the second argument to the `@Component` decorator.
   - **Lazy Access**: Use `genDomGetter` to safely access internal elements within the Shadow DOM.
   - **Boolean-like Attributes**: The framework automatically removes attributes with value `"false"` (string) unless whitelisted.
     - **Fix**: Add the attribute name to `static readonly notToFilterFalseAttributes` Set in the component class (e.g., `ListItem.ts`).

7. **Testing**:
   - **Structure**: Create a separate spec file for new components (e.g., `tests/x-webview.spec.ts`) instead of adding to the monolithic `web-elements.spec.ts`.
   - **Network Mocking**: If the component makes external requests (e.g., via `iframe` or `fetch`), you **MUST** mock them using `page.route` to ensure tests are hermetic and fast.
   - **Shadow DOM**: Playwright relies on specific strategies to access Shadow DOM.
     - **Locators**: `page.locator('x-elem').locator('inner-elem')` works automatically if the shadow root is open.
     - **evaluate/waitForFunction**: You must explicit traverse `.shadowRoot`. Example: `el.shadowRoot.querySelector('iframe')`.

### 4. Example Test (Playwright)

```typescript
// tests/my-element.spec.ts
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const goto = async (page: Page, fixtureName: string) => {
  // Use relative path for fixtures
  await page.goto(`tests/fixtures/${fixtureName}.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('my-element', () => {
  // NETWORK MOCKING EXAMPLE
  test.beforeEach(async ({ page }) => {
    await page.route('https://example.com/*', async route => {
      await route.fulfill({ status: 200, body: 'Mocked Content' });
    });
  });

  test('should update style on attribute change', async ({ page }) => {
    await goto(page, 'my-element/basic'); // Subdirectory in fixtures
    const element = page.locator('my-element');

    await element.evaluate(el => el.setAttribute('custom-color', 'red'));
    await expect(element).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  });

  test('should access internal shadow dom element', async ({ page }) => {
    await goto(page, 'my-element/basic');
    // 1. Using Locators (Preferred)
    const inner = page.locator('my-element').locator('#inner-id');
    await expect(inner).toBeVisible();

    // 2. Using evaluate/waitForFunction (If necessary)
    // NOTE: document.querySelector('x-element #inner') fails. Access shadowRoot explicitly.
    await page.waitForFunction(() => {
      const el = document.querySelector('my-element');
      return el?.shadowRoot?.querySelector('#inner-id') !== null;
    });
  });
});
```

### 5. Compatibility

- Respect existing polyfills in `src/compat`.
- Check browser support before using bleeding-edge CSS features.
