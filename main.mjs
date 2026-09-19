// main.mjs
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const db = require('./src/backend/database.js')
const settingsManager = require('./src/backend/settings.js')
const fs = require('fs')

import { builtinModels } from '@earendil-works/pi-ai/providers/all'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const models = builtinModels()
let currentSettings = settingsManager.getSettings()

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, title: 'GitMindHub',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

async function getEmbedding(text) {
  const response = await fetch(currentSettings.embeddingUrl, { 
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, model: 'local-model' })
  })
  if (!response.ok) throw new Error(`Embedding API 错误: ${response.status}`)
  const data = await response.json()
  return data.data[0].embedding
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

// 🌟 设置相关 IPC
ipcMain.handle('settings:get', async () => currentSettings)
ipcMain.handle('settings:set', async (event, newSettings) => {
  currentSettings = settingsManager.saveSettings(newSettings)
  return currentSettings
})
ipcMain.handle('settings:openFileLocation', async () => shell.showItemInFolder(settingsManager.SETTINGS_PATH))

// 核心业务：处理对话流
ipcMain.handle('chat:message', async (event, payload) => {
  const { parentUuid, userText, llmProfileId } = payload // 🌟 接收前端传来的 profileId
  console.log(`\n[Chat] 📥 收到新消息, parent: ${parentUuid || 'root'}, profile: ${llmProfileId}`)

  try {
    // 1. 保存 User 消息
    const userMsgUuid = uuidv4()
    const userMsgData = {
      uuid: userMsgUuid, parent_uuid: parentUuid, branch: 'main',
      role: 'user', preview_text: userText.substring(0, 50),
      full_text: userText, timestamp: Date.now()
    }
    const userChunks = splitTextIntoChunks(userText)
    const userVectors = await Promise.all(userChunks.map(c => getEmbedding(c)))
    await db.insertMessageWithChunks(userMsgData, userChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: userVectors[i]
    })))

    // 2. 获取上下文并格式化
    const messagesForLLM = db.getLineageContext(userMsgUuid)
    if (currentSettings.systemPrompt) {
      messagesForLLM.unshift({ role: 'system', content: currentSettings.systemPrompt })
    }
    const formattedMessages = messagesForLLM.map(msg => 
      msg.role === 'assistant' && typeof msg.content === 'string' 
        ? { ...msg, content: [{ type: 'text', text: msg.content }] } 
        : msg
    )

    // 🌟 3. 动态获取 LLM 配置与模型实例
    const profile = settingsManager.getProfileById(llmProfileId) || settingsManager.getDefaultProfile()
    if (!profile || !profile.apiKey) throw new Error(`LLM 配置 "${profile?.name}" 无效或未配置 API Key。`)
    
    const activeModel = models.getModel(profile.provider, profile.modelId)
    if (!activeModel) throw new Error(`pi-ai 中未找到模型: ${profile.provider}/${profile.modelId}`)

    console.log(`[Chat] 🚀 正在使用 [${profile.name}] (${profile.provider}/${profile.modelId}) 发送请求...`)
    
    const response = await models.complete(activeModel, { messages: formattedMessages }, { apiKey: profile.apiKey })

    if (response.stopReason === 'error') {
      throw new Error(`LLM 返回错误: ${response.errorMessage || 'Unknown error'}`)
    }

    let aiText = ''
    for (const block of response.content) {
      if (block.type === 'text') aiText += block.text
    }
    if (!aiText.trim()) aiText = '[AI 返回了空内容]'

    // 4. 保存 AI 消息 (携带模型元数据)
    const aiMsgUuid = uuidv4()
    const aiMsgData = {
      uuid: aiMsgUuid, parent_uuid: userMsgUuid, branch: 'main',
      role: 'assistant', preview_text: aiText.substring(0, 50),
      full_text: aiText, timestamp: Date.now()
    }
    
    const aiChunks = splitTextIntoChunks(aiText)
    const aiVectors = await Promise.all(aiChunks.map(c => getEmbedding(c)))
    
    // 🌟 传入 modelInfo 给数据库层
    await db.insertMessageWithChunks(aiMsgData, aiChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: aiVectors[i]
    })), {
      profileId: profile.id,
      provider: profile.provider,
      modelId: profile.modelId
    })
    
    // 返回给前端时带上模型显示名
    return { ...aiMsgData, modelName: profile.name }

  } catch (error) {
    console.error('[Chat] ❌ 处理对话流失败:', error)
    throw new Error(`LLM 调用失败: ${error.message}`)
  }
})

// ... (保留 db:search, data:export, data:import, chat:newRoot 等原有 handlers，代码不变) ...
ipcMain.handle('db:search', async (event, queryText, limit = 5) => {
  try {
    const queryVector = await getEmbedding(queryText)
    const results = await db.searchChunks(queryVector, limit)
    return { success: true, results }
  } catch (error) { return { success: false, error: error.message } }
})

ipcMain.handle('data:export', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({ title: '导出', defaultPath: `backup.json`, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (canceled || !filePath) return { success: false }
  try {
    fs.writeFileSync(filePath, JSON.stringify(await db.exportAllData(), null, 2))
    return { success: true, path: filePath }
  } catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
  if (canceled || !filePaths?.length) return { success: false }
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
    if (db.getMessageCount() > 0) {
      const { response } = await dialog.showMessageBox({ type: 'question', buttons: ['合并', '覆盖', '取消'], defaultId: 0, cancelId: 2, title: '导入模式' })
      if (response === 2) return { success: false }
      if (response === 0) return { success: true, mode: 'merge', stats: await db.mergeImportData(data) }
    }
    await db.importAllData(data)
    return { success: true, mode: 'overwrite' }
  } catch (error) { return { success: false, message: error.message } }
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