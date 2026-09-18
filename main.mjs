// main.mjs
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'
import { createRequire } from 'module'

// 🌟 1. 兼容现有的 CommonJS database.js
const require = createRequire(import.meta.url)
const db = require('./src/backend/database.js')
const fs = require('fs') // 🌟 提前在顶部引入 fs，避免在 handler 中重复 require

// 🌟 2. 完全按照官方文档引入 pi-ai
import { builtinModels } from '@earendil-works/pi-ai/providers/all'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 🌟 3. 官方文档 Quick Start 初始化
const models = builtinModels()

// 🌟 4. 获取你指定的 DeepSeek 模型 (Provider: 'deepseek', Model ID: 'deepseek-v4-flash')
const model = models.getModel('deepseek', 'deepseek-v4-flash')
if (model) {
  console.log(`[App] ✅ 成功加载目标模型: Provider='${model.provider}', ID='${model.id}'`)
} else {
  console.warn('[App] ⚠️ 警告: 未能从 builtinModels 中找到 deepseek/deepseek-v4-flash，请检查启动日志。')
}

const isDev = process.env.NODE_ENV === 'development'
const EMBEDDING_API_URL = 'http://localhost:9080/embeddings'

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

  if (isDev) {
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
    const response = await fetch(EMBEDDING_API_URL, {
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

// 3. 核心业务：处理完整的对话流
ipcMain.handle('chat:message', async (event, payload) => {
  console.log('\n========================================')
  console.log('[Chat] 📥 收到 chat:message 请求')
  console.log('[Chat] Payload:', payload)
  
  const { parentUuid, userText } = payload

  try {
    // --- 步骤 1: 保存 User 消息 ---
    console.log('[Chat] 步骤 1: 开始保存 User 消息...')
    const userMsgUuid = uuidv4()
    const userMsgData = {
      uuid: userMsgUuid,
      parent_uuid: parentUuid,
      branch: 'main',
      role: 'user',
      preview_text: userText.substring(0, 50),
      full_text: userText,
      timestamp: Date.now()
    }
    
    const userChunks = splitTextIntoChunks(userText)
    const userVectors = await Promise.all(userChunks.map(c => getEmbedding(c)))
    const userChunksWithVectors = userChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: userVectors[i]
    }))
    
    await db.insertMessageWithChunks(userMsgData, userChunksWithVectors)
    console.log(`[Chat] ✅ 步骤 1 完成: User 消息已落库 (${userMsgUuid.substring(0, 8)})`)

    // --- 步骤 2: 获取结构化上下文 ---
    console.log('[Chat] 步骤 2: 开始获取上下文...')
    const messagesForLLM = db.getLineageContext(userMsgUuid)
    console.log(`[Chat] ✅ 步骤 2 完成: 获取到 ${messagesForLLM.length} 条 messages`)
    console.log('[Chat] 上下文预览:', JSON.stringify(messagesForLLM.slice(-2), null, 2))

    // --- 步骤 3: 检查 LLM 模型状态 ---
    console.log('[Chat] 步骤 3: 检查 pi-ai 模型状态...')
    console.log('[Chat] model 对象:', model ? `存在, ID=${model.id}, Provider=${model.provider}` : '❌ UNDEFINED (未找到模型!)')
    
    if (!model) {
      throw new Error('未找到 DeepSeek 模型。请检查启动日志。')
    }

    console.log('[Chat] 步骤 4: 准备调用 models.complete...')
    console.log('[Chat] DEEPSEEK_API_KEY 存在?', !!process.env.DEEPSEEK_API_KEY)
    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('[Chat] ⚠️ 警告: process.env.DEEPSEEK_API_KEY 为空！请检查 .env 文件。')
    }

    const context = { messages: messagesForLLM }
    console.log(`[Chat] 🚀 正在向 ${model.provider}/${model.id} 发送请求... (这可能需要几秒钟)`)
    
    const response = await models.complete(model, context, {
      apiKey: process.env.DEEPSEEK_API_KEY
    })
    
    console.log('[Chat] ✅ 步骤 5 完成: 收到 DeepSeek 响应')
    
    // 🌟 深度调试：打印完整的 response 结构，看看里面到底有什么
    console.log('[Chat] 🔍 完整 Response 结构:', JSON.stringify(response, null, 2))
    
    if (Array.isArray(response.content)) {
      console.log('[Chat] 🔍 Content Blocks 详情:', response.content.map(b => ({ 
        type: b.type, 
        hasText: !!b.text, 
        textPreview: b.text ? b.text.substring(0, 100) : 'N/A',
        hasError: !!b.errorMessage
      })))
    }

    // --- 步骤 6: 解析响应 ---
    let aiText = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        aiText += block.text
      } else if (block.type === 'error' || block.errorMessage) {
        // 🌟 捕获 pi-ai 可能返回的错误 block
        console.warn('[Chat] ⚠️ 发现 Error Block:', block.errorMessage || block)
        aiText += `[API 错误: ${block.errorMessage || 'Unknown error'}] `
      }
    }
    
    console.log(`[Chat] ✅ 步骤 6 完成: 解析出 ${aiText.length} 字符的文本`)
    
    if (!aiText.trim()) {
      aiText = '[AI 返回了空内容，请检查模型配置或重试。详见终端日志中的 Response 结构。]'
    }

    // --- 步骤 7: 保存 AI 消息 ---
    console.log('[Chat] 步骤 7: 开始保存 AI 消息...')
    const aiMsgUuid = uuidv4()
    const aiMsgData = {
      uuid: aiMsgUuid,
      parent_uuid: userMsgUuid,
      branch: 'main',
      role: 'assistant',
      preview_text: aiText.substring(0, 50),
      full_text: aiText,
      timestamp: Date.now()
    }
    
    const aiChunks = splitTextIntoChunks(aiText)
    const aiVectors = await Promise.all(aiChunks.map(c => getEmbedding(c)))
    const aiChunksWithVectors = aiChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: aiVectors[i]
    }))
    
    await db.insertMessageWithChunks(aiMsgData, aiChunksWithVectors)
    console.log(`[Chat] ✅ 步骤 7 完成: AI 消息已落库 (${aiMsgUuid.substring(0, 8)})`)
    console.log('========================================\n')

    return aiMsgData

  } catch (error) {
    console.error('\n========================================')
    console.error('[Chat] ❌❌❌ 捕获到严重异常 ❌❌❌')
    console.error('[Chat] 错误名称:', error.name)
    console.error('[Chat] 错误信息:', error.message)
    console.error('[Chat] 错误堆栈:', error.stack)
    console.error('========================================\n')
    
    const errMsg = error instanceof Error ? error.message : String(error)
    throw new Error(`LLM 调用失败: ${errMsg}`)
  }
})

// 4. 语义搜索 (RAG)
ipcMain.handle('db:search', async (event, queryText, limit = 5) => {
  try {
    const queryVector = await getEmbedding(queryText)
    const results = await db.searchChunks(queryVector, limit)
    return { success: true, results }
  } catch (error) {
    console.error('[Search] ❌ 搜索失败:', error.message)
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
    console.log(`[Export] ✅ 成功导出至: ${filePath}`)
    return { success: true, path: filePath }
  } catch (error) {
    console.error('[Export] ❌ 导出失败:', error)
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
        type: 'question',
        buttons: ['🧩 合并导入 (Merge)', '🔄 覆盖导入 (Overwrite)', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '选择导入模式',
        message: '本地已存在对话数据，请选择如何处理导入的数据？',
        detail: '合并导入：仅添加本地不存在的节点，保留现有数据（推荐）。\n覆盖导入：清空本地所有数据，替换为导入的数据。'
      })

      if (response === 0) mode = 'merge'
      else if (response === 1) mode = 'overwrite'
      else return { success: false, message: '用户取消' }
    }

    if (mode === 'merge') {
      const stats = await db.mergeImportData(data)
      console.log(`[Import] ✅ 合并导入成功:`, stats)
      return { success: true, mode: 'merge', stats }
    } else {
      await db.importAllData(data)
      console.log(`[Import] ✅ 覆盖导入成功`)
      return { success: true, mode: 'overwrite' }
    }
  } catch (error) {
    console.error('[Import] ❌ 导入失败:', error)
    return { success: false, message: error.message }
  }
})

ipcMain.handle('chat:newRoot', async () => {
  console.log('\n[Chat] 🌱 创建全新对话根节点...')
  const rootUuid = uuidv4()
  const rootText = '✨ 全新对话已开始。你可以随时从这里开启新的思路。'
  
  const rootData = {
    uuid: rootUuid,
    parent_uuid: null,
    branch: 'main',
    role: 'assistant',
    preview_text: rootText.substring(0, 50),
    full_text: rootText,
    timestamp: Date.now()
  }

  const vector = await getEmbedding(rootText)
  const chunks = [{ 
    chunk_uuid: uuidv4(), 
    text_content: rootText, 
    chunk_index: 0, 
    vector 
  }]
  
  await db.insertMessageWithChunks(rootData, chunks)
  console.log(`[Chat] ✅ 新根节点已创建: ${rootUuid.substring(0, 8)}\n`)
  
  return rootData
})

// ==========================================
// 🚀 App 生命周期
// ==========================================
app.whenReady().then(async () => {
  try {
    console.log('[App] 🚀 正在探测本地 Qwen Embedding 服务...')
    const testVector = await getEmbedding('dimension probe')
    const dim = testVector.length
    console.log(`[App] ✅ 服务连接成功！探测到 Embedding 维度: ${dim}`)
    
    await db.initDB(dim)

    // 🌟 诊断：打印所有可用的 Provider ID
    const providers = models.getProviders()
    console.log('[App] 📦 所有可用的 Providers:', providers.map(p => p.id))

    // 🌟 诊断：查找所有名字或 provider 包含 'deepseek' 的模型
    const allModels = models.getModels()
    const deepseekModels = allModels.filter(m => 
      m.id.toLowerCase().includes('deepseek') || 
      m.provider.toLowerCase().includes('deepseek')
    )
    console.log('[App] 🔍 找到的 DeepSeek 相关模型:')
    if (deepseekModels.length === 0) {
      console.log('[App] ⚠️ 未找到任何包含 deepseek 的模型！')
      console.log('[App] 📋 系统前 5 个模型示例:', allModels.slice(0, 5).map(m => ({ id: m.id, provider: m.provider })))
    } else {
      deepseekModels.forEach(m => {
        console.log(`   - Provider: '${m.provider}', Model ID: '${m.id}'`)
      })
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (err) {
    console.error('[App] ❌ 致命错误:', err)
    dialog.showErrorBox('启动错误', `应用初始化失败:\n${err.message}\n\n请确保:\n1. .env 文件已配置\n2. Embedding 服务正在运行`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})