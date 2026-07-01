import './LazyComponent.css';

// ---------------------------------------------------------------------------
// These throws live INSIDE the dynamically-loaded component, so they compile
// into LazyComponent.lynx.bundle (its OWN release / debug-metadata), separate
// from the host (consumer main.lynx.bundle where CrashDemo lives). Use them to
// verify remap resolves a dynamic-component stack against the right bundle.
// ---------------------------------------------------------------------------

function lazyDeepInner(): never {
  throw new Error('boom from deep nested call (LazyComponent, background)'); // LazyComponent.tsx lazyDeepInner
}
function lazyDeepMid() {
  lazyDeepInner();
}

function lazyCrashBackground() {
  lazyDeepMid();
}

function lazyCrashType() {
  const obj = {} as { gone?: () => void };
  // TypeError inside the dynamic component
  return (obj.gone as () => void)();
}

function lazyCrashUndefinedProp() {
  const obj = {} as { missing?: { x: number } };
  // TypeError: Cannot read properties of undefined (reading 'x')
  return obj.missing!.x; // LazyComponent.tsx lazyCrashUndefinedProp
}

function lazyCrashMainThread() {
  'main thread';
  throw new Error('boom from LazyComponent main-thread'); // LazyComponent.tsx lazyCrashMainThread
}

export default function LazyComponent() {
  return (
    <view className='crash-section'>
      <text className='LazyComponent'>
        LazyComponent (dynamic) — tap to throw
      </text>
      <view className='crash-row' bindtap={() => lazyCrashBackground()}>
        <text>L1. nested deep stack (dynamic, background)</text>
      </view>
      <view className='crash-row' bindtap={() => lazyCrashType()}>
        <text>L2. TypeError (dynamic, background)</text>
      </view>
      <view className='crash-row' main-thread:bindtap={lazyCrashMainThread}>
        <text>L3. main-thread error (dynamic)</text>
      </view>
      <view className='crash-row' bindtap={() => lazyCrashUndefinedProp()}>
        <text>L4. read .x of undefined (dynamic, background)</text>
      </view>
    </view>
  );
}
