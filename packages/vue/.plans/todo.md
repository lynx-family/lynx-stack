See if we can build an experimental `lynx-stack.dev/vue` subsite for `experimental/vue` branch

## Overall

drop as much "lepus" and "worklet" as possible.

## entry-main.ts

- Extract the `mts-draggable-raw` demo worklet and related logic to a **test** file
- remove `mts-demo`

## ops-apply.ts

→ **Tracked in `.plans/08-ops-apply-split.md`**

## Source code vise

→ **Tracked in `.plans/08-ops-apply-split.md`** (Step 0: `@lynx-js/vue-internal` shared package)

## Getting Started

Patch the `community-cli` or `sparkling` to create native Apps with template from other places. (Shit we need to replicate the Vue Lynx template)

Run the below prompt to an Agent to start a native app with Sparkling

```sh
```

---

Run the below prompt to an Agent to run with Lynx Go

```sh
```

Agentic Getting Started: "run this f up"

## Element PAPI

- alias `callLepusMethod`
  - starting from source of VueLynx than Element PAPI and React

## Research

### Asking Claude to generate a spec then we use Remotion to generate video

explain how things work

### Does Vue DevTool work???

### Template `ref` should return Lynx's `NodeRef`? DOM Query API

### 双线程 语义偏移

- `v-model`: `:v-main-thread-model = {mtRef}`?
- `onMounted`

queuePostFlushCb

### Single-threaded official "react" on Lynx

More branding support than "preact"

Preact 没有 custom renderer?

- 我的测试目的是用于做 DOM shim?

Let open claw to

- create one claude to study Vue/Preact impl and generate a plan with different phase
- create multiple claude to detail each phases, and a test plan (tester)
- implement them one by one.
- initiate another agent with original phased plan to review the whole code
- let the tester to test the things.

### compare the "Block + ShadowElement" vs ReactLynx's Snapshot

Vue 已经有了 Block，省去了我们 Snapshot 的工作 - Block 是 1st-class. 在 ReactLynx 里我们需要 hack preact 让它知道 Snapshot 是一等公民。

Compilation

- Vue Block: BG ops once; Slot patches later
- RL Snapshot: MT-SI IFR; Slot patches later

VDOM

- OPs -> Element PAPI

Question: can ReactLynx be implemented by this ShadowElement and would be slower

- Vue: VDOM -> Blocks -> ShadowElement
- RL: VDOM -> Snapshot

- Block Tree 是 Vue VDOM 内化的，Snapshot 是外挂的
  Snapshot 是 Block/ShadowElement 2-in-1（应该拆吗，对于 ElementTemplate 的启示）？

```
双写策略：每个操作同时做两件事：

同步更新 BG 侧的轻量树结构（维护 parent/child/sibling 指针，支持查询）
追加到 patch 数组（一个扁平 unknown[]，等 reconcile 完毕后批量发送到 Main Thread）
```

We are working on standardizing this concept for future framework devs.

### 下面这些都可以被轻松复用，而且天生适合 IPC

Patch Flags：Vue 编译器会标记哪些节点是动态的。静态子树只需要发送一次 create ops，后续更新永远不会产生对应的 ops——天然减少跨线程流量。

Block Tree：Vue 3 的 Block Tree 优化让 diff 只比较动态节点。结合跨线程协议，意味着 operations 的数量直接与「实际变化的节点数」成正比，而不是「整棵树的大小」。

Static Hoisting：静态节点的 create ops 可以在初始化时一次性批量发送，后续完全不参与更新流程

Vue's static hoisting optimization reuses VNode references across renders, which means the patch function skips them entirely—no nodeOps calls get made for static nodes during updates, so no operations are generated and there's no cross-thread communication needed. This actually works seamlessly with the custom renderer.

The block tree optimization also plays nicely here since it restricts reconciliation to only dynamic children, which naturally means only dynamic nodes trigger nodeOps calls and generate operations. The trickier piece is `insertStaticContent`, which Vue uses to inject pre-compiled static HTML via innerHTML in the DOM renderer. For Lynx, I'd either need to skip this optimization and fall back to creating elements individually, or implement a different approach—but since it's optional, Vue functions fine without it.

### RN

- compare with React Native
  - the `ops buffer` architecture
  - Shadow Tree overhead?
    - same concept:
      - VDOM + Shadow Tree live in the JS thread, then handover to main thread
    - RN:
      - React VDOM shadow create C++ shadow tree via JSI, then handover the C++ tree
    - Here
      - Vue VDOM shadow create shadowElement in JS heap, then handover the ops.
        then give the ops to MTS tree on main thread.
  - threading
    - RN also do not run JS/React on UI thread, guess why?

- compare Main-Thread Vue vs. Dual-threaded Vue on perf implications
  - notably on mobile with native UI being heavier (than browser)

## 思考（适合作为 "Lynx Architecting Notes"（架构笔记）

这种把 同步调用 转化为 `stack.insertOps` 的形式在 PLT/Compiler 里出现过无数次，
这种行为叫什么？

有一种从 interpret 变成 compile 的感觉，感觉是一种 JIT?
basically BG JIT opcode -> send opcode -> interpret opcode

所以 MTS 这边其实是一个 UIop VM 啊！

## 科学研究

我想要知道

- 线程间通信量 overhead
- 渲染量 overhead

的关系

## 科学研究

React MT vs Preact MT vs RL IFR

## `lynx-stack` 流量不行，我觉得最好的名字是 `lynx-js` ...

[RFC] The JavaScript layer of Lynx.
