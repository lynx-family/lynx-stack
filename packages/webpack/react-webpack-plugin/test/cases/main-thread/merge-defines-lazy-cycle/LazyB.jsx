export function LazyB() {
  return <view />;
}

export const loadA = () => import('./LazyA.jsx');
