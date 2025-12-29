import '@testing-library/jest-dom';
import { describe, expect, vi } from 'vitest';
import { render } from '../..';

import './style1.css';
import './style2.css?common';
import style3 from './style3.module.css';

describe('CSS', () => {
  it('should render a component with CSS styles object', () => {
    const TestComponent = () => <text style={{ color: 'red', fontSize: '20px', flex: 1 }}>Hello World</text>;

    const { container } = render(<TestComponent />);

    expect(container.firstChild).toMatchInlineSnapshot(`
      <text
        style="color:red;font-size:20px;flex:1"
      >
        Hello World
      </text>
    `);
  });
  it('should render a component with CSS styles string', () => {
    const TestComponent = () => <text style='color: red; font-size: 20px; flex: 1;'>Hello World</text>;

    const { container } = render(<TestComponent />);

    expect(container.firstChild).toMatchInlineSnapshot(`
      <text
        style="color: red; font-size: 20px; flex: 1;"
      >
        Hello World
      </text>
    `);
  });
  it('should render a component with CSS module styles object', () => {
    // Assert stable shape (prefix) rather than exact hash
    expect(style3.baz).toMatch(/^_baz_[a-z0-9]+$/);

    const TestComponent = () => <text style={style3.baz}>Hello World</text>;
    const { container } = render(<TestComponent />);

    const node = container.firstChild;
    expect(node).toHaveAttribute('style', style3.baz);
    expect(node).toHaveTextContent('Hello World');
  });
});
