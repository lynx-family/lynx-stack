# lynx-testing-library

Unit testing library for lynx, same as https://github.com/testing-library.

## Packages

| Package                             | Description                              | Equivalent                                                                           |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| @lynx-js/lynx-runtime               | Lynx equivalent of jsdom                 | [jsdom](https://github.com/jsdom/jsdom)                                              |
| @lynx-js/lynx-react-testing-library | Lynx equivalent of react-testing-library | [@testing-library/preact](https://github.com/testing-library/preact-testing-library) |

## Usage Example Compared to Preact Testing Library

### Basic Usage with render

#### Preact Testing Library

```jsx
const WrapperComponent = ({ children }) => (
  <div data-testid='wrapper'>{children}</div>
);
const { container, getByTestId } = render(<div data-testid='inner' />, {
  wrapper: WrapperComponent,
});

expect(getByTestId('wrapper')).toBeInTheDocument();
expect(container.firstChild).toMatchInlineSnapshot(`
  <div
    data-testid="wrapper"
  >
    <div
      data-testid="inner"
    />
  </div>
`);
```

#### lynx-testing-library

```jsx
const WrapperComponent = ({ children }) => (
  <view data-testid='wrapper'>{children}</view>
);
const Comp = () => {
  return <view data-testid='inner' />;
};
const { container, getByTestId } = render(<Comp />, {
  wrapper: WrapperComponent,
});
expect(getByTestId('wrapper')).toBeInTheDocument();
expect(elementTree.root).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <view
        dataset={
          {
            "testid": "wrapper",
          }
        }
      >
        <view
          dataset={
            {
              "testid": "inner",
            }
          }
        />
      </view>
    </page>
  `);
```

### Using jest matchers

#### Preact Testing Library

```jsx
import '@testing-library/jest-dom/extend-expect';

expect(getByTestId('wrapper')).toBeInTheDocument();
```

#### lynx-testing-library

Same as Preact Testing Library

### Fire event

#### Preact Testing Library

```jsx
const handler = jest.fn();

const {
  container: { firstChild: button },
} = render(<button onClick={handler} />);

const event = new MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  button: 0,
});

expect(fireEvent(button, event)).toBe(true);

expect(handler).toHaveBeenCalledTimes(1);
expect(handler).toHaveBeenCalledWith(event);
```

#### lynx-testing-library

```jsx
const handler = vi.fn();

const Comp = () => {
  return <text catchtap={handler} />;
};

const { container } = render(<Comp />);

const event = new Event('catchEvent:tap');
Object.assign(
  event,
  {
    eventType: 'catchEvent',
    eventName: 'tap',
    key: 'value',
  },
);

const button = container.children[0];
// Use fireEvent directly
expect(fireEvent(button, event)).toBe(true);

expect(handler).toHaveBeenCalledTimes(1);
expect(handler).toHaveBeenCalledWith(event);

// Use fireEvent.tap
fireEvent.tap(button, {
  eventType: 'catchEvent',
});
expect(handler).toHaveBeenCalledTimes(2);
expect(handler).toHaveBeenCalledWith({
  eventType: 'catchEvent',
  eventName: 'tap',
});
```

### Using `screen`

#### Preact Testing Library

```jsx
import {
  screen,
  render,
  waitForElementToBeRemoved,
} from '@testing-library/preact';

render(<ComponentWithLoader />);
const loading = () => {
  return screen.getByText('Loading...');
};
await waitForElementToBeRemoved(loading);
expect(screen.getByTestId('message')).toHaveTextContent(/Hello World/);
```

#### lynx-testing-library

```jsx
import {
  render,
  getScreen,
  waitForElementToBeRemoved,
} from '@lynx-js/lynx-testing-library';

render(<ComponentWithLoader />);
const screen = getScreen();
const loading = () => {
  return screen.getByText('Loading...');
};
await waitForElementToBeRemoved(loading);
expect(screen.getByTestId('message')).toHaveTextContent(/Hello World/);
```

### rerender

#### Preact Testing Library

```jsx
const Greeting = (props) => <div>{props.message}</div>;

const { container, rerender } = render(<Greeting message='hi' />);

expect(container.firstChild).toHaveTextContent('hi');
rerender(<Greeting message='hey' />);
expect(container.firstChild).toHaveTextContent('hey');
```

#### lynx-testing-library

```jsx
const Greeting = (props) => <text>{props.message}</text>;
const { container, rerender } = render(<Greeting message='hi' />);
expect(container.children[0]).toHaveTextContent('hi');

{
  const { container } = rerender(<Greeting message='hey' />);
  expect(container.children[0]).toHaveTextContent('hey');
}
```
