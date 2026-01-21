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

  const nativeModulesMap = {
    CustomModule: URL.createObjectURL(
      new Blob(
        [
          `export default function(NativeModules, NativeModulesCall) {
      return {
        async getColor(data, callback) {
          const color = await NativeModulesCall('getColor', data);
          callback(color);
        },
      }
    };`,
        ],
        { type: 'text/javascript' },
      ),
    ),
  };
  lynxView.nativeModulesMap = nativeModulesMap;
  const color_environment = URL.createObjectURL(
    new Blob(
      [
        `export default function(NapiModules, NapiModulesCall) {
    return {
      getColor() {
        NapiModules.color_methods.getColor({ color: 'green' }, color => {
          console.log(color);
        });
      },
      ColorEngine: class ColorEngine {
        getColor(name) {
          NapiModules.color_methods.getColor({ color: 'green' }, color => {
            console.log(color);
          });
        }
      },
    };
  };`,
      ],
      { type: 'text/javascript' },
    ),
  );

  const color_methods = URL.createObjectURL(
    new Blob(
      [
        `export default function(NapiModules, NapiModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NapiModulesCall('getColor', data);
        callback(color);
      },
    };
  };`,
      ],
      { type: 'text/javascript' },
    ),
  );
  const event_method = URL.createObjectURL(
    new Blob(
      [
        `export default function(NapiModules, NapiModulesCall, handleDispatch) {
    return {
      async bindEvent() {
        await NapiModulesCall('bindEvent');
        handleDispatch((data) => console.log(\`bts:\${data}\`));
      },
    };
  };`,
      ],
      { type: 'text/javascript' },
    ),
  );

  lynxView.napiModulesMap = {
    color_environment,
    color_methods,
    event_method,
  };
  lynxView.onNapiModulesCall = async (
    name,
    data,
    moduleName,
    dispatchNapiModules,
  ) => {
    if (name === 'getColor' && moduleName === 'color_methods') {
      return {
        data: { color: data.color, tagName: lynxView.tagName },
      };
    }
    if (name === 'bindEvent' && moduleName === 'event_method') {
      document.querySelector('lynx-view')?.addEventListener('click', () => {
        dispatchNapiModules('lynx-view');
      });
      return;
    }
    return undefined;
  };

  lynxView.initI18nResources = [
    {
      options: {
        locale: 'en',
        channel: '1',
        fallback_url: '',
      },
      resource: {
        hello: 'hello',
        lynx: 'lynx web platform1',
      },
    },
  ];

  return lynxView;
};

const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');
const casename2 = searchParams.get('casename2');
const resourceName = searchParams.get('resourceName');
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

  if (casename === 'api-inject-style-rules') {
    lynxView.injectStyleRules = [`.injected-style-rules{background:green}`];
  }
  lynxView.setAttribute('url', lynxTemplateUrl);
  lynxView.id = 'lynxview1';
  if (casename2) {
    lynxView.setAttribute('lynx-group-id', '2');
  }
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
if (resourceName) {
  const lynxView = lynxViewTests(
    document.querySelector('lynx-view') as LynxViewElement | undefined,
  );
  lynxView.setAttribute('url', `/resources/${resourceName}`);
}
