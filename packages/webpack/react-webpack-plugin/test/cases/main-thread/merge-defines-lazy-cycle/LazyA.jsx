export function LazyA() {
  return <view />;
}

export const loadB = () => import('./LazyB.jsx');
