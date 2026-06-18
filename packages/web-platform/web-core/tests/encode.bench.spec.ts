// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './jsdom.js';
import * as CSS from '@lynx-js/css-serializer';
import { Bench, withCodSpeed } from '@lynx-js/codspeed-tinybench';
import { encodeCSS } from '../ts/encode/encodeCSS.js';
import {
  decode_style_info,
  get_style_content,
} from '../binary/encode/encode.js';

// Restore the native `Event`/`MouseEvent` stashed by `jsdom.js`; tinybench's
// `Bench` is a native `EventTarget` and dispatches native `Event`s.
globalThis.Event = (globalThis as any).__nativeEvent__;
globalThis.MouseEvent = (globalThis as any).__nativeMouseEvent__;

const bench = new Bench();

// 1. Setup Data
const SMALL_CSS = `
        .foo {
            color: red;
            font-size: 14px;
        }
    `;

const MEDIUM_CSS = `
        .container {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .item {
            flex: 1;
            margin: 10px;
            padding: 20px;
            background-color: #f0f0f0;
            border-radius: 8px;
        }
        .active {
            color: blue;
            font-weight: bold;
        }
        @media (min-width: 600px) {
            .container {
                flex-direction: row;
            }
        }
    `;

// A large generated CSS string
const LARGE_CSS_RULES = Array.from({ length: 50 }, (_, i) => `
        .rule-${i} {
            width: ${i}px;
            height: ${i * 2}px;
            margin: ${i % 5}rem;
            color: rgb(${i % 255}, ${i % 255}, ${i % 255});
            background-color: rgba(0,0,0,0.5);
            border: 1px solid black;
        }
        .rule-${i}:hover {
            opacity: 0.8;
            transform: scale(1.1);
        }
        .rule-${i} > .child {
            display: none;
        }
    `).join('\n');

const LARGE_CSS = `
        :root {
            --main-color: #333;
            --accent-color: #f00;
        }
        ${LARGE_CSS_RULES}
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;

// Pre-encode buffers
const bufferSmall = encodeCSS({ '0': CSS.parse(SMALL_CSS).root });
const bufferMedium = encodeCSS({ '0': CSS.parse(MEDIUM_CSS).root });
const bufferLarge = encodeCSS({ '0': CSS.parse(LARGE_CSS).root });

// Pre-decode for generate benchmarks
const decodedSmall = decode_style_info(bufferSmall, undefined, true);
const decodedMedium = decode_style_info(bufferMedium, undefined, true);
const decodedLarge = decode_style_info(bufferLarge, undefined, true);

bench.add('Decode Performance (decode_style_info) > Small CSS', () => {
  decode_style_info(bufferSmall, undefined, true);
});
bench.add('Decode Performance (decode_style_info) > Medium CSS', () => {
  decode_style_info(bufferMedium, undefined, true);
});
bench.add('Decode Performance (decode_style_info) > Large CSS', () => {
  decode_style_info(bufferLarge, undefined, true);
});

bench.add('Generate Performance (get_style_content) > Small CSS', () => {
  get_style_content(decodedSmall);
});
bench.add('Generate Performance (get_style_content) > Medium CSS', () => {
  get_style_content(decodedMedium);
});
bench.add('Generate Performance (get_style_content) > Large CSS', () => {
  get_style_content(decodedLarge);
});

bench.add('Full Roundtrip (Decode + Generate) > Medium CSS', () => {
  get_style_content(decode_style_info(bufferMedium, undefined, true));
});

await withCodSpeed(bench, import.meta.url);
