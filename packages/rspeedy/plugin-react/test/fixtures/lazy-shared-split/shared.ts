const values: Record<string, string> = {}

export function describe(page: string): string {
  values[page] ??= ['shared', page].join(':')
  return values[page]
}
