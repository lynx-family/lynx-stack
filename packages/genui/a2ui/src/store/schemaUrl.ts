// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { parse, resolve, serialize } from 'uri-js';

/** The URI operations used by cfworker's schema resolver, without a host URL. */
export class SchemaURL {
  href: string;

  constructor(input: string, base?: string) {
    const components = parse(base === undefined ? input : resolve(base, input));
    if (components.error || !components.scheme) {
      throw new TypeError(`Invalid schema URI: ${input}`);
    }
    this.href = serialize(components);
  }

  get hash(): string {
    const index = this.href.indexOf('#');
    return index === -1 || index === this.href.length - 1
      ? ''
      : this.href.slice(index);
  }

  set hash(value: string) {
    this.href = this.href.split('#')[0]!
      + (value ? (value.startsWith('#') ? value : `#${value}`) : '');
  }
}
