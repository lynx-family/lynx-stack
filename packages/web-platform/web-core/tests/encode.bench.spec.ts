import './jsdom.js';
import { bench, describe } from 'vitest';
import { encodeCSS } from '../ts/encode/encodeCSS.js';
import * as CSS from '@lynx-js/css-serializer';
import {
  get_style_content,
  decode_style_info,
} from '../binary/encode/encode.js';

describe('Encode/Decode Benchmarks', () => {
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

  describe('Decode Performance (decode_style_info)', () => {
    bench('Small CSS', () => {
      decode_style_info(bufferSmall, undefined, true);
    });

    bench('Medium CSS', () => {
      decode_style_info(bufferMedium, undefined, true);
    });

    bench('Large CSS', () => {
      decode_style_info(bufferLarge, undefined, true);
    });
  });

  describe('Generate Performance (get_style_content)', () => {
    bench('Small CSS', () => {
      get_style_content(decodedSmall);
    });

    bench('Medium CSS', () => {
      get_style_content(decodedMedium);
    });

    bench('Large CSS', () => {
      get_style_content(decodedLarge);
    });
  });

  describe('Full Roundtrip (Decode + Generate)', () => {
    bench('Medium CSS', () => {
      get_style_content(decode_style_info(bufferMedium, undefined, true));
    });
  });
});
