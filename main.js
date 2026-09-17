const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const db = require('./src/backend/database')

const isDev = process.env.NODE_ENV === 'development'
const EMBEDDING_API_URL = 'http://localhost:9080/embeddings'

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

async function getEmbedding(text) {
  try {
    const response = await fetch(EMBEDDING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: 'local-model' })
    });
    
    if (!response.ok) throw new Error(`Embedding API 返回错误状态: ${response.status}`);
    
    const data = await response.json();
    return data.data[0].embedding; 
  } catch (error) {
    console.error(`[Embedding] ❌ 调用失败 (URL: ${EMBEDDING_API_URL}):`, error.message);
    throw error;
  }
}

// ==========================================
// 🛠️ IPC 监听器
// ==========================================

ipcMain.handle('chat:message', async (event, userMessage) => {
  await new Promise(resolve => setTimeout(resolve, 1200))
  return { role: 'assistant', content: `✅ 收到: "${userMessage}"`, timestamp: new Date().toLocaleTimeString() }
})

ipcMain.handle('settings:update', async (event, newSettings) => {
  globalSettings = { ...globalSettings, ...newSettings }
  return { success: true }
})

ipcMain.handle('data:export', async (event, data) => { return { success: true } })
ipcMain.handle('data:import', async (event) => {
  return {
    success: true,
    data: [
      { id: 'root', parentId: null, role: 'assistant', content: '欢迎使用 GitMindHub！', timestamp: '10:00 AM', branch: 'main' },
      { id: 'msg1', parentId: 'root', role: 'user', content: '如何设计一个 DAG？', timestamp: '10:01 AM', branch: 'main' }
    ]
  }
})

// 🚨 重点排查：db:addChunk 监听器
ipcMain.handle('db:addChunk', async (event, content, metadata) => {
  console.log(`\n[Backend] 📥 ================= 收到 addChunk 请求 =================`);
  console.log(`[Backend] 📝 内容预览: "${content.substring(0, 30)}..."`);
  
  try {
    console.log(`[Backend] 🧠 1. 正在调用 Qwen 获取 Embedding...`);
    const vector = await getEmbedding(content);
    console.log(`[Backend] ✅ 2. 获取 Embedding 成功, 维度: ${vector.length}`);
    
    console.log(`[Backend] 💾 3. 正在调用 db.addChunk 写入 LanceDB...`);
    const result = await db.addChunk(content, vector, metadata);
    console.log(`[Backend] 🎉 4. db.addChunk 返回结果:`, result);
    console.log(`[Backend] 🏁 ======================================================================\n`);
    
    return result;
  } catch (error) {
    console.error(`[Backend] ❌ addChunk 处理链路发生异常:`, error.message);
    console.error(`[Backend] ❌ 异常堆栈:`, error.stack);
    console.log(`[Backend] 🏁 ======================================================================\n`);
    return { success: false, error: error.message };
  }
})

ipcMain.handle('db:search', async (event, queryText, limit = 5) => {
  try {
    const queryVector = await getEmbedding(queryText)
    const results = await db.searchChunks(queryVector, limit)
    return { success: true, results }
  } catch (error) {
    console.error('[Backend] ❌ 搜索 IPC 处理失败:', error.message);
    return { success: false, error: error.message }
  }
})

app.whenReady().then(async () => {
  try {
    console.log('[App] 🚀 正在探测本地 Qwen Embedding 服务...');
    const testVector = await getEmbedding('dimension probe');
    const dim = testVector.length;
    console.log(`[App] ✅ 服务连接成功！探测到 Embedding 维度: ${dim}`);
    await db.initDB(dim);
    createWindow();
  } catch (err) {
    console.error('[App] ❌ 致命错误: 无法连接 Qwen Embedding 服务。');
    dialog.showErrorBox('Embedding 服务未就绪', '无法连接到本地 Qwen 服务。\n请确保已运行: python server.py');
    app.quit();
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })