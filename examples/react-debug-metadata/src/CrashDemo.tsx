import { useState } from '@lynx-js/react';

// ---------------------------------------------------------------------------
// Crash demo — every button below throws on a DIFFERENT thread / in a
// DIFFERENT shape, so you can paste the resulting red-screen / Slardar stack
// into the 反解 (remap) tool and check the remapped location matches the line
// commented next to each throw.
//
// - bindtap handlers run on the BACKGROUND (JS) thread  -> source-map 单步反解
// - main-thread:bindtap handlers run on the MAIN thread -> bytecode 两步反解
// ---------------------------------------------------------------------------

// nested call chain -> multi-frame background stack (innerThrow -> mid -> outer)
function innerThrow(): never {
  throw new Error('boom from deep nested call (background)'); // CrashDemo.tsx innerThrow
}
function mid() {
  innerThrow();
}
function outer() {
  mid();
}

function crashTypeError() {
  const obj = {} as { notAFunction?: () => void };
  // TypeError: obj.notAFunction is not a function
  return (obj.notAFunction as () => void)();
}

function crashReferenceError(): number {
  // ReferenceError: notDefinedVariable is not defined
  // @ts-expect-error intentional undefined reference for the crash demo
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return notDefinedVariable + 1;
}

function crashExplicit() {
  throw new Error('explicit throw new Error (background)'); // CrashDemo.tsx crashExplicit
}

function crashNested() {
  outer();
}

// runs on the MAIN thread -> produces an `at fn:function_id:pc` stack
function crashMainThread() {
  'main thread';
  throw new Error('boom from main-thread'); // CrashDemo.tsx crashMainThread
}

export function CrashDemo() {
  const [, setTick] = useState(0);
  return (
    <view className='crash-section'>
      <text className='crash-title'>CrashDemo (host) — tap a row to throw</text>

      <view className='crash-row' bindtap={() => crashTypeError()}>
        <text>1. TypeError (call undefined, background)</text>
      </view>
      <view className='crash-row' bindtap={() => crashReferenceError()}>
        <text>2. ReferenceError (background)</text>
      </view>
      <view className='crash-row' bindtap={() => crashExplicit()}>
        <text>3. throw new Error (background)</text>
      </view>
      <view className='crash-row' bindtap={() => crashNested()}>
        <text>4. nested deep stack (background)</text>
      </view>
      <view className='crash-row' main-thread:bindtap={crashMainThread}>
        <text>7. main-thread error</text>
      </view>

      {/* harmless tap to prove the component is mounted/interactive */}
      <view className='crash-row' bindtap={() => setTick((n) => n + 1)}>
        <text>(tap me: no-op)</text>
      </view>
    </view>
  );
}
