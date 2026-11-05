const values: Record<string, string> = {}

export function describe(page: string): string {
  values[page] ??= ['SHARED_MODULE_BODY', page].join(':')
  return values[page]
}

export function describeOnMainThread(page: string): string {
  'main thread'
  return ['SHARED_MAIN_THREAD', page].join(':')
}
