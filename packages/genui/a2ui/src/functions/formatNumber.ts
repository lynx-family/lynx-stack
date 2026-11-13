// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { coerceBoolean } from '../store/schema.js';

// The built-in catalog uses en-US. Round the decimal representation instead of
// binary toFixed arithmetic (which rounds e.g. 1.005 down at two places).
export function formatNumber(
  value: number,
  decimals: unknown,
  grouping: unknown,
): string {
  const precision = decimals === undefined ? 3 : Number(decimals);
  if (!Number.isFinite(precision) || precision < 0 || precision > 100) {
    throw new RangeError('decimals must be between 0 and 100');
  }
  const places = Math.floor(precision);
  const negative = value < 0 || Object.is(value, -0);
  const [coefficient = '', exponent = '0'] = String(Math.abs(value)).split('e');
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN';
    return negative ? '-∞' : '∞';
  }
  const [whole = '', fraction = ''] = coefficient.split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  const integer = point <= 0 ? '0' : digits.slice(0, point).padEnd(point, '0');
  const decimal = point < 0 ? '0'.repeat(-point) + digits : digits.slice(point);
  let rounded = integer + decimal.slice(0, places).padEnd(places, '0');
  if (Number(decimal[places] ?? '0') >= 5) {
    let cursor = rounded.length - 1;
    while (cursor >= 0 && rounded[cursor] === '9') cursor--;
    rounded = cursor < 0
      ? '1' + '0'.repeat(rounded.length)
      : rounded.slice(0, cursor) + String(Number(rounded[cursor]) + 1)
        + '0'.repeat(rounded.length - cursor - 1);
  }
  let result = places ? rounded.slice(0, -places) : rounded;
  if (grouping === undefined || coerceBoolean(grouping)) {
    result = result.replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
  }
  let tail = places ? rounded.slice(-places) : '';
  if (decimals === undefined) tail = tail.replace(/0+$/, '');
  return (negative ? '-' : '') + result + (tail ? '.' + tail : '');
}

// en-US currency symbols; other ISO codes are displayed as the code itself.
const currencySymbols: Record<string, string> = {
  AUD: 'A$',
  BRL: 'R$',
  CAD: 'CA$',
  CNY: 'CN¥',
  EUR: '€',
  GBP: '£',
  HKD: 'HK$',
  ILS: '₪',
  INR: '₹',
  JPY: '¥',
  KRW: '₩',
  MXN: 'MX$',
  NZD: 'NZ$',
  PHP: '₱',
  TWD: 'NT$',
  USD: '$',
  VND: '₫',
  XAF: 'FCFA',
  XCD: 'EC$',
  XCG: 'Cg.',
  XOF: 'F CFA',
  XPF: 'CFPF',
  XXX: '¤',
};

export function formatCurrency(
  value: number,
  currency: string,
  decimals: unknown,
  grouping: unknown,
): string {
  const code = currency.toUpperCase();
  const knownSymbol = Object.prototype.hasOwnProperty.call(
    currencySymbols,
    code,
  );
  const symbol = knownSymbol ? currencySymbols[code]! : code;
  // Intl's en-US currency spacing separates alphabetic symbols from digits.
  const spacing = !knownSymbol || /[a-z]$/i.test(symbol)
    ? '\u00a0'
    : '';
  const amount = formatNumber(Math.abs(value), decimals, grouping);
  return (value < 0 || Object.is(value, -0) ? '-' : '') + symbol + spacing
    + amount;
}
