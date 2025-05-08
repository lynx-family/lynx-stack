import '@testing-library/jest-dom';
import { expect, test } from 'vitest';

describe('.toHaveTextContent', () => {
  test('handles positive test cases', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();

    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('2', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    __AddDataset(text0, 'testid', 'count-value');
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text
          data-testid="count-value"
        >
          2
        </text>
      </page>
    `);

    const queryByTestId = testId =>
      elementTree.root.querySelector(`[data-testid="${testId}"]`);

    expect(queryByTestId('count-value')).toHaveTextContent('2');
    expect(queryByTestId('count-value')).toHaveTextContent(2);
    expect(queryByTestId('count-value')).toHaveTextContent(/2/);
    expect(queryByTestId('count-value')).not.toHaveTextContent('21');
  });

  test('handles text nodes', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('example', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text>
          example
        </text>
      </page>
    `);
    expect(elementTree.root.children[0]).toMatchInlineSnapshot(`
      <text>
        example
      </text>
    `);
    expect(elementTree.root.children[0]).toHaveTextContent(
      'example',
    );
  });

  test('handles negative test cases', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('2', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    __AddDataset(text0, 'testid', 'count-value');
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text
          data-testid="count-value"
        >
          2
        </text>
      </page>
    `);
    const queryByTestId = testId =>
      elementTree.root.querySelector(`[data-testid="${testId}"]`);
    expect(() => expect(queryByTestId('count-value2')).toHaveTextContent('2'))
      .toThrowError();
    expect(() => expect(queryByTestId('count-value')).toHaveTextContent('3'))
      .toThrowError();
    expect(() =>
      expect(queryByTestId('count-value')).not.toHaveTextContent('2')
    ).toThrowError();
  });

  test('normalizes whitespace by default', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('Step 1 of 4', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text>
          Step 1 of 4
        </text>
      </page>
    `);
    expect(elementTree.root.children[0]).toHaveTextContent('Step 1 of 4');
  });

  test('allows whitespace normalization to be turned off', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('  Step 1 of 4', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text>
            Step 1 of 4
        </text>
      </page>
    `);
    expect(elementTree.root.children[0]).toHaveTextContent('  Step 1 of 4', {
      normalizeWhitespace: false,
    });
  });

  test('can handle multiple levels', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('Step 1 of 4', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    __SetID(text0, 'parent');
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text
          id="parent"
        >
          Step 1 of 4
        </text>
      </page>
    `);
    expect(elementTree.root.querySelector('#parent')).toHaveTextContent(
      'Step 1 of 4',
    );
  });

  test('can handle multiple levels with content spread across descendants', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const view = __CreateView(0);
    const text0 = __CreateText(view.$$uiSign);
    const rawText0 = __CreateRawText('Step', text0.$$uiSign);
    const text1 = __CreateText(view.$$uiSign);
    const rawText1 = __CreateRawText('1', text1.$$uiSign);
    const text2 = __CreateText(view.$$uiSign);
    const rawText2 = __CreateRawText('of', text2.$$uiSign);
    const text3 = __CreateText(view.$$uiSign);
    const rawText3 = __CreateRawText('4', text3.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(text1, rawText1);
    __AppendElement(text2, rawText2);
    __AppendElement(text3, rawText3);
    __AppendElement(view, text0);
    __AppendElement(view, text1);
    __AppendElement(view, text2);
    __AppendElement(view, text3);
    __AppendElement(page, view);
    __SetID(view, 'parent');
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view
          id="parent"
        >
          <text>
            Step
          </text>
          <text>
            1
          </text>
          <text>
            of
          </text>
          <text>
            4
          </text>
        </view>
      </page>
    `);
    expect(elementTree.root.querySelector('#parent')).toHaveTextContent(
      'Step1of4',
    );
  });

  test('does not throw error with empty content', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    __AppendElement(page, text0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text />
      </page>
    `);
    expect(elementTree.root.children[0]).toHaveTextContent('');
  });

  test('is case-sensitive', () => {
    lynxTestingEnv.reset();
    lynxTestingEnv.switchToMainThread();
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('Sensitive text', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <text>
          Sensitive text
        </text>
      </page>
    `);
    expect(elementTree.root.children[0]).toHaveTextContent('Sensitive text');
    expect(elementTree.root.children[0]).not.toHaveTextContent(
      'sensitive text',
    );
  });

  test('when matching with empty string and element with content, suggest using toBeEmptyDOMElement instead', () => {
    const page = __CreatePage('0', 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('not empty', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    expect(() => expect(text0).toHaveTextContent('')).toThrowError(
      /toBeEmptyDOMElement\(\)/,
    );
  });
});
