const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

let globalSettings = {
  model: 'mock-gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are a helpful assistant with Git-like context management.'
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'GitMindHub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

// ==========================================
// 🛠️ Mock 后端逻辑 (IPC 监听器)
// ==========================================

ipcMain.handle('chat:message', async (event, userMessage) => {
  console.log('[Backend] 收到用户消息:', userMessage)
  await new Promise(resolve => setTimeout(resolve, 1200))
  return {
    role: 'assistant',
    content: `✅ 收到: "${userMessage}"\n(基于 ${globalSettings.model}, Temp: ${globalSettings.temperature})`,
    timestamp: new Date().toLocaleTimeString()
  }
})

ipcMain.handle('settings:update', async (event, newSettings) => {
  globalSettings = { ...globalSettings, ...newSettings }
  return { success: true }
})

// 模拟导出数据 (保存到本地 JSON)
ipcMain.handle('data:export', async (event, data) => {
  console.log('[Backend] 📤 模拟导出数据到 gitmindhub_session.json:')
  console.log(JSON.stringify(data, null, 2))
  return { success: true, message: '数据已成功导出 (模拟)' }
})

// 模拟导入数据 (从本地 JSON 读取)
ipcMain.handle('data:import', async (event) => {
  console.log('[Backend] 📥 模拟从 gitmindhub_session.json 导入数据...')
  // 返回一段包含“分支结构”的预设数据，用于展示 DAG 的树状效果
  return {
    success: true,
    data: [
      { id: 'root', parentId: null, role: 'assistant', content: '欢迎使用 GitMindHub！这是一个支持 Git 风格上下文管理的 AI 对话工具。', timestamp: '10:00 AM', branch: 'main' },
      { id: 'msg1', parentId: 'root', role: 'user', content: '如何设计一个 DAG 数据结构来表示对话历史？', timestamp: '10:01 AM', branch: 'main' },
      { id: 'msg2', parentId: 'msg1', role: 'assistant', content: '推荐使用邻接表，或者包含 parent_id 的节点对象数组。每个节点保存完整的 Context 快照。', timestamp: '10:02 AM', branch: 'main' },
      // 分支 A: 从 msg2 派生
      { id: 'branchA1', parentId: 'msg2', role: 'user', content: '换个话题，聊聊 Git 的历史吧', timestamp: '10:10 AM', branch: 'feature/git-history' },
      { id: 'branchA2', parentId: 'branchA1', role: 'assistant', content: 'Git 由 Linus Torvalds 在 2005 年创建，最初是为了管理 Linux 内核开发。', timestamp: '10:11 AM', branch: 'feature/git-history' },
      // 分支 B: 也从 msg2 派生 (展示分叉)
      { id: 'branchB1', parentId: 'msg2', role: 'user', content: '其实我想问 Electron 的 IPC 通信安全吗？', timestamp: '10:08 AM', branch: 'experiment/electron' },
      { id: 'branchB2', parentId: 'branchB1', role: 'assistant', content: '只要开启 contextIsolation 并使用 preload.js 暴露白名单 API，就是非常安全的。', timestamp: '10:09 AM', branch: 'experiment/electron' }
    ]
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })