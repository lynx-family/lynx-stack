const traceStateKey = Symbol.for('__REACT_LYNX_RELOAD_LAB_PAPI_TRACE__');
const interceptorInstalledKey = Symbol.for(
  '__REACT_LYNX_RELOAD_LAB_PAPI_INTERCEPTOR__',
);

const elementPapiNames = [
  '__CreatePage',
  '__CreateElement',
  '__CreateWrapperElement',
  '__CreateText',
  '__CreateImage',
  '__CreateView',
  '__CreateRawText',
  '__CreateList',
  '__AppendElement',
  '__InsertElementBefore',
  '__RemoveElement',
  '__ReplaceElement',
  '__FirstElement',
  '__LastElement',
  '__NextElement',
  '__GetPageElement',
  '__GetTemplateParts',
  '__AddDataset',
  '__SetDataset',
  '__GetDataset',
  '__SetAttribute',
  '__GetAttributes',
  '__GetAttributeByName',
  '__GetAttributeNames',
  '__SetClasses',
  '__SetCSSId',
  '__AddInlineStyle',
  '__SetInlineStyles',
  '__AddEvent',
  '__SetID',
  '__GetElementUniqueID',
  '__GetTag',
  '__FlushElementTree',
  '__UpdateListCallbacks',
  '__OnLifecycleEvent',
  '__QueryComponent',
  '__SetGestureDetector',
  '__RemoveGestureDetector',
] as const;

const createElementPapiNames = new Set<string>([
  '__CreatePage',
  '__CreateElement',
  '__CreateWrapperElement',
  '__CreateText',
  '__CreateImage',
  '__CreateView',
  '__CreateRawText',
  '__CreateList',
]);

export interface ElementPapiTraceState {
  reloadId: number;
  recording: boolean;
  calls: string[];
  droppedCalls: number;
  previousReloads: ElementPapiTraceCycle[];
  elementLabels: WeakMap<object, string>;
}

export interface ElementPapiTraceCycle {
  reloadId: number;
  calls: string[];
  droppedCalls: number;
}

export interface ElementPapiTraceSnapshot extends ElementPapiTraceCycle {
  previousReloads: ElementPapiTraceCycle[];
}

function getTraceState(): ElementPapiTraceState {
  const lynxSymbols = lynx as unknown as Record<symbol, unknown>;
  let state = lynxSymbols[traceStateKey] as ElementPapiTraceState | undefined;
  if (!state) {
    state = {
      reloadId: 0,
      recording: false,
      calls: [],
      droppedCalls: 0,
      previousReloads: [],
      elementLabels: new WeakMap(),
    };
    lynxSymbols[traceStateKey] = state;
  }
  state.previousReloads ??= [];
  return state;
}

function formatValue(value: unknown, state: ElementPapiTraceState): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => formatValue(item, state)).join(', ')}]`;
  }
  if (typeof value === 'function') {
    return `[Function${value.name ? ` ${value.name}` : ''}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const elementLabel = state.elementLabels.get(value);
    if (elementLabel) return elementLabel;
    try {
      return JSON.stringify(value) ?? '[Object]';
    } catch {
      return '[Object]';
    }
  }
  return JSON.stringify(value) ?? String(value);
}

function formatElementResult(
  result: unknown,
  state: ElementPapiTraceState,
  getTag: ((element: unknown) => unknown) | undefined,
  getUniqueId: ((element: unknown) => unknown) | undefined,
): string {
  if (typeof result === 'object' && result !== null) {
    const previousLabel = state.elementLabels.get(result);
    if (previousLabel) return previousLabel;
    if (getTag && getUniqueId) {
      try {
        const tag = getTag(result);
        const uniqueId = getUniqueId(result);
        const label = `${String(tag)}#${String(uniqueId)}`;
        state.elementLabels.set(result, label);
        return label;
      } catch {
        // Keep the raw result below if this PAPI result is not a FiberElement.
      }
    }
  }
  return formatValue(result, state);
}

/** Install one interceptor per main-thread global. The trace state lives on Lynx and survives entry re-evaluation. */
export function installElementPapiInterceptor(): void {
  const target = globalThis as unknown as Record<string | symbol, unknown>;
  if (target[interceptorInstalledKey] === true) return;

  const state = getTraceState();
  const getTag = target['__GetTag'];
  const getUniqueId = target['__GetElementUniqueID'];
  const getTagFn = typeof getTag === 'function'
    ? getTag as (element: unknown) => unknown
    : undefined;
  const getUniqueIdFn = typeof getUniqueId === 'function'
    ? getUniqueId as (element: unknown) => unknown
    : undefined;

  for (const apiName of elementPapiNames) {
    const original = target[apiName];
    if (typeof original !== 'function') continue;

    const originalPapi = original as (...args: unknown[]) => unknown;
    target[apiName] = function(this: unknown, ...args: unknown[]): unknown {
      let result: unknown;
      try {
        result = originalPapi.apply(this, args);
      } catch (error) {
        if (state.recording) {
          state.calls.push(
            `${apiName}(${
              args.map(arg => formatValue(arg, state)).join(', ')
            }) threw ${formatValue(error, state)}`,
          );
        }
        throw error;
      }

      if (createElementPapiNames.has(apiName)) {
        formatElementResult(result, state, getTagFn, getUniqueIdFn);
      }
      if (state.recording) {
        if (state.calls.length < 160) {
          const formattedArgs = args.map(arg => formatValue(arg, state)).join(
            ', ',
          );
          const formattedResult = createElementPapiNames.has(apiName)
            ? formatElementResult(result, state, getTagFn, getUniqueIdFn)
            : undefined;
          state.calls.push(
            `${apiName}(${formattedArgs})${
              formattedResult ? ` => ${formattedResult}` : ''
            }`,
          );
        } else {
          state.droppedCalls += 1;
        }
      }
      return result;
    };
  }

  target[interceptorInstalledKey] = true;
}

export function beginElementPapiCapture(): void {
  'main thread';
  const state =
    (lynx as unknown as Record<symbol, ElementPapiTraceState | undefined>)[
      Symbol.for('__REACT_LYNX_RELOAD_LAB_PAPI_TRACE__')
    ];
  if (!state) return;
  state.previousReloads ??= [];
  if (state.reloadId > 0 && state.calls.length > 0) {
    state.previousReloads.push({
      reloadId: state.reloadId,
      calls: state.calls.slice(),
      droppedCalls: state.droppedCalls,
    });
    if (state.previousReloads.length > 3) {
      state.previousReloads.shift();
    }
  }
  state.reloadId += 1;
  state.recording = true;
  state.calls = [];
  state.droppedCalls = 0;
}

export function readElementPapiCapture(): ElementPapiTraceSnapshot {
  'main thread';
  const state =
    (lynx as unknown as Record<symbol, ElementPapiTraceState | undefined>)[
      Symbol.for('__REACT_LYNX_RELOAD_LAB_PAPI_TRACE__')
    ];
  if (!state) {
    return { reloadId: 0, calls: [], droppedCalls: 0, previousReloads: [] };
  }
  state.recording = false;
  return {
    reloadId: state.reloadId,
    calls: state.calls.slice(),
    droppedCalls: state.droppedCalls,
    previousReloads: state.previousReloads.map(reload => ({
      ...reload,
      calls: reload.calls.slice(),
    })),
  };
}
