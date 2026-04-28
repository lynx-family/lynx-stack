import '@testing-library/jest-dom';
import { expect, test, vi } from 'vitest';

import { createRef } from '@lynx-js/react';

import { fireEvent, render } from '..';

const eventTypes = [
  {
    type: 'LynxBindCatchEvent',
    events: [
      'tap',
      'longtap',
    ],
    init: {
      key: 'value',
    },
  },
  {
    type: 'LynxEvent',
    events: [
      'bgload',
      'bgerror',
      'touchstart',
      'touchmove',
      'touchcancel',
      'touchend',
      'longpress',
      'transitionstart',
      'transitioncancel',
      'transitionend',
      'animationstart',
      'animationiteration',
      'animationcancel',
      'animationend',
      'mousedown',
      'mouseup',
      'mousemove',
      'mouseclick',
      'mousedblclick',
      'mouselongpress',
      'wheel',
      'keydown',
      'keyup',
      'focus',
      'blur',
      'layoutchange',
    ],
  },
];

eventTypes.forEach(({ type, events, elementType, init }, eventTypeIdx) => {
  describe(`${type} Events`, () => {
    events.forEach((eventName, eventIdx) => {
      const eventProp = `bind${eventName}`;

      it(`triggers ${eventProp}`, async () => {
        const ref = createRef();
        const spy = vi.fn();

        const Comp = () => {
          return (
            <view
              ref={ref}
              {...{
                [eventProp]: spy,
              }}
            />
          );
        };

        render(<Comp />);

        if (eventTypeIdx === 0 && eventIdx === 0) {
          expect(ref).toMatchInlineSnapshot(`
            {
              "current": RefProxy {
                "refAttr": [
                  2,
                  0,
                ],
                "task": undefined,
              },
            }
          `);
          expect(ref.current.constructor.name).toMatchInlineSnapshot(
            `"RefProxy"`,
          );
          const refId = `react-ref-${ref.current.refAttr[0]}-${ref.current.refAttr[1]}`;
          const element = document.querySelector(`[${refId}]`);
          expect(element).toMatchInlineSnapshot(`
            <view
              react-ref-2-0="1"
            />
          `);
          expect(element.attributes).toMatchInlineSnapshot(`
            NamedNodeMap {
              "react-ref-2-0": "1",
            }
          `);
          expect(element.eventMap).toMatchInlineSnapshot(`
            {
              "bindEvent:tap": [Function],
            }
          `);
          expect(init).toMatchInlineSnapshot(`
            {
              "key": "value",
            }
          `);
        }

        expect(spy).toHaveBeenCalledTimes(0);
        expect(fireEvent[eventName](ref.current, init)).toBe(true);
        expect(spy).toHaveBeenCalledTimes(1);
        if (init) {
          expect(spy).toHaveBeenCalledWith(expect.objectContaining(init));
          if (eventTypeIdx === 0 && eventIdx === 0) {
            expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(`
              Event {
                "eventName": "tap",
                "eventType": "bindEvent",
                "isTrusted": false,
                "key": "value",
              }
            `);
          }
        }
      });
    });
  });
});

test('calling `fireEvent` directly works too', () => {
  const handler = vi.fn();

  const Comp = () => {
    return <text catchtap={handler} />;
  };

  const { container: { firstChild: button } } = render(<Comp />);

  expect(handler).toHaveBeenCalledTimes(0);
  const event = new Event('catchEvent:tap');
  Object.assign(
    event,
    {
      eventType: 'catchEvent',
      eventName: 'tap',
      key: 'value',
    },
  );
  // Use fireEvent directly
  expect(fireEvent(button, event)).toBe(true);

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(event);
  expect(handler.mock.calls[0][0].type).toMatchInlineSnapshot(
    `"catchEvent:tap"`,
  );
  expect(handler.mock.calls[0][0]).toMatchInlineSnapshot(`
  Event {
    "eventName": "tap",
    "eventType": "catchEvent",
    "isTrusted": false,
    "key": "value",
  }
`);

  // Use fireEvent.tap
  fireEvent.tap(button, {
    eventType: 'catchEvent',
  });
  expect(handler).toHaveBeenCalledTimes(2);
  expect(handler.mock.calls[1][0]).toMatchInlineSnapshot(`
  Event {
    "eventName": "tap",
    "eventType": "catchEvent",
    "isTrusted": false,
  }
`);
});

// https://lynxjs.org/api/elements/built-in/event.html#event-handler-property
//
// | Type           | Phase   | Intercepts? |
// | -------------- | ------- | ----------- |
// | bind           | bubble  | no          |
// | catch          | bubble  | yes         |
// | capture-bind   | capture | no          |
// | capture-catch  | capture | yes         |
//
// Each Lynx event type maps to a separate DOM event name in the testing library
// (e.g. `bindEvent:tap`, `catchEvent:tap`, `capture-bind:tap`, `capture-catch:tap`),
// so "intercept" semantics only apply within the same Lynx event type.
describe('Event handler property semantics', () => {
  it('bind: handler runs in bubble phase, does not intercept bubbling', () => {
    const calls = [];
    const childRef = createRef();

    const Comp = () => (
      <view bindtap={() => calls.push('parent')}>
        <view ref={childRef} bindtap={() => calls.push('child')} />
      </view>
    );
    render(<Comp />);

    fireEvent.tap(childRef.current);

    // bubble phase walks target → root, so child fires before parent
    expect(calls).toEqual(['child', 'parent']);
  });

  it('catch: handler runs in bubble phase and stops further propagation', () => {
    const parent = vi.fn();
    const child = vi.fn();
    const childRef = createRef();

    const Comp = () => (
      <view catchtap={parent}>
        <view ref={childRef} catchtap={child} />
      </view>
    );
    render(<Comp />);

    fireEvent.tap(childRef.current, { eventType: 'catchEvent', bubbles: true });

    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).toHaveBeenCalledTimes(0);
  });

  it('capture-bind: handler runs in capture phase, does not intercept', () => {
    const calls = [];
    const childRef = createRef();

    const Comp = () => (
      <view {...{ 'capture-bindtap': () => calls.push('parent') }}>
        <view
          ref={childRef}
          {...{ 'capture-bindtap': () => calls.push('child') }}
        />
      </view>
    );
    render(<Comp />);

    fireEvent.tap(childRef.current, { eventType: 'capture-bind' });

    // capture phase walks root → target, so parent fires before child
    expect(calls).toEqual(['parent', 'child']);
  });

  it('capture-catch: handler runs in capture phase and stops further propagation', () => {
    const parent = vi.fn();
    const child = vi.fn();
    const childRef = createRef();

    const Comp = () => (
      <view {...{ 'capture-catchtap': parent }}>
        <view ref={childRef} {...{ 'capture-catchtap': child }} />
      </view>
    );
    render(<Comp />);

    fireEvent.tap(childRef.current, { eventType: 'capture-catch' });

    // parent fires first in capture phase, calls stopPropagation,
    // so the event never reaches the child target
    expect(parent).toHaveBeenCalledTimes(1);
    expect(child).toHaveBeenCalledTimes(0);
  });

  it('capture phase fires regardless of bubbles=false', () => {
    const parent = vi.fn();
    const childRef = createRef();

    const Comp = () => (
      <view {...{ 'capture-bindtap': parent }}>
        <view ref={childRef} />
      </view>
    );
    render(<Comp />);

    fireEvent.tap(childRef.current, {
      eventType: 'capture-bind',
      bubbles: false,
    });

    expect(parent).toHaveBeenCalledTimes(1);
  });

  it('bind on ancestor needs bubbles=true to be reached from a descendant', () => {
    const parent = vi.fn();
    const childRef = createRef();

    const Comp = () => (
      <view bindtap={parent}>
        <view ref={childRef} />
      </view>
    );
    render(<Comp />);

    // fireEvent.tap defaults to bubbles: true (matches Lynx runtime)
    fireEvent.tap(childRef.current);
    expect(parent).toHaveBeenCalledTimes(1);

    // explicit bubbles: false skips the bubble phase, so the ancestor handler does not fire
    fireEvent.tap(childRef.current, { bubbles: false });
    expect(parent).toHaveBeenCalledTimes(1);
  });

  // https://lynx.bytedance.net/next/zh/api/lynx-api/event/touch-event.html
  // Every TouchEvent-family event (BaseTouchEvent in @lynx-js/types)
  // bubbles in Lynx: touch{start,move,end,cancel}, longpress.
  it.each(['touchstart', 'touchmove', 'touchend', 'touchcancel', 'longpress'])(
    '%s: bubbles to ancestor handlers by default',
    (eventName) => {
      const parent = vi.fn();
      const childRef = createRef();

      const Comp = () => (
        <view {...{ [`bind${eventName}`]: parent }}>
          <view ref={childRef} />
        </view>
      );
      render(<Comp />);

      fireEvent[eventName](childRef.current);
      expect(parent).toHaveBeenCalledTimes(1);
    },
  );
});

test('customEvent not in internal eventMap', () => {
  const handler = vi.fn();

  const Comp = () => {
    return <text catchcustomevent={handler} />;
  };

  const { container: { firstChild: button } } = render(<Comp />);

  expect(handler).toHaveBeenCalledTimes(0);
  const event = new Event('catchEvent:customevent');
  Object.assign(
    event,
    {
      eventType: 'catchEvent',
      eventName: 'customevent',
      key: 'value',
    },
  );
  // Use fireEvent directly
  expect(fireEvent(button, event)).toBe(true);

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(event);
  expect(handler.mock.calls[0][0].type).toMatchInlineSnapshot(
    `"catchEvent:customevent"`,
  );
  expect(handler.mock.calls[0][0]).toMatchInlineSnapshot(`
    Event {
      "eventName": "customevent",
      "eventType": "catchEvent",
      "isTrusted": false,
      "key": "value",
    }
  `);
});
