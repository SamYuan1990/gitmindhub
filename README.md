# 🌳 GitMindHub

> **Version control for your AI context.** Branch, trace, and visualize your conversations like a Git repository.
> **为你的 AI 上下文提供版本控制。** 像管理 Git 仓库一样，分支、追溯并可视化你的对话。

[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![LanceDB](https://img.shields.io/badge/Vector_DB-LanceDB-orange)](https://lancedb.com/)

---

## 💡 为什么需要 GitMindHub？

传统的 AI 聊天界面是**线性**的。当你在第 10 轮对话想尝试一个新的思路（Prompt）时，你只能：
1. 清空上下文，从头开始（丢失了前面 9 轮的宝贵积累）。
2. 新建一个完全独立的对话（无法与之前的思路进行对比）。

**GitMindHub** 引入了 Git 的 **DAG（有向无环图）** 理念来管理 LLM 的上下文（Context）：
- 🌿 **Fork (分支)**: 在任意历史节点双击，即可基于当时的上下文快照开启新的对话分支。
- 🔍 **Trace (追溯)**: 自动沿 `parent_uuid` 向上追溯，精准拼装发送给 LLM 的完整历史谱系 (Lineage)。
- 🕸️ **Visualize (可视化)**: 基于 React Flow 的树状图，直观展示对话的演进与分叉，支持自动防重叠布局。
- 🧠 **Local RAG**: 内置本地向量检索，支持语义搜索历史对话，并一键跳转 (Checkout) 到相关节点。

---

## ✨ 核心特性

- **Git-like Context Management**: 每一轮对话都是一个 Commit，支持多分支并行探索。
- **Smart DAG Visualization**: 独创的“子树宽度”布局算法，完美解决复杂对话树节点重叠问题。
- **Dual-Database Architecture**: `SQLite` (关系型元数据) + `LanceDB` (高维向量存储)，兼顾查询性能与 RAG 能力。
- **Intelligent Data Migration**: 支持 JSON 格式的导出与**智能合并导入 (Merge)**。自动处理 UUID 冲突与外键依赖，安全合并不同设备的知识库。
- **Privacy First**: 纯本地运行，所有对话历史、向量数据均存储在本地，绝不上传云端。

---

## 🏗️ 技术架构

```text
┌─────────────────────────────────────────────────────────────┐
│                      GitMindHub (Electron)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  React + Vite│  │  React Flow  │  │ IPC (preload.js) │  │
│  │  (UI & State)│  │ (DAG Visual) │  │  (Secure Bridge) │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼──────────────────┼───────────────────┼────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Local Backend (Node.js)                   │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │   SQLite             │  │   LanceDB                  │  │
│  │   (Metadata & DAG)   │  │   (Vector Embeddings)      │  │
│  └──────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          ▲
          │ (可扩展接入外部 LLM API / 本地 LLM 服务)
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  External LLM / Agent Service               │
│             (OpenAI Compatible / pi-agent / etc.)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始 (Quick Start)

### 前置条件
- Node.js >= 18.x
- npm 或 pnpm

### 1. 克隆仓库并安装依赖
```bash
git clone https://github.com/YOUR_USERNAME/GitMindHub.git
cd GitMindHub
# optional: ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install --loglevel verbose
```
*(注：`better-sqlite3` 和 `@lancedb/lancedb` 包含原生绑定，如遇编译问题，请确保系统已安装 Python 和 C++ 构建工具)*

### 2. 启动开发环境
打开两个终端窗口，分别运行：

```bash
npm run dev
# 终端 1: 启动 Vite 前端开发服务器
#npm run dev:vite

# 终端 2: 启动 Electron 桌面应用
#npm run dev:electron
```
应用将自动弹出。首次运行时，系统会在本地自动初始化数据库目录。

## Doc set up
```
mkdocs serve
```

---

## 🎮 核心交互指南

1. **开启新对话**: 点击顶部导航栏的 `✨ 新建对话`，或在空白输入框直接输入，系统将创建一个全新的 Root 节点。
2. **分支探索 (Fork)**: 切换到 `🕸️ DAG 视图`，**双击**任意历史节点。系统将自动 Checkout 到该节点，你可以在其基础上追加新的对话，自然形成新的分支。
3. **语义搜索**: 点击 `🧠 语义查找`，输入自然语言（如“之前提到的那个算法”），系统将在本地向量库中检索，点击结果即可直接跳转到对应的对话节点。
4. **数据备份**: 点击 `📤 导出` 可将完整的对话树和向量数据打包为 JSON；再次导入时，系统会智能识别并**合并 (Merge)** 新旧数据，避免冲突。

---

## 🗺️ 开发路线图 (Roadmap)

- [x] **Phase 1: 核心骨架与可视化** (已完成)
  - [x] Electron + React + Vite 基础架构
  - [x] React Flow DAG 自动布局与渲染
  - [x] SQLite + LanceDB 双库联动与本地 RAG
  - [x] 智能合并导入/导出 (Merge Import)
- [ ] **Phase 2: 真实 LLM 接入与配置** (进行中)
  - [ ] 接入真实的 LLM API (支持 OpenAI 兼容格式 / pi-agent)
  - [ ] 完善 `⚙️ 设置` 页面 (API Key, Model, System Prompt 配置)
  - [ ] 支持流式输出 (Streaming) 并在 DAG 中实时更新
- [ ] **Phase 3: 工程化与生态**
  - [x] Electron 自动打包与发布 (GitHub Actions)
  - [ ] 容器化部署支持 (Docker Compose for Server + Web UI)
  - [ ] 上下文 Diff 对比视图 (对比两个分支的输出差异)

---

## 🤝 贡献指南 (Contributing)

欢迎提交 Issue 和 Pull Request！
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request
