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
