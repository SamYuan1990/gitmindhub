# 📦 安装与运行

GitMindHub 是一个基于 Electron 的桌面应用，前端使用 React + Vite 构建。

## 前置条件

- **Node.js** >= 18.x
- **npm** 或 **pnpm**

## 1. 克隆仓库并安装依赖

```bash
git clone https://github.com/YOUR_USERNAME/GitMindHub.git
cd GitMindHub
npm install
```

!!! warning "关于原生模块编译"
    本项目使用了 `better-sqlite3` 和 `@lancedb/lancedb`，它们包含 C++/Rust 原生绑定。
    如果在 `npm install` 时遇到编译错误，请确保你的系统已安装 **Python** 和 **C++ 构建工具** (如 Windows 下的 `windows-build-tools`，macOS 下的 `Xcode Command Line Tools`)。

## 2. 启动开发环境

GitMindHub 采用前后端分离的开发模式，需要同时启动 Vite 开发服务器和 Electron 进程。

请打开**两个终端窗口**，并在项目根目录分别运行：

**终端 1：启动前端热更新服务**
```bash
npm run dev:vite
```
*(看到 `Local: http://localhost:5173/` 即表示成功)*

**终端 2：启动 Electron 桌面壳**
```bash
npm run dev:electron
```

应用将自动弹出。首次运行时，系统会在本地自动初始化数据库目录 (`gitmindhub_data`)。