export function handleClick() {
  lynx.getNativeApp().callLepusMethod('updatePage', { content: 'Hello Lynx!' });
}

lynxCoreInject.tt.publishEvent = (handlerName: string, data: EventDataType) => {
  if (handlerName === 'handleClick') {
    handleClick();
  } else {
    console.info('publishEvent', handlerName, data);
  }
};
