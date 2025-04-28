// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';

import { LifecycleConstant, NativeUpdateDataType } from '../lifecycleConstant.js';
import {
  PerformanceTimingFlags,
  PerformanceTimingKeys,
  PipelineOrigins,
  beginPipeline,
  markTiming,
} from './performance.js';
import { BackgroundSnapshotInstance, hydrate } from '../backgroundSnapshot.js';
import { runWithForce } from './runWithForce.js';
import { destroyBackground } from '../lifecycle/destroy.js';
import { delayedEvents, delayedPublishEvent } from '../lifecycle/event/delayEvents.js';
import { delayLifecycleEvent, delayedLifecycleEvents } from '../lifecycle/event/delayLifecycleEvents.js';
import { commitPatchUpdate, genCommitTaskId, globalCommitTaskMap } from '../lifecycle/patch/commit.js';
import type { PatchList } from '../lifecycle/patch/commit.js';
import { reloadBackground } from '../lifecycle/reload.js';
import { CHILDREN } from '../renderToOpcodes/constants.js';
import { __root } from '../root.js';
import { globalRefsToSet, updateBackgroundRefs } from '../snapshot/ref.js';
import { backgroundSnapshotInstanceManager } from '../snapshot.js';
import { destroyWorklet } from '../worklet/destroy.js';

export { runWithForce };

function injectTt(): void {
  // @ts-ignore
  const tt = lynxCoreInject.tt;
  tt.OnLifecycleEvent = onLifecycleEvent;
  tt.publishEvent = delayedPublishEvent;
  tt.publicComponentEvent = delayedPublicComponentEvent;
  tt.callDestroyLifetimeFun = () => {
    destroyWorklet();
    destroyBackground();
  };
  tt.updateGlobalProps = updateGlobalProps;
  tt.updateCardData = updateCardData;
  tt.onAppReload = reloadBackground;
  tt.processCardConfig = () => {
    // used to updateTheme, no longer rely on this function
  };
}

function onLifecycleEvent([type, data]: [string, any]) {
  const hasRootRendered = CHILDREN in __root;
  // never called `render(<App/>, __root)`
  // happens if user call `root.render()` async
  if (!hasRootRendered) {
    delayLifecycleEvent(type, data);
    return;
  }

  if (__PROFILE__) {
    console.profile(`OnLifecycleEvent::${type}`);
  }

  try {
    onLifecycleEventImpl(type, data);
  } catch (e) {
    lynx.reportError(e as Error);
  }

  if (__PROFILE__) {
    console.profileEnd();
  }
}

function onLifecycleEventImpl(type: string, data: any): void {
  switch (type) {
    case LifecycleConstant.firstScreen: {
      const { root: lepusSide, refPatch, jsReadyEventIdSwap } = data;
      if (__PROFILE__) {
        console.profile('hydrate');
      }
      beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);
      markTiming(PerformanceTimingKeys.hydrateParseSnapshotStart);
      const before = JSON.parse(lepusSide);
      markTiming(PerformanceTimingKeys.hydrateParseSnapshotEnd);
      markTiming(PerformanceTimingKeys.diffVdomStart);
      const snapshotPatch = hydrate(
        before,
        __root as BackgroundSnapshotInstance,
      );
      if (__PROFILE__) {
        console.profileEnd();
      }
      markTiming(PerformanceTimingKeys.diffVdomEnd);

      // TODO: It seems `delayedEvents` and `delayedLifecycleEvents` should be merged into one array to ensure the proper order of events.
      flushDelayedLifecycleEvents();
      if (delayedEvents) {
        delayedEvents.forEach((args) => {
          const [handlerName, data] = args;
          let [idStr, ...rest] = handlerName.split(':');
          while (jsReadyEventIdSwap[idStr!]) idStr = jsReadyEventIdSwap[idStr!];
          try {
            publishEvent([idStr, ...rest].join(':'), data);
          } catch (e) {
            lynx.reportError(e as Error);
          }
        });
        delayedEvents.length = 0;
      }

      lynxCoreInject.tt.publishEvent = publishEvent;
      lynxCoreInject.tt.publicComponentEvent = publicComponentEvent;

      if (__PROFILE__) {
        console.profile('patchRef');
      }
      if (refPatch) {
        globalRefsToSet.set(0, JSON.parse(refPatch));
        updateBackgroundRefs(0);
      }
      if (__PROFILE__) {
        console.profileEnd();
      }
      // console.debug("********** After hydration:");
      // printSnapshotInstance(__root as BackgroundSnapshotInstance);
      if (__PROFILE__) {
        console.profile('commitChanges');
      }
      const commitTaskId = genCommitTaskId();
      const patchList: PatchList = {
        patchList: [{ snapshotPatch, id: commitTaskId }],
      };
      const obj = commitPatchUpdate(patchList, { isHydration: true });

      lynx.getNativeApp().callLepusMethod(LifecycleConstant.patchUpdate, obj, () => {
        updateBackgroundRefs(commitTaskId);
        globalCommitTaskMap.forEach((commitTask, id) => {
          if (id > commitTaskId) {
            return;
          }
          commitTask();
          globalCommitTaskMap.delete(id);
        });
      });
      break;
    }
    case LifecycleConstant.globalEventFromLepus: {
      const [eventName, params] = data;
      lynx.getJSModule('GlobalEventEmitter').trigger(eventName, params);
      break;
    }
    case LifecycleConstant.ref: {
      const { refPatch, commitTaskId } = data;
      if (commitTaskId) {
        globalRefsToSet.set(commitTaskId, JSON.parse(refPatch));
      } else {
        globalRefsToSet.set(0, JSON.parse(refPatch));
        updateBackgroundRefs(0);
      }
      break;
    }
  }
}

let flushingDelayedLifecycleEvents = false;
function flushDelayedLifecycleEvents(): void {
  // avoid stackoverflow
  if (flushingDelayedLifecycleEvents) return;
  flushingDelayedLifecycleEvents = true;
  if (delayedLifecycleEvents) {
    delayedLifecycleEvents.forEach((e) => {
      onLifecycleEvent(e);
    });
    delayedLifecycleEvents.length = 0;
  }
  flushingDelayedLifecycleEvents = false;
}

function publishEvent(handlerName: string, data: unknown) {
  // TODO: delay js events until js ready
  lynxCoreInject.tt.callBeforePublishEvent?.(data);
  const eventHandler = backgroundSnapshotInstanceManager.getValueBySign(
    handlerName,
  );
  if (eventHandler) {
    try {
      (eventHandler as Function)(data);
    } catch (e) {
      lynx.reportError(e as Error);
    }
  }
}

function publicComponentEvent(_componentId: string, handlerName: string, data: unknown) {
  publishEvent(handlerName, data);
}

function delayedPublicComponentEvent(_componentId: string, handlerName: string, data: unknown) {
  delayedPublishEvent(handlerName, data);
}

function updateGlobalProps(newData: Record<string, any>): void {
  Object.assign(lynx.__globalProps, newData);

  // Our purpose is to make sure SYNC setState inside `emit`'s listeners
  // can be batched with updateFromRoot
  // This is already done because updateFromRoot will consume all dirty flags marked by
  // the setState, and setState's flush will be a noop. No extra diffs will be needed.
  Promise.resolve().then(() => {
    runWithForce(() => render(__root.__jsx, __root as any));
  });
  lynxCoreInject.tt.GlobalEventEmitter.emit('onGlobalPropsChanged');
}

function updateCardData(newData: Record<string, any>, options?: Record<string, any>): void {
  const { ['__lynx_timing_flag']: performanceTimingFlag, ...restNewData } = newData;
  if (performanceTimingFlag) {
    lynx.reportError(
      new Error(
        `Received unsupported updateData with \`__lynx_timing_flag\` (value "${performanceTimingFlag}"), the timing flag is ignored`,
      ),
    );
  }
  const { type = NativeUpdateDataType.UPDATE } = options || {};
  if (type == NativeUpdateDataType.RESET) {
    // @ts-ignore
    lynx.__initData = {};
  }

  // COW when modify `lynx.__initData` to make sure Provider & Consumer works
  // @ts-ignore
  lynx.__initData = Object.assign({}, lynx.__initData, restNewData);
  lynxCoreInject.tt.GlobalEventEmitter.emit('onDataChanged');
}

export { injectTt, flushDelayedLifecycleEvents };
