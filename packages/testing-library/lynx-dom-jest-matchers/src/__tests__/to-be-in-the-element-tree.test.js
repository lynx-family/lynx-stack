import { expect, test } from 'vitest';

test('.toBeInTheElementTree', () => {
  lynxDOM.resetLynxEnv();
  lynxDOM.switchToMainThread();

  const page = __CreatePage('0', 0);
  expect(elementTree).toMatchInlineSnapshot(`"<page />"`);
  const view0 = __CreateView(0);
  expect(view0).toMatchInlineSnapshot(`<view />`);
  expect(view0.$$uiSign).toMatchInlineSnapshot(`1`);
  expect(elementTree).toMatchInlineSnapshot(`"<page />"`);
  __AppendElement(page, view0);
  expect(elementTree).toMatchInlineSnapshot(`
    "<page>
      <view />
    </page>"
  `);
  __AddDataset(view0, 'testid', 'view-element');
  expect(elementTree).toMatchInlineSnapshot(`
    "<page>
      <view
        dataset={
          Object {
            "testid": "view-element",
          }
        }
      />
    </page>"
  `);

  const view1 = __CreateElement('svg', view0.$$uiSign);
  __AddDataset(view1, 'testid', 'svg-element');
  __AppendElement(page, view1);
  expect(elementTree).toMatchInlineSnapshot(`
    "<page>
      <view
        dataset={
          Object {
            "testid": "view-element",
          }
        }
      />
      <svg
        dataset={
          Object {
            "testid": "svg-element",
          }
        }
      />
    </page>"
  `);

  const element0 = __CreateElement('custom-element', view0.$$uiSign);
  __AddDataset(element0, 'testid', 'custom-element');
  __AppendElement(page, element0);
  expect(elementTree).toMatchInlineSnapshot(`
    "<page>
      <view
        dataset={
          Object {
            "testid": "view-element",
          }
        }
      />
      <svg
        dataset={
          Object {
            "testid": "svg-element",
          }
        }
      />
      <custom-element
        dataset={
          Object {
            "testid": "custom-element",
          }
        }
      />
    </page>"
  `);

  const text0 = __CreateText(view0.$$uiSign);
  const rawText0 = __CreateRawText('Text Element', text0.$$uiSign);
  __AppendElement(text0, rawText0);
  __AppendElement(view0, text0);

  expect(elementTree).toMatchInlineSnapshot(`
    "<page>
      <view
        dataset={
          Object {
            "testid": "view-element",
          }
        }
      >
        <text>
          <raw-text
            text="Text Element"
          />
        </text>
      </view>
      <svg
        dataset={
          Object {
            "testid": "svg-element",
          }
        }
      />
      <custom-element
        dataset={
          Object {
            "testid": "custom-element",
          }
        }
      />
    </page>"
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

  expect(viewElement).toBeInTheElementTree();
  expect(svgElement).toBeInTheElementTree();
  expect(customElement).toBeInTheElementTree();
  expect(detachedElement).not.toBeInTheElementTree();
  expect(nullElement).not.toBeInTheElementTree();

  // negative test cases wrapped in throwError assertions for coverage.
  const expectToBe = /expect.*\.toBeInTheElementTree/;
  const expectNotToBe = /expect.*not\.toBeInTheElementTree/;
  expect(() => expect(viewElement).not.toBeInTheElementTree()).toThrowError(
    expectNotToBe,
  );
  expect(() => expect(svgElement).not.toBeInTheElementTree()).toThrowError(
    expectNotToBe,
  );
  expect(() => expect(detachedElement).toBeInTheElementTree()).toThrowError(
    expectToBe,
  );
  expect(() => expect(fakeElement).toBeInTheElementTree()).toThrowError(
    expectToBe,
  );
  expect(() => expect(nullElement).toBeInTheElementTree()).toThrowError(
    expectToBe,
  );
  expect(() => expect(undefinedElement).toBeInTheElementTree()).toThrowError(
    expectToBe,
  );
  expect(() => expect(undefinedElement).not.toBeInTheElementTree())
    .toThrowError(
      expectToBe,
    );
});
