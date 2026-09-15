const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

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
  
  // 模拟网络延迟和 AI 思考过程 (1.5秒)
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // 返回结构化的消息对象
  return {
    role: 'assistant',
    content: `✅ Mock AI 回复:\n我收到了你的消息 "${userMessage}"。\n这是来自 Electron 主进程的模拟响应。后续我们将在这里接入 pi-agent。`,
    timestamp: Date.now()
  }
})
// ==========================================

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})