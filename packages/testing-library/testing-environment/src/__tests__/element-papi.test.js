import { beforeEach, describe, expect, it } from 'vitest';

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

  it('__ElementAnimate START should create animation', () => {
    const view = __CreateView(0);
    __ElementAnimate(view, [0, /* START */ 'anim-1', [{ opacity: 0 }, {
      opacity: 1,
    }], { duration: 1000 }]);
    expect(elementTree.animationMap.get('anim-1')).toEqual({
      element: view,
      state: 'running',
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 1000 },
    });
  });

  it('__ElementAnimate PAUSE should pause animation', () => {
    const view = __CreateView(0);
    __ElementAnimate(view, [0, /* START */ 'anim-2', [{ opacity: 0 }, {
      opacity: 1,
    }], { duration: 500 }]);
    __ElementAnimate(view, [2, /* PAUSE */ 'anim-2']);
    expect(elementTree.animationMap.get('anim-2').state).toBe('paused');
  });

  it('__ElementAnimate PLAY should resume animation', () => {
    const view = __CreateView(0);
    __ElementAnimate(view, [0, /* START */ 'anim-3', [{ opacity: 0 }, {
      opacity: 1,
    }], { duration: 500 }]);
    __ElementAnimate(view, [2, /* PAUSE */ 'anim-3']);
    __ElementAnimate(view, [1, /* PLAY */ 'anim-3']);
    expect(elementTree.animationMap.get('anim-3').state).toBe('running');
  });

  it('__ElementAnimate CANCEL should remove animation', () => {
    const view = __CreateView(0);
    __ElementAnimate(view, [0, /* START */ 'anim-4', [{ opacity: 0 }, {
      opacity: 1,
    }], { duration: 500 }]);
    __ElementAnimate(view, [3, /* CANCEL */ 'anim-4']);
    expect(elementTree.animationMap.has('anim-4')).toBe(false);
  });

  it('__ElementAnimate FINISH should mark animation finished', () => {
    const view = __CreateView(0);
    __ElementAnimate(view, [0, /* START */ 'anim-5', [{ opacity: 0 }, {
      opacity: 1,
    }], { duration: 500 }]);
    __ElementAnimate(view, [4, /* FINISH */ 'anim-5']);
    expect(elementTree.animationMap.get('anim-5').state).toBe('finished');
  });
});
