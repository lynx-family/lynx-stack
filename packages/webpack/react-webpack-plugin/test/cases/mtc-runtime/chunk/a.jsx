// Simulates a module that uses MTC — compiled code will call registerMTC
export function MTCComponent() {
  'main thread';

  return (
    <view>
      <text>MTC Component</text>
    </view>
  );
}

// This marker triggers the MTC runtime injection
// In real compiled output, registerMTC is emitted by the snapshot plugin
globalThis.registerMTC && registerMTC('test-hash', MTCComponent);
