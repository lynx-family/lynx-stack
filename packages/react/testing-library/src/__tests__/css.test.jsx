import '@testing-library/jest-dom';
import { describe, expect, vi } from 'vitest';
import { render, screen } from '..';

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
});
