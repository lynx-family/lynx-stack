/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import './jsdom.js';
import { describe, expect, test, vi } from 'vitest';
import { I18nManager } from '../ts/client/mainthread/I18n.js';
import { BackgroundThread } from '../ts/client/mainthread/Background.js';
import { i18nResourceMissedEventName } from '../ts/constants.js';

describe('I18nManager', () => {
  const mockBackground = {
    dispatchI18nResource: vi.fn(),
  } as unknown as BackgroundThread;

  const rootDom = document.createElement('div').attachShadow({ mode: 'open' });

  test('should return matched resource and dispatch to background', () => {
    const initData = [
      {
        options: { locale: 'en', channel: 'default' },
        resource: { key: 'value' },
      },
    ];
    const i18nManager = new I18nManager(mockBackground, rootDom, initData);

    const result = i18nManager._I18nResourceTranslation({
      locale: 'en',
      channel: 'default',
    });

    expect(result).toEqual({ key: 'value' });
    expect(mockBackground.dispatchI18nResource).toHaveBeenCalledWith({
      key: 'value',
    });
  });

  test('should return undefined and trigger fallback when resource not found', () => {
    const i18nManager = new I18nManager(mockBackground, rootDom, []);
    const dispatchEventSpy = vi.spyOn(rootDom, 'dispatchEvent');

    const result = i18nManager._I18nResourceTranslation({
      locale: 'fr',
      channel: 'default',
    });

    expect(result).toBeUndefined();
    expect(mockBackground.dispatchI18nResource).toHaveBeenCalledWith(undefined);
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe(i18nResourceMissedEventName);
    expect(event.detail).toEqual({ locale: 'fr', channel: 'default' });
  });

  test('should update data using setData', () => {
    const i18nManager = new I18nManager(mockBackground, rootDom, []);
    i18nManager.updateData([
      {
        options: { locale: 'es', channel: 'default' },
        resource: { key: 'valor' },
      },
    ], { locale: 'es', channel: 'default' });

    const result = i18nManager._I18nResourceTranslation({
      locale: 'es',
      channel: 'default',
    });

    expect(result).toEqual({ key: 'valor' });
  });
});
