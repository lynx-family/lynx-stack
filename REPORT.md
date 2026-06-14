# Lynx DOM Shim — Phase 1 全程报告

> **范围：** 从对 RFC「LLM 直出 Lynx 原生产物」的初次 review，到 DOM Shim 设计提案，到 Phase 1 benchmark 实现，到首次拿到真实 LLM 数据。
> **日期：** 2026-06-14
> **作者：** 黄玄（huxpro）
> **分支：** `Huxpro/lynx-dom-shim-benchmark`（16 commits ahead of `origin/main`）
> **代码位置：** `~/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark/packages/dom-shim/`

---

## TL;DR

1. **原 RFC** 提议让 LLM 直接调用 Lynx 内部 `__XXX` Element PAPI 写代码，但其 motivation 用「LLM 训练语料里 HTML/CSS/JS 多」论证，这两端实际上是矛盾的——`__CreateView()` 不在 LLM 训练语料里。
2. **我提出的替代方案：** 在 Element PAPI 之上做一层**分级 DOM Shim**（参考 React Native `ReadOnlyNode`/`ReadOnlyElement` 的分级模型，但延伸到 write side）。
3. **Phase 1 实现：** 不直接做 Shim，而是先做一个 **benchmark** 用真实 LLM 数据决定该不该做。9 个 user story 全部代码完成，3 条 route runner（raw PAPI / DOM Shim / A2UI JSON）都接上 LLM 实跑了。
4. **目前真实数据（n=10, gpt-4o, 7 moderate + 3 complex prompts）：** **三条路线在 correctness 上没有显著差异**（A=B=100%, C=80% one-shot；N=3 self-repair 后三条都 100%）。RFC 的「HTML 直出更准」假设在这批数据上**不成立**。
5. **结论暂时不足以驱动 RFC 决策。** n 太小、单模型、M4 视觉相似度还没接 puppeteer、prompt token 成本还没算。但目前数据反而**弱化了我自己提案的 correctness 论据**，强化了 RFC 现状（保留 raw PAPI）。Shim 的其他论据（web library 互操作、token 成本、心智模型）这批数据没碰。

---

## 一、起点：对原 RFC 的 review

原文档：[【RFC】LLM 直出 Lynx 原生产物](https://bytedance.larkoffice.com/wiki/HXJBwkT4uikoPEk0sQucaHvdnHh)

**RFC 的论点：** 让 LLM 直接输出对 Lynx 引擎底层 PAPI（`__CreatePage` / `__CreateView` / `__SetAttribute` / `__AppendElement` / `__FlushElementTree` 等约 80 个全局函数）的调用代码，跳过 JSX / Template 编译和 Bundler 链路，"生成即产物，产物即运行"。

**RFC 的 motivation：** "LLM 训练语料中 HTML/CSS/JS 占比极大，生成正确率高 → 浏览器作为运行时无需构建 → 中间抽象层引入翻译损耗，降低 AI 生成稳定性"。所以应该让 Lynx 像浏览器一样接 LLM 直出产物。

**我的批判：** Motivation 和 detailed design 不一致。

- Motivation 论证的是「**HTML/CSS/JS 占语料多**」
- Detailed design 让 LLM 写的却是「**`__CreatePage(parentComponentUniId, info)` + `__SetClasses(node, 'foo bar')` 这种私有命令式 PAPI**」
- 私有 `__XXX` PAPI **不在** LLM 训练语料里。Motivation 想吃的红利和 design 选择的形态根本不在一条线上。

具体的 review 意见包括：

- 「真·HTML 直出」需要支持 `<view>` 标签声明式语法 + innerHTML 解析
- Motivation 应该 commit 一个数据 baseline，否则争论流于直觉
- API 命名约定 `__XXX` 内部 PAPI 升格成对外接口的代价（SLA、breaking change、命名 convention）被低估了

---

## 二、提出的替代方案：分级 DOM Shim

参考 React Native [`ReadOnlyNode` / `ReadOnlyElement` / `ReactNativeElement`](https://reactnative.dev/docs/nodes) 的分级思路，但走得更远。

**5 层 tier 模型：**

```
ReadOnlyNode             ← 树结构纯读 (parentNode, childNodes, firstChild...)
  ↑
ReadOnlyElement          ← + 属性读 + classList 读 + getBoundingClientRect + querySelector
  ↑
SafeWritableElement      ← + setAttribute / classList.add/remove / style.X = v / appendChild
  ↑
SafeWriteOnlyElement     ← + addEventListener (写 safe，cleanup 需 Shim 维护字典)
  ↑
UnsafeWritableElement    ← + innerHTML / outerHTML / cssText (语义有坑，明文 caveat)
  ↑
Unsupported              ← Shadow DOM / customElements / cookie / location (throw)
```

每一级有**明确的语义不变式**：

- L1 ReadOnly: 调用不改变树
- L2 SafeWrite: 调用是 atomic mutation，读后立即可见
- L3 SafeWriteOnly (events): 写 safe，cleanup 有 caveat
- L4 UnsafeWrite: 跑得起来但语义偏移（innerHTML 不执行 inline script、不 fire load 事件等）
- L5 Unsupported: 立即 throw，带 source position + suggested alternative

**与 RN 的差异：** RN 只做 ReadOnly + 写 side 的 narrow refs。Lynx Element PAPI 实际上有更全的 write surface（attribute / class / style / event / tree mutation 都齐），所以可以走到 L4。

**关键设计决策（在 Phase 2 解决）：**

- 线程模型：main-thread-only / dual-thread two-signature / mixed
- Flush 策略：auto-flush on microtask / 显式 `lynx.dom.flush()`
- HTML parser 选型：手写 10KB / htmlparser2 30KB / parse5 90KB
- 默认 type 严格度：宽松（默认 UnsafeWritableElement）/ 严格（默认 SafeWritableElement）

---

## 三、Phase 1 的选择：先做 benchmark，不做 Shim

**核心问题：** 上面这套 Shim 设计要不要做？决定取决于一个经验性数据——「在同一个 UI 需求上，LLM 用哪种输出格式生成正确率更高」。

**Phase 1 的明确目标**（PRD §2）：

> 产出一组硬数据，对比 3 条 LLM-输出路线在 4 个指标上的表现，让路径选择由数据驱动而非直觉。如果数据**不支持** Shim 路径，Phase 1 deliverable 就是数据本身，项目终结。

**3 条路线：**

| ID    | 路线           | LLM 系统提示词内容                                                                                                                                                       |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | 原生 PAPI 直出 | 嵌入完整 476 行 `@lynx-js/type-element-api@0.0.8` `.d.ts`，要求 LLM 写 `function render(rootPageRef)` 用 `__CreateXxx`、`__SetAttribute` 等                              |
| **B** | DOM Shim 直出  | 描述 Web-like DOM API（`document.createElement('view')`, `appendChild`, `setAttribute`, `addEventListener`, `style.X = v`, `innerHTML = '...'`），要求结尾 `__flush__()` |
| **C** | A2UI JSON 直出 | JSON Schema 描述的 ElementNode/TextNode 树结构                                                                                                                           |

**4 个指标**（详见 `packages/dom-shim/benchmarks/RUBRIC.md`）：

- **M1 — One-shot parse rate:** 首次生成的产物能不能解析
- **M2 — One-shot render rate:** 首次生成的产物能不能驱动 mock runtime 产出非空元素树
- **M3 — N=3 convergence rate:** 在 3 轮 self-repair（把上一轮错误日志喂回去）内能不能渲染对
- **M4 — Visual similarity to intent:** 渲染产物截图与 prompt 描述的语义相似度（vision LLM 评分，0-1）

---

## 四、Phase 1 实现：9 个 user story 全部代码完成

**US-101 ~ US-109 commit 列表：**

```
a5be7fc8 fix(dom-shim): Phase 1.5 patches + n=10 spot check findings
bb6f4f0b feat(dom-shim): wire OpenAI provider + live smoke run (n=2)
40b33f3e feat(dom-shim): US-109 — generate Phase 1 comparison report + smoke
907a80af feat(dom-shim): US-108 — implement visual similarity scoring
e0b1c0ee feat(dom-shim): US-107 — implement Route C A2UI JSON runner
f3f74fd0 feat(dom-shim): US-106 — implement Route B DOM Shim mock runner
5d1d8b46 feat(dom-shim): US-105 — implement Route A raw PAPI runner
b7fedd63 feat(dom-shim): US-104 — build benchmark harness CLI
6cc99902 feat(dom-shim): US-103 — define benchmark scoring rubric and result schema
d7f7cdf5 feat(dom-shim): US-102 — curate 50-prompt LLM-DOM corpus
68151a91 feat(dom-shim): US-101 — set up workspace package skeleton
e7ee611d docs(dom-shim): add Phase 1 benchmark PRD
```

**关键架构组件：**

```
packages/dom-shim/
├── benchmarks/
│   ├── corpus/prompts.json              # 50 个手写 prompt，覆盖 7 个 category × 4 个 complexity
│   ├── RUBRIC.md                         # 4 个指标定义
│   ├── schema/result.schema.json         # ajv-validated 报告 schema
│   ├── cli.ts                            # parseArgs 风格 CLI (--routes/--prompts/--rounds/--model/--out/--dry-run)
│   └── src/
│       ├── harness.ts                    # 并发 worker + 顺序 round + 重试 + JSONL 流式 + Markdown 渲染
│       ├── types.ts                      # Route, RouteContext, BenchmarkRecord, BenchmarkReport
│       ├── llm/anthropic-client.ts       # 多 provider 客户端（OpenAI + Anthropic auto-detect）
│       ├── mocks/
│       │   ├── mock-papi.ts              # ~30 个 __XXX 函数，记录 call sequence，导出 preview HTML
│       │   └── mock-shim.ts              # DOM-like facade，包 mock-papi
│       ├── routes/
│       │   ├── route-a-papi.ts           # Anthropic/OpenAI → TS → ts.transpileModule → vm
│       │   ├── route-b-shim.ts           # → HTML+JS → vm with mock Shim globals
│       │   ├── route-c-a2ui.ts           # → JSON → ajv schema → walker → mock PAPI
│       │   └── element-papi-reference.d.ts.txt   # 476 行嵌入式 d.ts
│       ├── scoring/visual.ts             # 跨 provider vision LLM scorer，soft no-op 无 key 时
│       └── utils/retry.ts                # 3x exponential backoff
├── SMOKE_TEST_README.md                  # 烟雾测试运行手册
├── SMOKE_TEST_DRY_RUN.{md,json}          # 不调真 LLM 的 self-test artifacts
├── SMOKE_TEST_LIVE.{md,json}             # 真 LLM 调用的 smoke artifacts (n=2)
├── SPOT_CHECK_HARD_N10.{md,json}         # n=10 hard subset
└── SPOT_CHECK_FINDINGS.md                # 数据 + surprises 详细分析
```

**值得说一下的工程决策：**

1. **CLI 用 Node 22+ 的 `--experimental-strip-types` 直接跑 `.ts`，不走 webpack/rspack**。Phase 1 mock 产物是丢弃式的，没必要走完整 build pipeline。
2. **多 provider client 名字保留为 `anthropic-client.ts` 避免改所有 route 的 import**，但内部按 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` env 自动切换。包 `gpt-4o`/`claude-opus-4-7` 模型名做了 cross-vendor normalize。
3. **Route A 的 sandbox 必须用 `ts.transpileModule` 而不是直接 `vm.runInNewContext`**。LLM 写的是带类型注解的 TS，vm 是纯 JS。第一次 live smoke 看到 A=0/2 都被这个 bug 掩盖了。
4. **CSS-style preview 渲染走 `view → div, text → span, image → img`** 静态映射，是 Puppeteer 截图的中间产物（puppeteer 还没接，所以 screenshot_path 现在是 HTML 文件，visual scorer 会优雅跳过）。
5. **过程踩了一堆 monorepo 工具坑**：node 版本（必须 v22）、`n/file-extension-in-import` 把 `.ts` 改成 `.js` 破坏 strip-types 解析（需 per-package eslint override）、biome 禁 `console.log` 改 `console.info`、企业网络 SealSuite TLS 拦截需要把 macOS Keychain 的 root CA 导出加入 `NODE_EXTRA_CA_CERTS`。这些坑都写进 `scripts/ralph-benchmark/progress.txt`。

---

## 五、实际跑出来的数据

### 5.1 Dry-run smoke（harness self-test）

```bash
pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A,B,C --prompts P001,P002 --rounds 1
```

6 条记录，全部 1.000——因为 stub route 直接返回 canned green。这验证的是 harness 自身的代码路径（IO、并发、聚合、报告渲染），**不是** benchmark 数据。

### 5.2 First live smoke (n=2, gpt-4o)

```
Route A (raw PAPI):  render 0/2   ← "Unexpected token ':'" 错误
Route B (DOM Shim):  render 1/2   ← 一次 LLM 忘了调 __flush__()
Route C (A2UI JSON): render 2/2   ← gpt-4o 写 JSON 很稳
```

**初读结论：「C 是赢家」——错的。** 两个原因：

- Route A 的 0/2 是 sandbox bug：我的 vm 不 transpile TS，gpt-4o 写 `function render(x: PageElementRef): void` 立刻死。
- n=2 没有统计意义。

### 5.3 Second n=10 (easy subset, gpt-4o)

10 个 prompt：8 trivial + 2 simple。**所有路线 30/30 全绿。** 因为 prompt 太容易，所有路线饱和，benchmark 失去区分度。

这次发现了 sandbox bug 的修复方向（`ts.transpileModule` 但要先剥 `export`，否则 transpile 会注入 `exports.X = X` 触发 "exports is not defined"）。

### 5.4 Third n=10 (hard subset, gpt-4o) — **这次是真数据**

10 个 prompt：7 moderate + 3 complex，覆盖全部 7 个 category。

```
Route          | parse_ok | render_ok (one-shot) | convergence (N=3)
A (raw PAPI)   | 1.000    | 1.000                | 1.000
B (DOM Shim)   | 1.000    | 1.000                | 1.000
C (A2UI JSON)  | 0.800    | 0.800                | 1.000
```

Route C 的 2 个 first-round 失败：

- 1 次用了 schema enum 里没有的 `tag` 值
- 1 次加了 `additionalProperties` 不允许的字段

两次都在 round 2 / round 3 自修复了。

---

## 六、Surprises（这是 Phase 1 最有价值的产出）

### Surprise 1：RFC 的核心 motivation 在这批数据上不成立

RFC 论证「LLM 训练语料里 HTML/CSS/JS 多 → 直出 HTML 更准」。隐含预测：**Route A（私有 PAPI）应该输给 Route B（DOM 风格）**。

实际：**A=B=100%**。只要把 d.ts 塞进 system prompt，gpt-4o 写 `__CreateView()` 跟写 `document.createElement('view')` 一样准。「训练语料」红利**看不见**。

### Surprise 2：Schema-constrained JSON 是最弱的 one-shot

我原本以为 A2UI 的结构化 JSON 最受 LLM 喜欢（清晰、机器可读）。**实际相反**——schema 约束反而是负担，LLM 容易违反 enum 或加额外字段。Free-form JS 反而稳。

### Surprise 3：N=3 self-repair 把所有差异抹平

三条路线在 3 轮 error feedback 后全部到 1.000。这意味着：

- **one-shot rate** 才是有区分度的指标；convergence rate 在这种 complexity 下饱和
- 或者倒过来说：如果 production 永远跑 N=3 agent loop，路线选择对最终结果**几乎无影响**。差异主要在 token 成本和 latency。

### Surprise 4（方法论）：Benchmark bug 会伪装成 LLM 失败

n=2 和第一轮 n=10 都报 Route A=0%，**两次都是我的 vm 沙盒没 transpile TS**。修了之后 A 从 0% 跳到 100%。

教训：**任何路线统一在某个错误模式上 0%——先怀疑 harness，不要先怀疑 LLM。**

### Surprise 5：早期 n=2 的「C 是赢家」是 overfit garbage

n=2 那次结论「C=2/2, A=0/2 → C 是路线领先者」**两端都错**：A 是 sandbox bug 掩盖，C 用 n=10 重测反而是最弱的 one-shot。**小样本结论比没结论更危险**，因为它给人虚假的方向感。

---

## 七、这能给原 RFC 一个决策吗？

**不能直接给，但能 reframe 问题。**

### 7.1 如果 RFC 的唯一论据是「LLM 直出准确率」

**这批数据支持 RFC 现状（保留 raw PAPI），不支持我提议的 DOM Shim。**

- A=B=100% on hard prompts → DOM Shim 没带来 correctness gain
- C<A&B → A2UI 路线本来也不在 RFC 当前方案里

### 7.2 但 Shim 还有其他论据，这批数据没碰

| Shim 论据                 | 这批数据能不能说                                                                                   | 评估                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 「LLM 写得对」            | ✅ 能说，且**与 Shim 无关**——RFC 现状就 OK                                                         | 不利于 Shim                                     |
| 「LLM prompt token 成本」 | ⚠️ **能算，但还没算**——Route A 每次都要塞 476 行 d.ts，Route B 不用。`tokens_used` 已经在每条记录里 | **最该挖的下一个数据**                          |
| 「Web library 互操作」    | ❌ 不能说——这批 benchmark 不测 import `react-virtual` 之类的库                                     | Shim 在这维度有独占价值，但需要另一套测试       |
| 「Render 视觉相似度」     | ❌ 不能说——M4 没接 puppeteer                                                                       | render_ok=100% 可能掩盖 「LLM 渲染了个错的 UI」 |
| 「mock 太宽松」           | ⚠️ 存疑——真 Lynx engine 会拒绝未知 tag，可能让 A/B 也产生 Route C 那种 schema-violation 错误        | 需要紧 mock                                     |

### 7.3 Phase 1 的诚实结论

> **Phase 1 不足以驱动 RFC 决策。** 它做到了：(a) 让 3 条路线在统一框架下可对比，(b) 揭示了 RFC motivation 在 correctness 维度上不像最初设想的那样有显著效应。但要真正回答 "Shim 该不该建"，需要补上 token cost、M4 视觉相似度、和多模型对照。
>
> **更关键的发现是方法论层面的：** 一次小样本（n=2）读出来的结论可以错得离谱（包括我自己之前的「Route C 是最佳」)。Benchmark bug 会伪装成 LLM 信号。任何一次跑出来的数字都要追问 "harness 是不是在测自己"。

---

## 八、推荐的下一步（按 ROI）

| # | 行动                                                                                    | 投入                        | 价值                                                                                                                                |
| - | --------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **算 token 成本 delta 加进 summary 表**                                                 | 30 分钟，$0                 | **最高**。可能 Shim 的真正卖点不是 correctness 而是 prompt 成本（A 要塞 476 行 d.ts）。这批数据**已经包含**所有所需信息，只是没聚合 |
| 2 | **接 puppeteer 把 HTML preview 渲染成 PNG → 接 visual scorer**                          | 2-3 小时，~$5 跑回一次 n=10 | 高。M4 视觉相似度是「render 对了没」的唯一信号。render_ok=100% 可能掩盖很多错                                                       |
| 3 | **紧 mock PAPI：拒绝未知 tag**                                                          | 1 小时                      | 中。让 A/B 在公平规则下被衡量，对齐 Route C 已有的 schema 严格度                                                                    |
| 4 | **跑 n=50 全集 + 多模型对照（gpt-4o + claude-opus-4-7）**                               | ~$30，1 小时                | 中。在 #1 #2 都做完之前跑全集只是放大现有信号噪声比                                                                                 |
| 5 | **Web library 互操作单独 benchmark**（react-virtual / focus-trap / popper.js 各跑一遍） | 2-3 天                      | 高，但和 LLM-output 比较是正交维度，可拆出 Phase 1.5 单独立项                                                                       |

**短期最有价值：先做 #1 + #2，再决定要不要跑 #4 全集。**

---

## 九、Phase 2+ 展望（暂存为参考）

如果 Phase 1 数据最终支持继续建 Shim，下一步规划：

- **Phase 2** — Tier specification：把 5 层 type 类层级定下来，把 3 个 open question（threading / flush / parser）拍板
- **Phase 3** — Element PAPI gap 补丁：`__PrevElement`、`__RemoveAttribute`、`__RemoveClass`、`__RemoveEvent`、`__RemoveInlineStyle`、`__GetInlineStyleByName`、main-thread sync `boundingClientRect`
- **Phase 4** — Shim 实现：L1 ReadOnly（1-2 周）→ L2 SafeWrite（2-3 周，TodoMVC vanilla 跑通作为 exit）→ L3 UnsafeWrite + HTML parser（3-4 周，≥70% v0/Artifacts 真实样本跑通）→ L4 Unsupported throw
- **Phase 5** — Conformance：WPT subset cherry-pick + 100-prompt agent-loop benchmark + 公开 baseline.json + dashboard
- **Phase 6** — Diagnostic protocol：结构化 JSON 错误返回给 LLM agent loop

详见 `PRD.md` §4。

---

## 十、附录：所有 artifact 位置

**仓库：** https://github.com/lynx-family/lynx-stack
**分支：** `Huxpro/lynx-dom-shim-benchmark`
**Worktree：** `/Users/bytedance/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark/`

**关键文档：**

| 文件                                                     | 内容                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PRD.md`                                                 | 6-phase Project Requirements Document，含 Phase 1 全部 9 个 user story |
| `REPORT.md`                                              | **本文档**                                                             |
| `scripts/ralph-benchmark/progress.txt`                   | Ralph 自治 agent 运行日志 + 工具坑记录                                 |
| `packages/dom-shim/SMOKE_TEST_README.md`                 | 烟雾测试运行手册                                                       |
| `packages/dom-shim/SMOKE_TEST_DRY_RUN.{md,json}`         | Dry-run 自测产物                                                       |
| `packages/dom-shim/SMOKE_TEST_LIVE.{md,json}`            | 首次 live smoke (n=2)                                                  |
| `packages/dom-shim/SPOT_CHECK_HARD_N10.{md,json}`        | Hard n=10 spot check 数据                                              |
| `packages/dom-shim/SPOT_CHECK_FINDINGS.md`               | n=10 数据 + surprises 详细分析                                         |
| `packages/dom-shim/benchmarks/RUBRIC.md`                 | 4 个 metric 的精确定义                                                 |
| `packages/dom-shim/benchmarks/schema/result.schema.json` | 报告 JSON schema                                                       |
| `packages/dom-shim/benchmarks/corpus/prompts.json`       | 50 个手写 LLM-DOM benchmark prompt                                     |

**相关并行工作（不同分支）：**

- `Huxpro/lynx-dom-shim` — testing-environment 用途的 DOM Shim 实现，10 stories 完成，130/130 测试绿。和本工作互补但目标不同（jest-DOM 风格断言层，非 LLM 直出运行时）。

**重新跑 benchmark 的命令：**

```bash
# 必需：node v22+，企业网络下需要 NODE_EXTRA_CA_CERTS（详见 SMOKE_TEST_README.md）
export PATH="/Users/bytedance/.nvm/versions/node/v22.19.0/bin:$PATH"
export NODE_EXTRA_CA_CERTS=/tmp/all-cas.pem
export OPENAI_API_KEY=sk-...   # 或 ANTHROPIC_API_KEY，自动检测

cd ~/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark

# dry-run 自测（不调 LLM）
pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A,B,C --prompts P001,P002 --rounds 1

# Hard n=10 spot check
pnpm -F @lynx-js/dom-shim benchmark --routes A,B,C \
    --prompts P007,P014,P015,P023,P029,P030,P034,P041,P048,P049 \
    --rounds 3 --model gpt-4o

# 完整 n=50（PRD §11 要求人工确认，不要随便跑）
pnpm -F @lynx-js/dom-shim benchmark --all --rounds 3 --model gpt-4o
```

---

## 十一、致谢和方法说明

**Process：** 本 Phase 1 大部分代码由 Claude Code（Anthropic 的 CLI agent）通过 `/ralph-loop` 自治模式实现。前 5 个 iteration 完成全部 9 个 user story 的代码 + commit，后续 iteration 在 API key 缺失时短路。具体 iteration 流水账详见 `scripts/ralph-benchmark/progress.txt`。

**Methodology disclosure：**

- Mock PAPI 不是真 Lynx engine，是 Phase 1 throwaway 实现
- 三条 route 共享同一个 mock runtime（apples-to-apples）
- gpt-4o 是单模型数据点，未对照 claude / sonnet / 其他
- 所有 LLM 调用日志可在 `packages/dom-shim/benchmarks/reports/<run_id>/records.jsonl` 找到
