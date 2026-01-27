// Import using relative path going up one directory
const FooPromise = import('../Foo.jsx');

export async function loadFooFromSubdir() {
  const { Foo } = await FooPromise;
  return Foo();
}
