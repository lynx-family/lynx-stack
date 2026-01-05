import type { LynxViewElement } from '@lynx-js/web-core-wasm/client';
import './index.css';

export const lynxViewTests = (
  lynxView?: LynxViewElement | undefined,
) => {
  if (!lynxView) {
    lynxView = document.createElement('lynx-view') as LynxViewElement;
  }
  lynxView.initData = { mockData: 'mockData' };
  lynxView.setAttribute('height', 'auto');
  lynxView.globalProps = { backgroundColor: 'pink' };
  lynxView.addEventListener('error', (e) => {
    console.log(e);
    lynxView.setAttribute('style', 'display:none');
    lynxView.innerHTML = '';
  });
  lynxView.addEventListener('timing', (ev) => {
    // @ts-expect-error
    globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
  });
  if (!lynxView.parentElement) document.body.append(lynxView);

  Object.assign(globalThis, { lynxView });
  return lynxView;
};

const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');
const casename2 = searchParams.get('casename2');
const hasdir = searchParams.get('hasdir') === 'true';
const isSSR = document.location.pathname.includes('ssr');

if (casename) {
  const lynxTemplateUrl = `/dist/${isSSR ? 'ssr/' : ''}${
    hasdir ? `/${casename}/${casename}.web.bundle` : `${casename}.web.bundle`
  }`;
  const lynxTemplateUrl2 = `/dist/${isSSR ? 'ssr/' : ''}${
    hasdir ? `/${casename2}/${casename2}.web.bundle` : `${casename2}.web.bundle`
  }`;

  const lynxView = lynxViewTests(
    document.querySelector('lynx-view') as LynxViewElement | undefined,
  );
  lynxView.setAttribute('url', lynxTemplateUrl);
  lynxView.id = 'lynxview1';
  if (casename2) {
    lynxView.setAttribute('lynx-group-id', '2');
  }
  lynxView.injectStyleRules = [`.injected-style-rules{background:green}`];
  if (casename === 'api-nativemodules-call-delay') {
    setTimeout(() => {
      lynxView.onNativeModulesCall = (name, data, moduleName) => {
        if (name === 'getColor' && moduleName === 'CustomModule') {
          return data.color;
        }
        if (name === 'getColor' && moduleName === 'bridge') {
          return data.color;
        }
      };
    }, 2500);
  } else {
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (name === 'getColor' && moduleName === 'CustomModule') {
        return data.color;
      }
      if (name === 'getColor' && moduleName === 'bridge') {
        return data.color;
      }
    };
  }
  if (casename2) {
    const lynxView2 = lynxViewTests();
    lynxView2.id = 'lynxview2';
    lynxView2.setAttribute('url', lynxTemplateUrl2);
    lynxView2.setAttribute('lynx-group-id', '2');
  }
} else {
  console.error('cannot find casename');
}
