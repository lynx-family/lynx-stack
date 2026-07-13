const enum Foo {
  bar = 0,
  baz = 1,
}

export default {
  source: {
    define: { bar: Foo.bar, baz: Foo.baz },
    entry: 'custom-const-enum',
  },
}
