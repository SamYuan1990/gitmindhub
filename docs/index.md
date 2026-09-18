# 🌳 GitMindHub

> **Version control for your AI context.** Branch, trace, and visualize your conversations like a Git repository.
> **为你的 AI 上下文提供版本控制。** 像管理 Git 仓库一样，分支、追溯并可视化你的对话。

## 💡 为什么需要 GitMindHub？

传统的 AI 聊天界面是**线性**的。当你在第 10 轮对话想尝试一个新的思路（Prompt）时，你只能：
1. 清空上下文，从头开始（丢失了前面 9 轮的宝贵积累）。
2. 新建一个完全独立的对话（无法与之前的思路进行对比）。

**GitMindHub** 引入了 Git 的 **DAG（有向无环图）** 理念来管理 LLM 的上下文（Context）：

- 🌿 **Fork (分支)**: 在任意历史节点双击，即可基于当时的上下文快照开启新的对话分支。
- 🔍 **Trace (追溯)**: 自动沿 `parent_uuid` 向上追溯，精准拼装发送给 LLM 的完整历史谱系 (Lineage)。
- 🕸️ **Visualize (可视化)**: 基于 React Flow 的树状图，直观展示对话的演进与分叉，支持自动防重叠布局。
- 🧠 **Local RAG**: 内置本地向量检索，支持语义搜索历史对话，并一键跳转 (Checkout) 到相关节点。

## ✨ 核心特性

- **Git-like Context Management**: 每一轮对话都是一个 Commit，支持多分支并行探索。
- **Smart DAG Visualization**: 独创的“子树宽度”布局算法，完美解决复杂对话树节点重叠问题。
- **Dual-Database Architecture**: `SQLite` (关系型元数据) + `LanceDB` (高维向量存储)，兼顾查询性能与 RAG 能力。
- **Intelligent Data Migration**: 支持 JSON 格式的导出与**智能合并导入 (Merge)**。自动处理 UUID 冲突与外键依赖。
- **Privacy First**: 纯本地运行，所有对话历史、向量数据均存储在本地，绝不上传云端。

## 🚀 快速开始

请前往 [Installation](installation.md) 页面了解如何在本地启动 GitMindHub。