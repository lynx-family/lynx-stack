import { describe, it, expect } from 'vitest'
import { pluginVueLynx } from '@lynx-js/rspeedy-plugin-vue'

describe('pluginVueLynx', () => {
  it('should return a plugin with the correct name', () => {
    const plugin = pluginVueLynx()
    expect(plugin.name).toBe('rspeedy:plugin-vue')
  })

  it('should apply default options when no options are provided', () => {
    const plugin = pluginVueLynx()
    expect(plugin).toBeDefined()
  })

  it('should accept custom options', () => {
    const plugin = pluginVueLynx({
      debugInfoOutside: false,
      enableCSSInheritance: true,
      customCSSInheritanceList: ['color', 'font-size'],
    })
    expect(plugin).toBeDefined()
  })
})
