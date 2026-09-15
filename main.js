const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

// 模拟后端的全局配置状态
let globalSettings = {
  model: 'mock-gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are a helpful assistant.'
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

// 1. 聊天消息处理
ipcMain.handle('chat:message', async (event, userMessage) => {
  console.log('[Backend] 收到用户消息:', userMessage)
  console.log('[Backend] 当前使用的设置:', globalSettings)
  
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  return {
    role: 'assistant',
    content: `✅ Mock AI 回复 (基于 ${globalSettings.model}):\n我收到了你的消息 "${userMessage}"。\n当前 Temperature 为 ${globalSettings.temperature}。`,
    timestamp: Date.now()
  }
})

// 2. 设置更新处理 (新增)
ipcMain.handle('settings:update', async (event, newSettings) => {
  console.log('[Backend] 收到设置更新:', newSettings)
  // 模拟保存到本地文件或数据库
  globalSettings = { ...globalSettings, ...newSettings }
  return { success: true, message: 'Settings saved successfully.' }
})
// ==========================================

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})