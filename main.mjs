// main.mjs
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { createRequire } from 'module'

// 🌟 1. 引入 CJS 模块
const require = createRequire(import.meta.url)
const db = require('./src/backend/database.js')
const settingsManager = require('./src/backend/settings.js')
const fs = require('fs')

// 🌟 2. 引入 pi-ai
import { builtinModels } from '@earendil-works/pi-ai/providers/all'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 🌟 3. 全局状态
const models = builtinModels()
let currentSettings = settingsManager.getSettings()

console.log('[App] 📂 配置文件路径:', settingsManager.SETTINGS_PATH)
console.log('[App] ⚙️ 当前配置:', { ...currentSettings, apiKey: currentSettings.apiKey ? '***已配置***' : '未配置' })

// ==========================================
// 🪟 窗口管理
// ==========================================
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

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

// ==========================================
// 🛠️ 辅助函数
// ==========================================
async function getEmbedding(text) {
  try {
    const response = await fetch(currentSettings.embeddingUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: 'local-model' })
    })
    if (!response.ok) throw new Error(`Embedding API 返回错误状态: ${response.status}`)
    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error(`[Embedding] ❌ 调用失败:`, error.message)
    throw error
  }
}

function splitTextIntoChunks(text) {
  const chunks = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  return chunks.length > 0 ? chunks : [text]
}

// ==========================================
// 📡 IPC 监听器
// ==========================================
ipcMain.handle('db:getAllMessages', async () => db.getAllMessages())
ipcMain.handle('db:getContext', async (event, targetUuid) => db.getLineageContext(targetUuid))

ipcMain.handle('settings:get', async () => currentSettings)

ipcMain.handle('settings:set', async (event, newSettings) => {
  currentSettings = settingsManager.saveSettings(newSettings)
  const newModel = models.getModel(currentSettings.provider, currentSettings.modelId)
  if (newModel) {
    globalThis.activeModel = newModel
    console.log(`[App] ⚙️ 动态切换模型至: ${currentSettings.provider}/${currentSettings.modelId}`)
  }
  return currentSettings
})

ipcMain.handle('settings:openFileLocation', async () => {
  shell.showItemInFolder(settingsManager.SETTINGS_PATH)
})

// 核心业务：处理完整的对话流
ipcMain.handle('chat:message', async (event, payload) => {
  const { parentUuid, userText } = payload
  console.log(`\n[Chat] 📥 收到新消息, parent: ${parentUuid || 'root'}`)

  try {
    // --- 步骤 1: 保存 User 消息 ---
    const userMsgUuid = uuidv4()
    const userMsgData = {
      uuid: userMsgUuid, parent_uuid: parentUuid, branch: 'main',
      role: 'user', preview_text: userText.substring(0, 50),
      full_text: userText, timestamp: Date.now()
    }
    
    const userChunks = splitTextIntoChunks(userText)
    const userVectors = await Promise.all(userChunks.map(c => getEmbedding(c)))
    const userChunksWithVectors = userChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: userVectors[i]
    }))
    
    await db.insertMessageWithChunks(userMsgData, userChunksWithVectors)

    // --- 步骤 2: 获取上下文 ---
    const messagesForLLM = db.getLineageContext(userMsgUuid)
    
    // 🌟 动态管理 System Prompt
    if (messagesForLLM.length > 0 && messagesForLLM[0].role === 'system') {
      messagesForLLM[0].content = currentSettings.systemPrompt
    } else if (currentSettings.systemPrompt) {
      messagesForLLM.unshift({ role: 'system', content: currentSettings.systemPrompt })
    }

    // 🌟 关键修复：将 assistant 的 string content 转换为 pi-ai 要求的 array 格式
    const formattedMessages = messagesForLLM.map(msg => {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        return {
          ...msg,
          content: [{ type: 'text', text: msg.content }]
        }
      }
      return msg
    })

    // --- 步骤 3: 调用 LLM ---
    const activeModel = globalThis.activeModel
    if (!activeModel) throw new Error('LLM 模型未初始化，请检查设置。')
    if (!currentSettings.apiKey) throw new Error('API Key 未配置，请在设置中填写。')

    console.log(`[Chat] 🚀 正在向 ${activeModel.provider}/${activeModel.id} 发送请求...`)
    
    const response = await models.complete(activeModel, { messages: formattedMessages }, {
      apiKey: currentSettings.apiKey
    })

    // 检查 pi-ai 是否报告了全局错误
    if (response.stopReason === 'error') {
      console.error('[Chat] ❌ pi-ai 报告了全局错误:', response)
      throw new Error(`LLM 返回错误: ${response.errorMessage || 'Unknown error'}`)
    }

    let aiText = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        aiText += block.text
      }
    }
    
    if (!aiText.trim()) {
      aiText = '[AI 返回了空内容]'
    }

    // --- 步骤 4: 保存 AI 消息 ---
    const aiMsgUuid = uuidv4()
    const aiMsgData = {
      uuid: aiMsgUuid, parent_uuid: userMsgUuid, branch: 'main',
      role: 'assistant', preview_text: aiText.substring(0, 50),
      full_text: aiText, timestamp: Date.now()
    }
    
    const aiChunks = splitTextIntoChunks(aiText)
    const aiVectors = await Promise.all(aiChunks.map(c => getEmbedding(c)))
    const aiChunksWithVectors = aiChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: aiVectors[i]
    }))
    
    await db.insertMessageWithChunks(aiMsgData, aiChunksWithVectors)
    return aiMsgData

  } catch (error) {
    console.error('[Chat] ❌ 处理对话流失败:', error)
    throw new Error(`LLM 调用失败: ${error.message}`)
  }
})

// 4. 语义搜索 (RAG)
ipcMain.handle('db:search', async (event, queryText, limit = 5) => {
  try {
    const queryVector = await getEmbedding(queryText)
    const results = await db.searchChunks(queryVector, limit)
    return { success: true, results }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 5. 导出数据
ipcMain.handle('data:export', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出 GitMindHub 知识库',
    defaultPath: `gitmindhub_backup_${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { success: false, message: '用户取消' }
  try {
    const data = await db.exportAllData()
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return { success: true, path: filePath }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 6. 导入数据
ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入 GitMindHub 知识库',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths || filePaths.length === 0) return { success: false, message: '用户取消' }
  try {
    const fileContent = fs.readFileSync(filePaths[0], 'utf-8')
    const data = JSON.parse(fileContent)
    const localCount = db.getMessageCount()
    let mode = 'overwrite'
    if (localCount > 0) {
      const { response } = await dialog.showMessageBox({
        type: 'question', buttons: ['🧩 合并导入', '🔄 覆盖导入', '取消'], defaultId: 0, cancelId: 2,
        title: '选择导入模式', message: '本地已存在数据，如何处理？'
      })
      if (response === 0) mode = 'merge'
      else if (response === 1) mode = 'overwrite'
      else return { success: false, message: '用户取消' }
    }
    if (mode === 'merge') {
      const stats = await db.mergeImportData(data)
      return { success: true, mode: 'merge', stats }
    } else {
      await db.importAllData(data)
      return { success: true, mode: 'overwrite' }
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('chat:newRoot', async () => {
  const rootUuid = uuidv4()
  const rootText = '✨ 全新对话已开始。'
  const rootData = { uuid: rootUuid, parent_uuid: null, branch: 'main', role: 'assistant', preview_text: rootText, full_text: rootText, timestamp: Date.now() }
  const vector = await getEmbedding(rootText)
  await db.insertMessageWithChunks(rootData, [{ chunk_uuid: uuidv4(), text_content: rootText, chunk_index: 0, vector }])
  return rootData
})

// ==========================================
// 🚀 App 生命周期
// ==========================================
app.whenReady().then(async () => {
  try {
    globalThis.activeModel = models.getModel(currentSettings.provider, currentSettings.modelId)
    if (!globalThis.activeModel) {
      console.warn(`[App] ⚠️ 默认模型 ${currentSettings.provider}/${currentSettings.modelId} 未找到，尝试回退...`)
      globalThis.activeModel = models.getModel('deepseek', 'deepseek-chat')
    }

    const testVector = await getEmbedding('dimension probe')
    await db.initDB(testVector.length)
    
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  } catch (err) {
    console.error('[App] ❌ 致命错误:', err)
    dialog.showErrorBox('启动错误', `初始化失败:\n${err.message}`)
    app.quit()
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })