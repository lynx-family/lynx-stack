/// <reference types="vitest/globals" />

import fs from 'node:fs';

import { SimpleStyleSheet } from '@lynx-js/react';

const styles = SimpleStyleSheet.create({
  static1: {
    width: '100px',
    height: '100px',
  },
  static2: {
    backgroundColor: 'blue',
    color: 'green',
  },
  static3: {
    textAlign: 'center',
    display: 'flex',
  },
  conditional1: {
    borderBottomWidth: '1px',
    borderBottomColor: 'red',
    borderBottomStyle: 'solid',
  },
  conditional2: {
    borderTopWidth: '1px',
    borderTopColor: 'red',
    borderTopStyle: 'solid',
  },
  dynamic: (color, size) => ({
    borderLeftColor: color,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    paddingTop: size,
  }),
});

export function ComponentWithSimpleStyle({
  condition1,
  condition2,
  dynamicStyleArgs,
}) {
  return (
    <view
      simpleStyle={[
        styles.static1,
        condition1 && styles.conditional1,
        styles.static2,
        styles.dynamic(...dynamicStyleArgs),
        condition2 && styles.conditional2,
        styles.static3,
      ]}
    />
  );
}

it('should have simple styling api calls generated', () => {
  const expectedApiList = [
    ['__Set', 'Style', 'Object'],
  ];
  const content = fs.readFileSync(__filename, 'utf-8');
  if (__MAIN_THREAD__) {
    expectedApiList.forEach(expected => {
      expect(content).toContain(expected.join(''));
    });
  } else {
    expectedApiList.forEach(expected => {
      expect(content).not.toContain(expected.join(''));
    });
  }
});
