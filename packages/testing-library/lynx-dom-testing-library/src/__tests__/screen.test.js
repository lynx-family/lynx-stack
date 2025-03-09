import { expect, test } from 'vitest';
import { getScreen } from '..';

test('exposes queries that are attached to elementTree', async () => {
  lynxDOM.resetLynxEnv();
  lynxDOM.switchToMainThread();

  const page = __CreatePage('0', 0);
  expect(elementTree).toMatchInlineSnapshot(`"<page />"`);
  const text0 = __CreateText(0);
  const rawText0 = __CreateRawText('hello world', text0.$$uiSign);
  __AppendElement(text0, rawText0);
  __AppendElement(page, text0);
  expect(elementTree).toMatchInlineSnapshot(`
    "<page>
      <text>
        <raw-text
          text="hello world"
        />
      </text>
    </page>"
  `);
  const screen = getScreen();
  screen.getByText(/hello world/i);
  await screen.findByText(/hello world/i);
  expect(screen.queryByText(/hello world/i)).not.toBeNull();
  expect(screen.debug).toMatchInlineSnapshot(`undefined`);
});
