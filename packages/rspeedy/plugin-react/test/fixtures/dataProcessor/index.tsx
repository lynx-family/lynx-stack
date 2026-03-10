import { root } from '@lynx-js/react'

const dataProcessors: Record<
  string,
  (rawData: Record<string, unknown>) => Record<string, unknown>
> = {
  a: (rawData: Record<string, unknown>) => {
    return {
      ...rawData,
      content: 'dataProcessor-a',
    }
  },
}

const dataProcessorB = (rawData: Record<string, unknown>) => {
  return {
    ...rawData,
    content: 'dataProcessor-b',
  }
}
dataProcessors.b = dataProcessorB

lynx.registerDataProcessors({
  defaultDataProcessor: (rawData) => {
    return {
      ...rawData,
      content: 'dataProcessor-default',
    }
  },
  dataProcessors,
})

const register = lynx.registerDataProcessors
register({
  dataProcessors: {
    b: dataProcessorB,
  },
})

root.render(<view />)
