import CompBackground from './CompBackground.js'
import CompMain from './CompMain.js'

export default function LazyBundleComp() {
  return (
    <view>
      <text>Hello from lazy bundle!</text>
      {__MAIN_THREAD__ ? <CompMain /> : <CompBackground />}
    </view>
  )
}
