import '@lynx-js/lynx-dom-jest-matchers';
import { test } from 'vitest';
import { fireEvent, render, waitSchedule } from '..';
import { createRef } from '@lynx-js/react';
import { expect, vi } from 'vitest';

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
        await waitSchedule();

        if (eventTypeIdx === 0 && eventIdx === 0) {
          expect(ref).toMatchInlineSnapshot(`
            {
              "current": NodesRef {
                "_nodeSelectToken": {
                  "identifier": "1",
                  "type": 2,
                },
                "_selectorQuery": {},
              },
            }
          `);
          expect(ref.current.constructor.name).toMatchInlineSnapshot(
            `"NodesRef"`,
          );
          const element = __GetElementByUniqueId(
            Number(ref.current._nodeSelectToken.identifier),
          );
          expect(element).toMatchInlineSnapshot(`
            <view
              event={
                {
                  "bindEvent:tap": "2:0:bindtap",
                }
              }
              has-react-ref={true}
            />
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
              {
                "eventName": "tap",
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

  const { container } = render(<Comp />);

  expect(container).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text
        event={
          {
            "catchEvent:tap": "2:0:",
          }
        }
      />
    </page>
  `);
  expect(handler).toHaveBeenCalledTimes(0);
  const event = {
    eventType: 'catchEvent',
    eventName: 'tap',
  };

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
});
