import { Background } from '@lynx-js/react'
import { Skeleton } from './Skeleton.js'
export function Wrapper(
  { children }: { children?: JSX.Element },
): JSX.Element {
  return <Background fallback={<Skeleton />}>{children}</Background>
}
