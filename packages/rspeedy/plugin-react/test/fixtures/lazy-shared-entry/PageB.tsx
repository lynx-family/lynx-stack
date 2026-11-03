import { describe, describeOnMainThread } from './shared.js'

function onTap() {
  'main thread'
  console.info(describeOnMainThread('PageB-main-thread'))
}

export default function PageB() {
  return <text main-thread:bindtap={onTap}>{describe('PageB')}</text>
}
