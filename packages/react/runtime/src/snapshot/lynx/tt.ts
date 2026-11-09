// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { process, render } from 'preact';

import { runWithForce } from './runWithForce.js';
import { updateGlobalProps as updateGlobalPropsCore } from '../../core/globalProps.js';
import { updateCardData } from '../../core/lynx-update-data.js';
import { PerformanceTimingFlags, PipelineOrigins, beginPipeline, markTiming } from '../../core/performance.js';
import {
  delayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../core/thread-function-call/main-thread.js';
import { __root } from '../../root.js';
import { tryDebugLog, tryEndDebugProfile, tryStartDebugProfile } from '../../shared/debug-logging.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { CHILDREN } from '../../shared/render-constants.js';
import { getSnapshotVNodeSource } from '../debug/vnodeSource.js';
import { LifecycleConstant } from '../lifecycle/constant.js';
import type { FirstScreenData } from '../lifecycle/constant.js';
import { destroyBackground } from '../lifecycle/destroy.js';
import { delayedEvents, delayedPublishEvent } from '../lifecycle/event/delayEvents.js';
import { delayLifecycleEvent, delayedLifecycleEvents } from '../lifecycle/event/delayLifecycleEvents.js';
import { commitPatchUpdate, genCommitTaskId, globalCommitTaskMap } from '../lifecycle/patch/commit.js';
import type { PatchList } from '../lifecycle/patch/commit.js';
import { removeCtxNotFoundEventListener } from '../lifecycle/patch/error.js';
import { runDelayedUiOps } from '../lifecycle/ref/delay.js';
import { reloadBackground } from '../lifecycle/reload.js';
import {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
  hydrate,
} from '../snapshot/backgroundSnapshot.js';
import type { SerializedSnapshotInstance } from '../snapshot/types.js';
import { destroyWorklet } from '../worklet/destroy.js';
import { sendMTRefInitValueToMainThread } from '../worklet/ref/updateInitValue.js';

export { runWithForce };

function injectTt(): void {
  const tt = lynx.getApp();
  tt.OnLifecycleEvent = onLifecycleEvent;
  tt.publishEvent = delayedPublishEvent;
  tt.publicComponentEvent = delayedPublicComponentEvent;
  tt.callDestroyLifetimeFun = () => {
    removeCtxNotFoundEventListener();
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

function onLifecycleEvent([type, data]: [LifecycleConstant, unknown]) {
  const hasRootRendered = CHILDREN in __root;
  // never called `render(<App/>, __root)`
  // happens if user call `root.render()` async
  if (!hasRootRendered) {
    delayLifecycleEvent(type, data);
    return;
  }

  const started = typeof __PROFILE__ !== 'undefined' && __PROFILE__
    && tryStartDebugProfile(`OnLifecycleEvent::${type}`);

  try {
    onLifecycleEventImpl(type, data);
  } catch (e) {
    lynx.reportError(e as Error);
  } finally {
    tryEndDebugProfile(started);
  }
}

function onLifecycleEventImpl(type: LifecycleConstant, data: unknown): void {
  switch (type) {
    case LifecycleConstant.firstScreen: {
      hydrateFirstScreen(data as FirstScreenData);
      break;
    }
    case LifecycleConstant.globalEventFromLepus: {
      const [eventName, params] = data as [string, Record<string, any>];
      lynx.getJSModule('GlobalEventEmitter').trigger(eventName, params);
      break;
    }
    case LifecycleConstant.publishEvent: {
      const { handlerName, data: d } = data as { handlerName: string; data: EventDataType };
      lynx.getApp().publishEvent(handlerName, d);
      break;
    }
  }
}

function hydrateFirstScreen(data: FirstScreenData): void {
  let processErr;
  try {
    process();
  } catch (e) {
    processErr = e;
  }
  const { root: lepusSide, firstScreenEventIdSwap } = data;
  const root = __root as BackgroundSnapshotInstance;
  const shouldLog = typeof __ALOG__ !== 'undefined' && __ALOG__;
  if (shouldLog) {
    tryDebugLog(() => `[ReactLynxDebug] Snapshot hydrate start root=${root.__id} payloadLength=${lepusSide.length}`);
  }

  let patchStreamLength: number | undefined;
  let patchDispatched = false;
  try {
    const started = typeof __PROFILE__ !== 'undefined' && __PROFILE__
      && tryStartDebugProfile('ReactLynx::hydrate');
    let snapshotPatch: ReturnType<typeof hydrate>;
    try {
      beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);
      markTiming('hydrateParseSnapshotStart');
      const before = JSON.parse(lepusSide) as SerializedSnapshotInstance;
      markTiming('hydrateParseSnapshotEnd');
      markTiming('diffVdomStart');
      snapshotPatch = hydrate(before, root);
      patchStreamLength = snapshotPatch.length;
    } finally {
      tryEndDebugProfile(started);
    }
    markTiming('diffVdomEnd');

    // TODO: It seems `delayedEvents` and `delayedLifecycleEvents` should be merged into one array to ensure the proper order of events.
    flushDelayedLifecycleEvents();
    if (delayedEvents) {
      delayedEvents.forEach((args) => {
        const [handlerName, data] = args;
        // eslint-disable-next-line prefer-const
        let [idStr, ...rest] = handlerName.split(':');
        while (firstScreenEventIdSwap[idStr!]) idStr = firstScreenEventIdSwap[idStr!]?.toString();
        try {
          publishEvent([idStr, ...rest].join(':'), data);
        } catch (e) {
          lynx.reportError(e as Error);
        }
      });
      delayedEvents.length = 0;
    }

    lynx.getApp().publishEvent = publishEvent;
    lynx.getApp().publicComponentEvent = publicComponentEvent;

    const commitTaskId = genCommitTaskId();
    const patchList: PatchList = {
      patchList: [{ snapshotPatch, id: commitTaskId }],
    };
    if (delayedRunOnMainThreadData.length) {
      patchList.delayedRunOnMainThreadData = takeDelayedRunOnMainThreadData();
    }
    const obj = commitPatchUpdate(patchList, { isHydration: true });
    sendMTRefInitValueToMainThread();
    lynx.getNativeApp().callLepusMethod(LifecycleConstant.patchUpdate, obj, () => {
      globalCommitTaskMap.forEach((commitTask, id) => {
        if (id > commitTaskId) {
          return;
        }
        commitTask();
        globalCommitTaskMap.delete(id);
      });
    });
    patchDispatched = true;
    runDelayedUiOps();

    if (processErr) {
      throw processErr;
    }
  } finally {
    if (shouldLog) {
      tryDebugLog(() =>
        `[ReactLynxDebug] Snapshot hydrate end root=${root.__id} result=${
          patchStreamLength === undefined ? 'failed' : 'completed'
        } patchDispatched=${patchDispatched} patchStreamLength=${patchStreamLength ?? 0}`
      );
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

function publishEvent(handlerName: string, data: EventDataType) {
  lynx.getApp().callBeforePublishEvent?.(data);
  let snapshotId: number | undefined;
  const getSnapshotId = () => snapshotId ??= Number(handlerName.split(':')[0]);
  const eventHandler = backgroundSnapshotInstanceManager.getValueBySign(
    handlerName,
  ) as ((data: unknown) => void) | undefined;

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    const currentSnapshotId = getSnapshotId();
    profileStart(`ReactLynx::publishEvent`, {
      args: {
        handlerName,
        type: data.type,
        snapshotType: backgroundSnapshotInstanceManager.values.get(
          currentSnapshotId,
        )?.type ?? '',
        source: getSnapshotVNodeSource(currentSnapshotId) ?? '',
        jsFunctionName: eventHandler?.name ?? '',
      },
    });
  }
  if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
    const currentSnapshotId = getSnapshotId();
    console.alog?.(
      `[ReactLynxDebug] BTS received event:\n` + JSON.stringify(
        {
          handlerName,
          type: data.type,
          snapshotType: backgroundSnapshotInstanceManager.values.get(
            currentSnapshotId,
          )?.type ?? '',
          jsFunctionName: eventHandler?.name ?? '',
        },
        null,
        2,
      ),
    );
  }

  if (eventHandler) {
    try {
      eventHandler(data);
    } catch (e) {
      lynx.reportError(e as Error);
    }
  }
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

function publicComponentEvent(_componentId: string, handlerName: string, data: EventDataType) {
  publishEvent(handlerName, data);
}

function delayedPublicComponentEvent(_componentId: string, handlerName: string, data: EventDataType) {
  delayedPublishEvent(handlerName, data);
}

function updateGlobalProps(newData: Record<string, any>): void {
  updateGlobalPropsCore(newData, {
    // Snapshot force render consumes any sync setState dirty flags produced by
    // onGlobalPropsChanged listeners, avoiding an extra diff pass.
    forceRerender: () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      runWithForce(() => render(__root.__jsx, __root as any));
    },
  });
}

export { injectTt, flushDelayedLifecycleEvents };
