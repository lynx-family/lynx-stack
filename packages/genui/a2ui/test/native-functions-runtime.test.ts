// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';

import { expect, test } from '@rstest/core';

test('built functions and date input work without browser or Intl globals', () => {
  const functionsUrl =
    new URL('../dist/functions/index.js', import.meta.url).href;
  const dateInputUrl =
    new URL('../dist/catalog/DateTimeInput/utils.js', import.meta.url).href;
  const registryUrl =
    new URL('../dist/store/FunctionRegistry.js', import.meta.url).href;
  const output = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict';
    const NativeIntl = Intl;
    for (const key of ['Intl', 'URL', 'URLSearchParams', 'window', 'BigInt']) {
      globalThis[key] = undefined;
    }
    String.prototype.replaceAll = undefined;
    const { basicFunctions, createBasicFunctions, registerBasicFunctions } = await import(${
      JSON.stringify(functionsUrl)
    });
    const call = (name, args, functions = basicFunctions) => functions.find(f => f.name === name).impl(args);
    for (const value of [0, -0, 0.0001, -0.0001, 1.005, -1.005, 9.9995, 999.995, 1234567.89,
      1e21, 1e-7, Number.MIN_VALUE, Number.MAX_VALUE]) {
      for (const decimals of [undefined, 0, 2, 3, 20, 100]) {
        for (const grouping of [true, false]) {
          const options = { useGrouping: grouping };
          if (decimals !== undefined) Object.assign(options, {
            minimumFractionDigits: decimals, maximumFractionDigits: decimals,
          });
          assert.equal(call('formatNumber', { value, grouping, ...(decimals === undefined ? {} : { decimals }) }),
            new NativeIntl.NumberFormat('en-US', options).format(value),
            JSON.stringify({ value, decimals, grouping }));
        }
      }
    }
    for (const currency of ['USD', 'EUR', 'CNY', 'JPY', 'CHF', 'XAF', 'XOF', 'XXX', 'ZZZ', 'cad']) {
      for (const value of [-1234.565, 0, -0, 1.005]) {
        for (const grouping of [true, false]) {
          assert.equal(call('formatCurrency', { value, currency, grouping }),
            new NativeIntl.NumberFormat('en-US', {
              style: 'currency', currency, minimumFractionDigits: 2,
              maximumFractionDigits: 2, useGrouping: grouping,
            }).format(value));
        }
      }
    }
    assert.equal(call('formatCurrency', { value: 1234.5, currency: 'USD', decimals: 0 }), '$1,235');
    assert.equal(call('formatCurrency', { value: 1, currency: 'custom!' }), 'CUSTOM!\u00a01.00');
    for (const decimals of [-1, 101]) {
      assert.throws(() => call('formatNumber', { value: 1, decimals }), RangeError);
    }
    const date = '2026-11-13T12:04:05+08:00';
    assert.equal(call('formatDate', { value: date, format: 'yyyy-MM-dd HH:mm:ss' }), '2026-11-13 12:04:05');
    assert.equal(call('formatDate', { value: date, format: 'EEEE, d MMMM yy E MMM h:mm a' }), 'Friday, 13 November 26 Fri Nov 12:04 PM');
    assert.equal(call('formatDate', { value: date, format: 'ISO' }), '2026-11-13T04:04:05.000Z');
    assert.equal(call('formatDate', { value: '2026-02-30', format: 'yyyy-MM-dd' }), '');
    for (const value of [0, 1, -1, 2, 3, 1.0004, 1.0005, 0.9996]) {
      assert.equal(call('pluralize', { value, one: 'item', other: 'items' }),
        new NativeIntl.PluralRules('en-US').select(value) === 'one' ? 'item' : 'items');
    }
    assert.equal(call('pluralize', { value: 0, zero: 'none', other: 'items' }), 'none');
    assert.equal(call('pluralize', { value: 2, two: 'pair', other: 'items' }), 'pair');
    assert.throws(() => call('openUrl', { url: 'https://example.com' }), /host handler/);
    const opened = [];
    const functions = createBasicFunctions({ openUrl: async url => { opened.push(url); } });
    for (const url of ['https://example.com/a?b=c#d', 'HTTP://example.com', 'mailto:a@example.com', 'tel:+123']) {
      assert.equal(await call('openUrl', { url }, functions), undefined);
      assert.equal(opened.at(-1), url);
    }
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', '/relative', 'https:\\n//example.com']) {
      assert.throws(() => call('openUrl', { url }, functions));
    }
    assert.equal(opened.length, 4);
    const failing = createBasicFunctions({ openUrl: async () => { throw new Error('navigation failed'); } });
    await assert.rejects(call('openUrl', { url: 'https://example.com' }, failing), /navigation failed/);
    assert.throws(() => call('openUrl', { url: 'https://example.com' }), /host handler/);
    const webCalls = [];
    globalThis.window = { open: (...args) => webCalls.push(args) };
    call('openUrl', { url: 'https://example.com' });
    assert.deepEqual(webCalls, [['https://example.com', '_blank', 'noopener,noreferrer']]);
    await call('openUrl', { url: 'https://native.example.com' }, functions);
    assert.equal(webCalls.length, 1);
    const { functionRegistry } = await import(${JSON.stringify(registryUrl)});
    registerBasicFunctions({ openUrl: url => { opened.push(url); } });
    functionRegistry.resolve('openUrl')({ url: 'tel:+456' });
    assert.equal(opened.at(-1), 'tel:+456');
    const { formatDateTimeInputValue } = await import(${
      JSON.stringify(dateInputUrl)
    });
    const parts = { year: 2026, month: 11, day: 13, hour: 9, minute: 5 };
    assert.equal(formatDateTimeInputValue(parts, undefined, { enableDate: true, enableTime: false }), '2026-11-13');
    assert.equal(formatDateTimeInputValue(parts, undefined, { enableDate: false, enableTime: true }), '09:05');
    assert.equal(formatDateTimeInputValue(parts, 'YYYY/MM/DD YYYY HH:mm HH:mm', { enableDate: true, enableTime: true }), '2026/11/13 2026 09:05 09:05');
    assert.equal(globalThis.Intl, undefined);
    assert.equal(globalThis.URL, undefined);
    assert.equal(String.prototype.replaceAll, undefined);
    console.log('passed');
  `,
  ], { encoding: 'utf8' });
  expect(output.trim()).toBe('passed');
});
