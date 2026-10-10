import { describe } from './shared.js'

export default function PageB() {
  const onTap = () => {
    'main thread'
    console.info(describe('PageB-main-thread'))
  }

  return <text main-thread:bindtap={onTap}>{describe('PageB')}</text>
}
