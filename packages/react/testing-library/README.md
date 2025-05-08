# @lynx-js/react/testing-library

ReactLynx Testing Library is a simple and complete ReactLynx unit testing library that encourages good testing practices.

> Inspired completely by [react-testing-library](https://github.com/testing-library/react-testing-library)

Similar to [react-testing-library](https://github.com/testing-library/react-testing-library), this library is designed to test your ReactLynx components in the same way you would test React components using react-testing-library.

## Setup

Setup vitest:

```js
// vitest.config.js
import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = createVitestConfig();
const config = defineConfig({
  test: {
    // ...
  },
});

export default mergeConfig(defaultConfig, config);
```

Then you can start writing tests and run them with vitest!

## Usage

```js
import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
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
