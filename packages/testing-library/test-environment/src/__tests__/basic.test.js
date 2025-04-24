import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  lynxEnv.resetLynxEnv();
  lynxEnv.switchToMainThread();
});

describe('test', () => {
  it('basic element PAPI should work', () => {
    const page = __CreatePage('0', 0);
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    const view0 = __CreateView(0);
    expect(view0).toMatchInlineSnapshot(`<view />`);
    expect(view0.$$uiSign).toMatchInlineSnapshot(`1`);
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    __AppendElement(page, view0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view />
      </page>
    `);
    __AddDataset(view0, 'testid', 'view-element');
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view-element"
        />
      </page>
    `);

    const view1 = __CreateElement('svg', view0.$$uiSign);
    __AddDataset(view1, 'testid', 'svg-element');
    __AppendElement(page, view1);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view-element"
        />
        <svg
          data-testid="svg-element"
        />
      </page>
    `);

    const element0 = __CreateElement('custom-element', view0.$$uiSign);
    __AddDataset(element0, 'testid', 'custom-element');
    __AppendElement(page, element0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view-element"
        />
        <svg
          data-testid="svg-element"
        />
        <custom-element
          data-testid="custom-element"
        />
      </page>
    `);

    const text0 = __CreateText(view0.$$uiSign);
    const rawText0 = __CreateRawText('Text Element', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(view0, text0);

    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view-element"
        >
          <text>
            Text Element
          </text>
        </view>
        <svg
          data-testid="svg-element"
        />
        <custom-element
          data-testid="custom-element"
        />
      </page>
    `);

    const queryByTestId = testId =>
      elementTree.root.querySelector(`[data-testid="${testId}"]`);

    const viewElement = queryByTestId('view-element');
    const svgElement = queryByTestId('svg-element');
    const customElement = queryByTestId('custom-element');
    const detachedElement = __CreateElement('custom-element', -1);
    const fakeElement = { thisIsNot: 'a lynx element' };
    const undefinedElement = undefined;
    const nullElement = null;
    expect(viewElement).toMatchInlineSnapshot(`
      <view
        data-testid="view-element"
      >
        <text>
          Text Element
        </text>
      </view>
    `);
    expect(svgElement).toMatchInlineSnapshot(`
      <svg
        data-testid="svg-element"
      />
    `);
    expect(customElement).toMatchInlineSnapshot(`
      <custom-element
        data-testid="custom-element"
      />
    `);
    expect(detachedElement).toMatchInlineSnapshot(`<custom-element />`);
    expect(fakeElement).toMatchInlineSnapshot(`
      {
        "thisIsNot": "a lynx element",
      }
    `);
    expect(undefinedElement).toMatchInlineSnapshot(`undefined`);
    expect(nullElement).toMatchInlineSnapshot(`null`);
  });
  it('event listener should work', () => {
    const page = __CreatePage('0', 0);
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    const view0 = __CreateView(0);
    expect(view0).toMatchInlineSnapshot(`<view />`);
    __AppendElement(page, view0);
    expect(page).toMatchInlineSnapshot(`
      <page>
        <view />
      </page>
    `);
    __AddEvent(
      view0,
      'bindEvent',
      'tap',
      '2:0:bindtap',
    );
    expect(view0.eventMap).toMatchInlineSnapshot(`
      {
        "bindEvent:tap": [Function],
      }
    `);
    lynxEnv.switchToBackgroundThread();
    lynxCoreInject.tt.publishEvent = (eventHandler, data) => {
      expect(eventHandler).toMatchInlineSnapshot(`"2:0:bindtap"`);
      expect(data).toMatchInlineSnapshot(`
        Event {
          "eventName": "tap",
          "eventType": "bindEvent",
          "isTrusted": false,
          "key": "value",
        }
      `);
    };
    const event = new Event('bindEvent:tap');
    Object.assign(
      event,
      {
        eventType: 'bindEvent',
        eventName: 'tap',
        key: 'value',
      },
    );
    view0.dispatchEvent(event);
  });
  it('text should works', () => {
    const page = __CreatePage('0', 0);
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    const text0 = __CreateText(0);
    expect(text0).toMatchInlineSnapshot(`<text />`);
    const rawText0 = __CreateElement('raw-text', text0.$$uiSign);
    expect(rawText0).toMatchInlineSnapshot(``);
    __AppendElement(text0, rawText0);
    __SetAttribute(rawText0, 'text', 'Hello World');
    expect(text0).toMatchInlineSnapshot(`
      <text>
        Hello World
      </text>
    `);
  });
});
