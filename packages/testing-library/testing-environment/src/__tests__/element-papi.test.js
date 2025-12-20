import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  lynxTestingEnv.reset();
  lynxTestingEnv.switchToMainThread();
});

describe('element PAPI', () => {
  it('__RemoveElement should work', () => {
    const view = __CreateView(0);
    expect(view).toMatchInlineSnapshot(`<view />`);
    const childViews = Array.from({ length: 6 }, (_, i) => {
      const childView = __CreateView(
        view.$$uiSign,
      );
      __AppendElement(view, childView);
      __SetID(childView, `child-${i}`);
      return childView;
    });
    expect(view).toMatchInlineSnapshot(`
      <view>
        <view
          id="child-0"
        />
        <view
          id="child-1"
        />
        <view
          id="child-2"
        />
        <view
          id="child-3"
        />
        <view
          id="child-4"
        />
        <view
          id="child-5"
        />
      </view>
    `);
    __RemoveElement(view, childViews[0]);
    __RemoveElement(view, childViews[4]);
    expect(view).toMatchInlineSnapshot(`
      <view>
        <view
          id="child-1"
        />
        <view
          id="child-2"
        />
        <view
          id="child-3"
        />
        <view
          id="child-5"
        />
      </view>
    `);
  });

  it('__GetComputedStyleByKey should work', () => {
    const view = __CreateView(0);
    __SetInlineStyles(view, 'color: red; font-size: 16px;');

    // Get computed style for a specific property
    const color = __GetComputedStyleByKey(view, 'color');
    const fontSize = __GetComputedStyleByKey(view, 'font-size');

    // The exact color format may vary by browser (rgb vs color name)
    // but it should return a non-empty string
    expect(color).toBeTruthy();
    expect(fontSize).toBeTruthy();

    // Test with a property that doesn't exist
    const nonExistent = __GetComputedStyleByKey(view, 'non-existent-property');
    expect(nonExistent).toBe('');
  });

  it('__GetComputedStyleByKey should work with CSS properties using dash notation', () => {
    const view = __CreateView(0);
    __SetInlineStyles(view, 'background-color: blue; margin-top: 10px;');

    // Get computed style using dash notation
    const backgroundColor = __GetComputedStyleByKey(view, 'background-color');
    const marginTop = __GetComputedStyleByKey(view, 'margin-top');

    expect(backgroundColor).toBeTruthy();
    expect(marginTop).toBeTruthy();
  });
});
