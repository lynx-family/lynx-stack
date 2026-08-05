import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-core/client';
import './style.css';

document.body.innerHTML = `
  <main class="showcase-shell">
    <section class="showcase-copy">
      <div class="eyebrow">LLM-GENERATED · ZERO BUILD</div>
      <h1>无需编译，<br />LLM 生成即运行。</h1>
      <p>
        LLM 直接产出由 <code>&lt;style&gt;</code>、
        <code>&lt;script main-thread&gt;</code> 和
        <code>&lt;script background&gt;</code> 组成的
        <code>hangzhou-trip.xml</code>，Lynx Web Runtime 会在加载时直接解析并运行。
      </p>
      <div class="format-row">
        <span>LLM</span>
        <span class="format-arrow">→</span>
        <span>.xml</span>
        <span class="format-arrow">→</span>
        <span>Web Runtime</span>
      </div>
    </section>
    <section class="device-stage" aria-label="杭州 5 天旅行卡预览">
      <div class="device-glow"></div>
      <div class="device-frame">
        <div class="device-status" aria-hidden="true">
          <span>9:41</span>
          <span class="device-island"></span>
          <span>5G&nbsp;&nbsp;●</span>
        </div>
        <lynx-view id="trip-card" url="/hangzhou-trip.xml"></lynx-view>
      </div>
    </section>
  </main>
`;

const tripCard = document.querySelector<HTMLElement>('#trip-card');

tripCard?.addEventListener('error', (event) => {
  console.error('Failed to load the Lynx markup example.', event);
});
