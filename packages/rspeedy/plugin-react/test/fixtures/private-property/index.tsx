// Test case for private property transpilation
class DemoClass {
  #privateProperty: string

  constructor() {
    this.#privateProperty = 'This is private'
  }

  getPrivate(): string {
    return this.#privateProperty
  }

  setPrivate(value: string): void {
    this.#privateProperty = value
  }
}

export function TestComponent() {
  const demo = new DemoClass()
  // Test private property access
  demo.getPrivate()
  demo.setPrivate('Updated value')
  demo.getPrivate()

  return (
    <view>
      <text>Private Property Test</text>
    </view>
  )
}
