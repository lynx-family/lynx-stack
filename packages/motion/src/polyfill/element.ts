// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MainThread } from '@lynx-js/types';

interface StyleObject {
  [key: string]: string | ((property: string, value: string) => void);
  setProperty(property: string, value: string): void;
}

export class ElementCompt {
  private element: MainThread.Element;

  constructor(element: MainThread.Element) {
    this.element = element;
  }

  public getComputedStyle(): Record<string, string> {
    const styleObject: Record<string, string> = {};

    return new Proxy(styleObject, {
      get: (_target, prop) => {
        // @ts-expect-error Expected
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return __GetComputedStyleByKey(this.element.element, prop as string);
      },
    });
  }

  public get style(): StyleObject {
    const styleObject = {} as StyleObject;

    styleObject.setProperty = (property: string, value: string) => {
      if (property === 'transform' && value === 'none') {
        return this.element.setStyleProperty('transform', 'scale(1, 1)');
      }
      this.element.setStyleProperty(property, value);
    };
    return new Proxy(styleObject, {
      set: (target, prop, value) => {
        if (typeof prop === 'string' && prop !== 'setProperty') {
          if (prop === 'transform' && value === 'none') {
            this.element.setStyleProperty('transform', 'scale(1, 1)');
            return true;
          }
          this.element.setStyleProperty(prop, String(value));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          target[prop] = value;
        }
        return true;
      },
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop !== 'setProperty') {
          return this.getStyleProperty(prop);
        }
        return undefined;
      },
    });
  }

  public set style(styles: Record<string, string>) {
    this.element.setStyleProperties(styles);
  }

  // Individual style property getters and setters
  private getStyleProperty(name: string): string {
    // @ts-expect-error Expected
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return __GetComputedStyleByKey(this.element.element, name);
  }

  // Common style properties
  get backgroundColor(): string {
    return this.getStyleProperty('backgroundColor');
  }
  set backgroundColor(value: string) {
    this.element.setStyleProperty('backgroundColor', value);
  }

  get color(): string {
    return this.getStyleProperty('color');
  }
  set color(value: string) {
    this.element.setStyleProperty('color', value);
  }

  get fontSize(): string {
    return this.getStyleProperty('fontSize');
  }
  set fontSize(value: string) {
    this.element.setStyleProperty('fontSize', value);
  }

  get width(): string {
    return this.getStyleProperty('width');
  }
  set width(value: string) {
    this.element.setStyleProperty('width', value);
  }

  get height(): string {
    return this.getStyleProperty('height');
  }
  set height(value: string) {
    this.element.setStyleProperty('height', value);
  }

  get margin(): string {
    return this.getStyleProperty('margin');
  }
  set margin(value: string) {
    this.element.setStyleProperty('margin', value);
  }

  get padding(): string {
    return this.getStyleProperty('padding');
  }
  set padding(value: string) {
    this.element.setStyleProperty('padding', value);
  }

  get display(): string {
    return this.getStyleProperty('display');
  }
  set display(value: string) {
    this.element.setStyleProperty('display', value);
  }

  get position(): string {
    return this.getStyleProperty('position');
  }
  set position(value: string) {
    this.element.setStyleProperty('position', value);
  }

  get top(): string {
    return this.getStyleProperty('top');
  }
  set top(value: string) {
    this.element.setStyleProperty('top', value);
  }

  get left(): string {
    return this.getStyleProperty('left');
  }
  set left(value: string) {
    this.element.setStyleProperty('left', value);
  }

  get right(): string {
    return this.getStyleProperty('right');
  }
  set right(value: string) {
    this.element.setStyleProperty('right', value);
  }

  get bottom(): string {
    return this.getStyleProperty('bottom');
  }
  set bottom(value: string) {
    this.element.setStyleProperty('bottom', value);
  }

  public getBoundingClientRect(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    x: number;
    y: number;
  } {
    // Parse dimensions from computed style
    const width = Number.parseFloat(this.getStyleProperty('width')) || 0;
    const height = Number.parseFloat(this.getStyleProperty('height')) || 0;

    // Parse position - these may be 'auto' or pixel values
    const left = Number.parseFloat(this.getStyleProperty('left')) || 0;
    const top = Number.parseFloat(this.getStyleProperty('top')) || 0;

    // Calculate bounds
    const right = left + width;
    const bottom = top + height;

    return {
      left,
      top,
      right,
      bottom,
      width,
      height,
      x: left,
      y: top,
    };
  }
}
