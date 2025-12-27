import { encodeCSS, get_decoded_style_string } from '@encode/encodeCSS.js';
import * as CSS from '@lynx-js/css-serializer';
import { bench, describe } from 'vitest';
import {
  flattenStyleInfo,
  transformToWebCss,
  genCssContent,
} from '../../web-mainthread-apis/ts/utils/processStyleInfo.js';
import { genStyleInfo } from '../../../webpack/template-webpack-plugin/src/web/genStyleInfo.ts';

const css = `:root {
  background-color: #000;
  --color-text: #fff;
}

.Background {
  position: fixed;
  background: radial-gradient(
    71.43% 62.3% at 46.43% 36.43%,
    rgba(18, 229, 229, 0) 15%,
    rgba(239, 155, 255, 0.3) 56.35%,
    #ff6448 100%
  );
  box-shadow: 0px 12.93px 28.74px 0px #ffd28db2 inset;
  border-radius: 50%;
  width: 200vw;
  height: 200vw;
  top: -60vw;
  left: -14.27vw;
  transform: rotate(15.25deg);
}

.App {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

text {
  color: var(--color-text);
}

.Banner {
  flex: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.Logo {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.Logo--react {
  width: 100px;
  height: 100px;
  animation: Logo--spin infinite 20s linear;
}

.Logo--lynx {
  width: 100px;
  height: 100px;
  animation: Logo--shake infinite 0.5s ease;
}

@keyframes Logo--spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes Logo--shake {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}

.Content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.Arrow {
  width: 24px;
  height: 24px;
}

.Title {
  font-size: 36px;
  font-weight: 700;
}

.Subtitle {
  font-style: italic;
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 8px;
}

.Description {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.85);
  margin: 15rpx;
}

.Hint {
  font-size: 12px;
  margin: 5px;
  color: rgba(255, 255, 255, 0.65);
}
`;

const scopedCssMap = {
  '1': CSS.parse(css).root,
  '2': CSS.parse(css).root,
};

const unscopedCssMap = {
  '0': CSS.parse(css).root,
};

function decodeStyleInfoJS(
  styleInfoString: string,
  entryName: string | null,
  enableCSSSelector: boolean,
  enableRemoveCSSScope: boolean,
) {
  const styleInfo = JSON.parse(styleInfoString);
  const flattenedStyleInfo = flattenStyleInfo(
    styleInfo,
  );
  transformToWebCss(
    flattenedStyleInfo,
  );
  genCssContent(
    flattenedStyleInfo,
    {
      enableCSSSelector,
      enableRemoveCSSScope,
    } as any,
    undefined,
  );
}

describe('bench-decode-normal', () => {
  const encodedStyleInfoWASM = encodeCSS(unscopedCssMap);
  const encodedStyleInfoJS = JSON.stringify(genStyleInfo(unscopedCssMap));
  bench('decode-wasm', () => {
    get_decoded_style_string(encodedStyleInfoWASM, null, true);
  });
  bench('decode-js', () => {
    decodeStyleInfoJS(encodedStyleInfoJS, null, true, true);
  });
});

describe('bench-decode-scope-css', () => {
  const encodedStyleInfoWASM = encodeCSS(scopedCssMap);
  const encodedStyleInfoJS = JSON.stringify(genStyleInfo(scopedCssMap));
  bench('decode-wasm', () => {
    get_decoded_style_string(encodedStyleInfoWASM, null, true);
  });
  bench('decode-js', () => {
    decodeStyleInfoJS(encodedStyleInfoJS, null, true, false);
  });
});

describe('bench-decode-scope-css-and-selector-false', () => {
  const encodedStyleInfoWASM = encodeCSS(scopedCssMap);
  const encodedStyleInfoJS = JSON.stringify(genStyleInfo(scopedCssMap));
  bench('decode-wasm', () => {
    get_decoded_style_string(encodedStyleInfoWASM, null, false);
  });
  bench('decode-js', () => {
    decodeStyleInfoJS(encodedStyleInfoJS, null, false, false);
  });
});
