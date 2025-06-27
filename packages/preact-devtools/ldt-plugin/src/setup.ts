export default function setupDevtoolPanel(): void {
  const devtoolsProps = window.preactDevtoolsLDTCtx.devtoolsProps;
  const listeners: Record<string, ((msg: MessageEvent) => void)[]> = {};
  preactDevtoolsLDTCtx.addEventListener = (type, callback) => {
    if (!listeners[type]) {
      listeners[type] = [];
    }
    listeners[type].push(callback);
  };
  preactDevtoolsLDTCtx.removeEventListener = (type, callback) => {
    if (listeners[type]?.length) {
      listeners[type].splice(listeners[type].indexOf(callback), 1);
    }
  };
  preactDevtoolsLDTCtx.postMessage = (
    { source, type, data },
    _targetOrigin,
  ) => {
    for (let i = 0; i < (listeners['message']?.length ?? 0); i++) {
      listeners['message']?.[i]?.({
        source: window,
        data: {
          source,
          type,
          data,
        },
      } as unknown as MessageEvent);
    }
    devtoolsProps.postMessage('Remote.Customized.CDP', {
      method: 'Lynx.sendVMEvent',
      params: {
        vmType: 'JSContext',
        event: 'PreactDevtools',
        data: JSON.stringify({
          source,
          type,
          data,
        }),
      },
    });
  };

  devtoolsProps.addEventListener('Remote.Customized.CDP', msg => {
    const msgObj = JSON.parse(msg);
    if (msgObj?.method === 'Lynx.onVMEvent') {
      const {
        event,
        vmType: _vmType,
        data: _data,
      } = msgObj.params;
      if (event === 'PreactDevtools') {
        const dataObj = JSON.parse(msgObj.params.data);
        if (__DEBUG__) console.log('frontend -> hdt message received', dataObj);
        const { source, type, data } = dataObj;
        for (let i = 0; i < (listeners['message']?.length ?? 0); i++) {
          listeners['message']?.[i]?.({
            source: window,
            data: {
              source,
              type,
              data,
            },
          } as unknown as MessageEvent);
        }
      }
    }
  });
}
