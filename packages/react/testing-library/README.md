# @lynx-js/react/testing-library

ReactLynx Testing Library is a simple and complete ReactLynx unit testing library that encourages good testing practices.

> Inspired completely by [react-testing-library](https://github.com/testing-library/react-testing-library)

Similar to [react-testing-library](https://github.com/testing-library/react-testing-library), this library is designed to test your ReactLynx components in the same way you would test React components using react-testing-library.

## Setup

### Rstest

Setup rstest with `@lynx-js/react/testing-library/rstest-config`.

Recommended for library projects:

```ts
import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  extends: withDefaultConfig(),
});
```

Use `withLynxConfig` when you want to reuse your app's `lynx.config.ts`:

```ts
// rstest.config.ts
import { defineConfig } from '@rstest/core';
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  extends: withLynxConfig(),
});
```

Difference between `withLynxConfig` and `withDefaultConfig`:

- `withLynxConfig`: app-oriented. Loads your `lynx.config.ts` and converts it to rstest config, so rspeedy/lynx settings are reused in tests.
- `withDefaultConfig`: library-oriented. Only applies testing-library defaults (`jsdom`, setup files, globals) and lets you provide the rest via `modifyRstestConfig`.

Then you can start writing tests and run them with rstest!

For more usage detail, see https://rstest.rs/

### Vitest

Setup vitest:

```js
import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin(),
  ],
  test: {
    // ...
  },
});
```

Then you can start writing tests and run them with vitest!

`createVitestConfig` is still supported for backward compatibility, but is deprecated.

## Usage

```jsx
import '@testing-library/jest-dom';
import { test, expect } from 'vitest'; // or '@rstest/core'
import { render } from '@lynx-js/react/testing-library';

test('renders options.wrapper around node', async () => {
  const WrapperComponent = ({ children }) => (
    <view data-testid='wrapper'>{children}</view>
  );
  const Comp = () => {
    return <view data-testid='inner' style='background-color: yellow;' />;
  };
  const { container, getByTestId } = render(<Comp />, {
    wrapper: WrapperComponent,
  });
  expect(getByTestId('wrapper')).toBeInTheDocument();
  expect(container.firstChild).toMatchInlineSnapshot(`
    <view
      data-testid="wrapper"
    >
      <view
        data-testid="inner"
        style="background-color: yellow;"
      />
    </view>
  `);
});
```

💡 Since our testing environment (`@lynx-js/testing-environment`) is based on jsdom, You may also be interested in installing `@testing-library/jest-dom` so you can use
[the custom jest matchers](https://github.com/testing-library/jest-dom).

## Examples

See our [examples](https://github.com/lynx-family/lynx-stack/tree/main/packages/react/testing-library/src/__tests__) for more usage.

## Credits

- [Testing Library](https://testing-library.com/) for the testing utilities and good practices for React testing.
