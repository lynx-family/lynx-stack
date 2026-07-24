// A module-level side effect that is only valid on the background thread.
lynx.getJSModule('GlobalEventEmitter').addListener(
  'COMP_LIB_MT_UNSUPPORTED_EVENT',
  () => {
    console.info('COMP_LIB_MT_UNSUPPORTED_EVENT');
  },
);

export default function Counter() {
  return (
    <view>
      <text>COMP_LIB_COUNTER_TEXT</text>
    </view>
  );
}
