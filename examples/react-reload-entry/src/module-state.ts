const scope = globalThis as unknown as Record<string, number | undefined>;
const key = __MAIN_THREAD__
  ? '__MT_ENTRY_EVAL_COUNT__'
  : '__BTS_ENTRY_EVAL_COUNT__';

scope[key] = (scope[key] ?? 0) + 1;

export const entryEvalCount: number = scope[key]!;

export const moduleScopedValue: { current: number } = { current: 0 };
