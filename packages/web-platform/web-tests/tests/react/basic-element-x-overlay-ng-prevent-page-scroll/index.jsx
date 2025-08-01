import { root, useState } from '@lynx-js/react';
import './index.css';

function OverlayContent({ id, onClose, onOpenNested }) {
  return (
    <view class='overlay-container'>
      <view class='overlay-header'>
        <text class='overlay-title'>Overlay {id}</text>
      </view>
      <view class='overlay-content'>
        <text>点击下方按钮测试滚动锁定逻辑</text>
        {id === 1 && (
          <view class='button' catchtap={onOpenNested} id='openOverlay2'>
            <text class='button-text'>打开嵌套Overlay</text>
          </view>
        )}
        <view class='button' catchtap={onClose} id={`closeOverlay${id}`}>
          <text class='button-text'>关闭Overlay {id}</text>
        </view>
      </view>
    </view>
  );
}

function App() {
  const [showOverlay1, setShowOverlay1] = useState(false);
  const [showOverlay2, setShowOverlay2] = useState(false);
  const [logs, setLogs] = useState([]);

  const logAction = (action) => {
    setLogs([...logs, `[${new Date().toLocaleTimeString()}] ${action}`]);
  };

  const toggleOverlay1 = () => {
    setShowOverlay1(!showOverlay1);
    logAction(showOverlay1 ? '关闭Overlay 1' : '打开Overlay 1');
  };

  const toggleOverlay2 = () => {
    setShowOverlay2(!showOverlay2);
    logAction(showOverlay2 ? '关闭Overlay 2' : '打开Overlay 2');
  };

  return (
    <scroll-view scroll-y class='test-card'>
      <text class='title'>XOverlayNg 禁止滚动测试</text>
      <view class='box'>
        <text class='desc'>
          测试嵌套弹层场景下的页面滚动锁定逻辑，当前滚动状态将在控制台显示
        </text>
        <view class='button' catchtap={toggleOverlay1} id='toggleOverlay1'>
          {showOverlay1
            ? <text class='button-text'>关闭Overlay 1</text>
            : <text class='button-text'>显示Overlay 1</text>}
        </view>
      </view>

      <text class='h1'>操作日志</text>
      <view class='log-container'>
        {logs.slice(-5).map((log, index) => (
          <text class='log-item' key={index}>{log}</text>
        ))}
      </view>

      {/* 第一层弹层 */}
      <x-overlay-ng
        id='overlay1'
        visible={showOverlay1}
        custom-layout
        status-bar-translucent
        class='dialog-overlay'
        events-pass-through={false}
      >
        <OverlayContent
          id={1}
          onClose={toggleOverlay1}
          onOpenNested={toggleOverlay2}
        />
      </x-overlay-ng>

      {/* 第二层弹层 */}
      <x-overlay-ng
        id='overlay2'
        visible={showOverlay2}
        custom-layout
        status-bar-translucent
        class='dialog-overlay'
        events-pass-through={false}
      >
        <OverlayContent id={2} onClose={toggleOverlay2} />
      </x-overlay-ng>
    </scroll-view>
  );
}

root.render(<App />);
