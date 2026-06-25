// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type LazyComponentBundlePlatform = 'web' | 'lynx';

export interface LazyComponentDemoOptions {
  baseUrl: string;
}

export interface LazyComponentBundleUrlOptions
  extends LazyComponentDemoOptions
{
  platform: LazyComponentBundlePlatform;
}

export function buildLazyComponentBundleUrl(
  options: LazyComponentBundleUrlOptions,
): string {
  const baseUrl = options.baseUrl.replace(/[?#].*$/u, '').replace(/\/$/u, '');
  return `${baseUrl}/a2ui-lazy-component.${options.platform}.bundle`;
}

export function getA2UIPlaygroundBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  if (pathname.endsWith('/')) return `${origin}${pathname}`;

  // eslint-disable-next-line n/no-unsupported-features/es-syntax
  const lastSegment = pathname.split('/').at(-1) ?? '';
  const basePath = lastSegment.includes('.')
    ? pathname.replace(/[^/]*$/u, '')
    : `${pathname}/`;
  return `${origin}${basePath}`;
}

export function createLazyComponentDemo(
  options: LazyComponentDemoOptions,
): unknown[] {
  const lazyComponentUrl = buildLazyComponentBundleUrl({
    ...options,
    platform: 'lynx',
  });
  const lazyComponentWebUrl = buildLazyComponentBundleUrl({
    ...options,
    platform: 'web',
  });
  return [
    {
      createSurface: {
        surfaceId: 'default',
        catalogId: 'demo-lazy-component',
      },
    },
    {
      updateComponents: {
        surfaceId: 'default',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: [
              'title',
              'intro',
              'lazy-component-url',
              'lazy-component',
            ],
            align: 'stretch',
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h2',
            text: 'Lazy Component',
          },
          {
            id: 'intro',
            component: 'Text',
            variant: 'body',
            text:
              'The next card is loaded from a ReactLynx lazy bundle. The A2UI payload only supplies the resource URL and source data.',
          },
          {
            id: 'lazy-component-url',
            component: 'Text',
            variant: 'caption',
            text: `LazyComponent URL: ${lazyComponentWebUrl}`,
          },
          {
            id: 'lazy-component',
            component: 'LazyComponent',
            url: lazyComponentUrl,
            webUrl: lazyComponentWebUrl,
            fallbackText: 'Loading remote catalog component',
            sourceData: {
              title: 'Campaign performance',
              subtitle:
                'Source data is passed directly into the lazy bundle component.',
              accent: '#2563eb',
              kpis: [
                {
                  label: 'Revenue',
                  value: '$42.8K',
                  delta: '+18.4%',
                },
                {
                  label: 'Orders',
                  value: '1,284',
                  delta: '+9.7%',
                },
                {
                  label: 'Conversion',
                  value: '6.3%',
                  delta: '+1.1 pt',
                },
              ],
            },
          },
        ],
      },
    },
  ];
}

export const lazyComponentDemo = createLazyComponentDemo({
  baseUrl: getA2UIPlaygroundBaseUrl(),
});

export default lazyComponentDemo;
