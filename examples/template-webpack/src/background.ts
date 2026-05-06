let content = 'Hello World!';
export function handleClick() {
  content = content === 'Hello World!' ? 'Hello Lynx!' : 'Hello World!';
  lynx.getNativeApp().callLepusMethod('updatePage', { content });
}

const previousPublishEvent = lynxCoreInject.tt.publishEvent;

lynxCoreInject.tt.publishEvent = (handlerName: string, data: EventDataType) => {
  if (handlerName === 'handleClick') {
    handleClick();
  } else {
    previousPublishEvent?.call(lynxCoreInject.tt, handlerName, data);
  }
};
