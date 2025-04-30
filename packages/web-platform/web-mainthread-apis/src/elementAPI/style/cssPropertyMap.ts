// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const cacheForCamelize: Record<string, string> = {};

export function camelize(str: string): string {
  if (cacheForCamelize[str]) {
    return cacheForCamelize[str];
  }

  const result = (str + '').replace(/-\D/g, function(match) {
    return match.charAt(1).toUpperCase();
  });
  cacheForCamelize[str] = result;
  return result;
}

let index = 1;
const cssPropertyMap: Record<
  number,
  { name: string; dashName: string; isX: boolean }
> = {};
const cssPropertyReverseMap: Record<string, number> = {};
const V = (name: string) => {
  const k = index++;
  const isX = name.startsWith('-x-');
  cssPropertyMap[k] = { name: camelize(name), dashName: name, isX };
  cssPropertyReverseMap[name] = k;
};

V('top');
V('left');
V('right');
V('bottom');
V('position');
V('box-sizing');
V('background-color');
V('border-left-color');
V('border-right-color');
V('border-top-color');
V('border-bottom-color');
V('border-radius');
V('border-top-left-radius');
V('border-bottom-left-radius');
V('border-top-right-radius');
V('border-bottom-right-radius');
V('border-width');
V('border-left-width');
V('border-right-width');
V('border-top-width');
V('border-bottom-width');
V('color');
V('opacity');
V('display');
V('overflow');
V('height');
V('width');
V('max-width');
V('min-width');
V('max-height');
V('min-height');
V('padding');
V('padding-left');
V('padding-right');
V('padding-top');
V('padding-bottom');
V('margin');
V('margin-left');
V('margin-right');
V('margin-top');
V('margin-bottom');
V('white-space');
V('letter-spacing');
V('text-align');
V('line-height');
V('text-overflow');
V('font-size');
V('font-weight');
V('flex');
V('flex-grow');
V('flex-shrink');
V('flex-basis');
V('flex-direction');
V('flex-wrap');
V('align-items');
V('align-self');
V('align-content');
V('justify-content');
V('background');
V('border-color');
V('font-family');
V('font-style');
V('transform');
V('animation');
V('animation-name');
V('animation-duration');
V('animation-timing-function');
V('animation-delay');
V('animation-iteration-count');
V('animation-direction');
V('animation-fill-mode');
V('animation-play-state');
V('line-spacing');
V('border-style');
V('order');
V('box-shadow');
V('transform-origin');
V('linear-orientation');
V('linear-weight-sum');
V('linear-weight');
V('linear-gravity');
V('linear-layout-gravity');
V('layout-animation-create-duration');
V('layout-animation-create-timing-function');
V('layout-animation-create-delay');
V('layout-animation-create-property');
V('layout-animation-delete-duration');
V('layout-animation-delete-timing-function');
V('layout-animation-delete-delay');
V('layout-animation-delete-property');
V('layout-animation-update-duration');
V('layout-animation-update-timing-function');
V('layout-animation-update-delay');
V('adapt-font-size');
V('aspect-ratio');
V('text-decoration');
V('text-shadow');
V('background-image');
V('background-position');
V('background-origin');
V('background-repeat');
V('background-size');
V('border');
V('visibility');
V('border-right');
V('border-left');
V('border-top');
V('border-bottom');
V('transition');
V('transition-property');
V('transition-duration');
V('transition-delay');
V('transition-timing-function');
V('content');
V('border-left-style');
V('border-right-style');
V('border-top-style');
V('border-bottom-style');
V('implicit-animation');
V('overflow-x');
V('overflow-y');
V('word-break');
V('background-clip');
V('outline');
V('outline-color');
V('outline-style');
V('outline-width');
V('vertical-align');
V('caret-color');
V('direction');
V('relative-id');
V('relative-align-top');
V('relative-align-right');
V('relative-align-bottom');
V('relative-align-left');
V('relative-top-of');
V('relative-right-of');
V('relative-bottom-of');
V('relative-left-of');
V('relative-layout-once');
V('relative-center');
V('enter-transition-name');
V('exit-transition-name');
V('pause-transition-name');
V('resume-transition-name');
V('flex-flow');
V('z-index');
V('text-decoration-color');
V('linear-cross-gravity');
V('margin-inline-start');
V('margin-inline-end');
V('padding-inline-start');
V('padding-inline-end');
V('border-inline-start-color');
V('border-inline-end-color');
V('border-inline-start-width');
V('border-inline-end-width');
V('border-inline-start-style');
V('border-inline-end-style');
V('border-start-start-radius');
V('border-end-start-radius');
V('border-start-end-radius');
V('border-end-end-radius');
V('relative-align-inline-start');
V('relative-align-inline-end');
V('relative-inline-start-of');
V('relative-inline-end-of');
V('inset-inline-start');
V('inset-inline-end');
V('mask-image');
V('grid-template-columns');
V('grid-template-rows');
V('grid-auto-columns');
V('grid-auto-rows');
V('grid-column-span');
V('grid-row-span');
V('grid-column-start');
V('grid-column-end');
V('grid-row-start');
V('grid-row-end');
V('grid-column-gap');
V('grid-row-gap');
V('justify-items');
V('justify-self');
V('grid-auto-flow');
V('filter');
V('list-main-axis-gap');
V('list-cross-axis-gap');
V('linear-direction');
V('perspective');
V('cursor');
V('text-indent');
V('clip-path');
V('text-stroke');
V('text-stroke-width');
V('text-stroke-color');
V('-x-auto-font-size');
V('-x-auto-font-size-preset-sizes');
V('mask');
V('mask-repeat');
V('mask-position');
V('mask-clip');
V('mask-origin');
V('mask-size');
V('gap');
V('column-gap');
V('row-gap');
V('image-rendering');
V('hyphens');
V('-x-app-region');
V(
  '-x-animation-color-interpolation',
);
V('-x-handle-color');
V('-x-handle-size');
V('offset-path');
V('offset-distance');

export function queryCSSProperty(index: number): {
  name: string;
  dashName: string;
  isX: boolean;
} {
  return cssPropertyMap[index]!;
}

export function queryCSSPropertyNumber(name: string): number {
  return cssPropertyReverseMap[name]!;
}

export { cssPropertyMap };
