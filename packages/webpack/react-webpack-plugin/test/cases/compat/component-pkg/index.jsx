/// <reference types="vitest/globals" />

import fs from 'node:fs';

import { View } from '@lynx-js/react-components';

it('should not have Component in output', async () => {
  const jsx = <View />;
  expect(jsx).not.toBeUndefined();
  expect(jsx.type).toStrictEqual(expect.any(String));

  const content = await fs.promises.readFile(__filename, 'utf-8');

  if (__JS__) {
    expect(content.replaceAll('__CreateView', '')).not.toContain(
      ['V', 'i', 'e', 'w'].join(''),
    );
  }
  expect(content).not.toContain(['react', 'components'].join('-'));
});
