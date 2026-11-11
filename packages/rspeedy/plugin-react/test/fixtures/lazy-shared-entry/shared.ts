import './shared.css'

const values: Record<string, string> = {}

export function describe(page: string): string {
  values[page] ??= ['shared', page].join(':')
  return values[page]
}

export function describeOnMainThread(page: string): string {
  'main thread'
  return ['shared', page].join(':')
}
