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
});
