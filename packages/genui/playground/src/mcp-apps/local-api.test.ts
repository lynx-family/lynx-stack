// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  callProductApi,
  callProductPurchaseApi,
  parseProductApiResult,
} from '../../lynx-src/mcp-apps/product/api.js';
import {
  callWeatherApi,
  parseWeatherApiResult,
} from '../../lynx-src/mcp-apps/weather/api.js';

describe('MCP Apps local APIs', () => {
  test('refreshes weather entirely inside the card data layer', () => {
    const initial = callWeatherApi({ city: 'Hangzhou' });
    const refreshed = callWeatherApi({
      city: initial.weather.city,
      unit: initial.weather.unit,
      refresh: initial.weather.refresh + 1,
    });

    expect(refreshed.weather).toMatchObject({
      city: 'Hangzhou',
      refresh: 1,
      updatedAt: 'Refreshed 1×',
    });
  });

  test('confirms a purchase without a Chat or agent round trip', () => {
    const initial = callProductApi({ productId: 'sneaker' });
    const purchased = callProductPurchaseApi({
      productId: initial.product.id,
      quantity: 1,
    });

    expect(purchased).toMatchObject({
      product: { id: 'sneaker' },
      purchase: {
        status: 'confirmed',
      },
    });
    expect(purchased.purchase.orderId?.startsWith('LYNX-')).toBe(true);
  });

  test('returns distinct feedback for consecutive product refreshes', () => {
    const first = callProductApi({ productId: 'sneaker', refresh: 1 });
    const second = callProductApi({ productId: 'sneaker', refresh: 2 });

    expect(first.summary).toContain('refreshed 1×');
    expect(second.summary).toContain('refreshed 2×');
    expect(second.summary).not.toBe(first.summary);
  });

  test('rejects malformed weather results before rendering', () => {
    const valid = callWeatherApi({ city: 'Hangzhou' });
    expect(parseWeatherApiResult(valid)).toEqual(valid);
    const forecastDay = valid.weather.forecast[0];
    expect(forecastDay).toBeDefined();
    if (!forecastDay) return;

    const malformed: unknown[] = [
      { summary: '', weather: {} },
      { ...valid, weather: { ...valid.weather, unit: 'kelvin' } },
      { ...valid, weather: { ...valid.weather, forecast: null } },
      { ...valid, weather: { ...valid.weather, forecast: [null] } },
      {
        ...valid,
        weather: {
          ...valid.weather,
          forecast: [{ ...forecastDay, high: 'warm' }],
        },
      },
      {
        ...valid,
        weather: {
          ...valid.weather,
          temperature: Number.POSITIVE_INFINITY,
        },
      },
      { ...valid, weather: { ...valid.weather, refresh: -1 } },
    ];

    for (const value of malformed) {
      expect(parseWeatherApiResult(value)).toBeNull();
    }
  });

  test('rejects malformed product results before rendering', () => {
    const valid = callProductApi({ productId: 'sneaker' });
    expect(parseProductApiResult(valid)).toEqual(valid);

    const malformed: unknown[] = [
      { ...valid, product: { ...valid.product, price: -1 } },
      { ...valid, product: { ...valid.product, rating: 6 } },
      { ...valid, product: { ...valid.product, reviewCount: 1.5 } },
      { ...valid, product: { ...valid.product, availability: 'unknown' } },
      {
        ...valid,
        purchase: { status: 'pending', message: 'Not confirmed' },
      },
      { ...valid, product: { ...valid.product, name: '' } },
    ];

    for (const value of malformed) {
      expect(parseProductApiResult(value)).toBeNull();
    }
  });

  test('normalizes a missing product availability for compatibility', () => {
    const valid = callProductApi({ productId: 'sneaker' });
    const parsed = parseProductApiResult({
      ...valid,
      product: { ...valid.product, availability: undefined },
    });

    expect(parsed?.product.availability).toBe('in_stock');
  });
});
