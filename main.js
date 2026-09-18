const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const db = require('./src/backend/database')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const EMBEDDING_API_URL = 'http://localhost:9080/embeddings'

let globalSettings = {
  model: 'mock-gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are a helpful assistant with Git-like context management.'
}

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
    });
    
    if (!response.ok) throw new Error(`Embedding API 返回错误状态: ${response.status}`);
    
    const data = await response.json();
    return data.data[0].embedding; 
  } catch (error) {
    console.error(`[Embedding] ❌ 调用失败:`, error.message);
    throw error;
  }
}

// 简单的文本切分（按自然段）
function splitTextIntoChunks(text) {
  const chunks = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  return chunks.length > 0 ? chunks : [text]; // 防止空文本
}

// ==========================================
// 📡 IPC 监听器 (前端与后端的桥梁)
// ==========================================

// 1. 获取所有消息 (用于前端渲染 DAG 和初始化)
ipcMain.handle('db:getAllMessages', async () => {
  return db.getAllMessages();
});

// 2. 获取某个节点的完整上下文 (用于调试或发给 LLM)
ipcMain.handle('db:getContext', async (event, targetUuid) => {
  return db.getLineageContext(targetUuid);
});

// 3. 核心业务：处理完整的对话流 (前端 App.jsx 中的 sendMessage 会调用这里)
ipcMain.handle('chat:message', async (event, payload) => {
  const { parentUuid, userText } = payload;
  console.log(`\n[Chat] 📥 收到新消息, parent: ${parentUuid || 'root'}`);

  try {
    // --- 步骤 A: 保存 User 消息 ---
    const userMsgUuid = uuidv4();
    const userMsgData = {
      uuid: userMsgUuid,
      parent_uuid: parentUuid,
      branch: 'main', // 暂时固定为 main，后续可通过 UI 传参实现 Fork
      role: 'user',
      preview_text: userText.substring(0, 50),
      full_text: userText,
      timestamp: Date.now()
    };
    
    const userChunks = splitTextIntoChunks(userText);
    const userVectors = await Promise.all(userChunks.map(c => getEmbedding(c)));
    const userChunksWithVectors = userChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: userVectors[i]
    }));
    
    await db.insertMessageWithChunks(userMsgData, userChunksWithVectors);
    console.log(`[Chat] ✅ User 消息已落库: ${userMsgUuid.substring(0, 8)}`);

    // --- 步骤 B: 获取上下文 (模拟 LLM 读取历史) ---
    const context = db.getLineageContext(userMsgUuid);
    console.log(`[Chat] 📜 构建的上下文长度: ${context.length} 字符`);

    // --- 步骤 C: Mock AI 回复 (未来替换为真实的 pi-agent) ---
    await new Promise(resolve => setTimeout(resolve, 800)); // 模拟思考延迟
    const aiText = `✅ 收到！我读取了包含 "${userText.substring(0, 15)}..." 在内的完整上下文 (总长: ${context.length} 字符)。这是 Mock 回复。`;

    // --- 步骤 D: 保存 AI 消息 ---
    const aiMsgUuid = uuidv4();
    const aiMsgData = {
      uuid: aiMsgUuid,
      parent_uuid: userMsgUuid,
      branch: 'main',
      role: 'assistant',
      preview_text: aiText.substring(0, 50),
      full_text: aiText,
      timestamp: Date.now()
    };
    
    const aiChunks = splitTextIntoChunks(aiText);
    const aiVectors = await Promise.all(aiChunks.map(c => getEmbedding(c)));
    const aiChunksWithVectors = aiChunks.map((txt, i) => ({
      chunk_uuid: uuidv4(), text_content: txt, chunk_index: i, vector: aiVectors[i]
    }));
    
    await db.insertMessageWithChunks(aiMsgData, aiChunksWithVectors);
    console.log(`[Chat] ✅ AI 消息已落库: ${aiMsgUuid.substring(0, 8)}\n`);

    // --- 步骤 E: 返回 AI 消息给前端 ---
    return aiMsgData;

  } catch (error) {
    console.error('[Chat] ❌ 处理对话流失败:', error);
    throw error;
  }
});

// 4. 语义搜索 (RAG)
ipcMain.handle('db:search', async (event, queryText, limit = 5) => {
  try {
    const queryVector = await getEmbedding(queryText);
    const results = await db.searchChunks(queryVector, limit);
    return { success: true, results };
  } catch (error) {
    console.error('[Search] ❌ 搜索失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 5. 导出数据 (打包为 JSON)
ipcMain.handle('data:export', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出 GitMindHub 知识库',
    defaultPath: `gitmindhub_backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (canceled || !filePath) return { success: false, message: '用户取消' };

  try {
    const data = await db.exportAllData();
    // 写入文件 (为了可读性使用了格式化，如果数据量极大可以去掉 null, 2)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[Export] ✅ 成功导出至: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('[Export] ❌ 导出失败:', error);
    return { success: false, message: error.message };
  }
});

// 6. 导入数据 (智能判断：合并 or 覆盖)
ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入 GitMindHub 知识库',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  
  if (canceled || !filePaths || filePaths.length === 0) return { success: false, message: '用户取消' };

  try {
    const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
    const data = JSON.parse(fileContent);
    
    // 🌟 检查本地是否有数据
    const localCount = db.getMessageCount();
    let mode = 'overwrite'; // 默认覆盖（如果是空库）

    if (localCount > 0) {
      // 弹出系统对话框让用户选择策略
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['🧩 合并导入 (Merge)', '🔄 覆盖导入 (Overwrite)', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '选择导入模式',
        message: '本地已存在对话数据，请选择如何处理导入的数据？',
        detail: '合并导入：仅添加本地不存在的节点，保留现有数据（推荐）。\n覆盖导入：清空本地所有数据，替换为导入的数据。'
      });

      if (response === 0) mode = 'merge';
      else if (response === 1) mode = 'overwrite';
      else return { success: false, message: '用户取消' };
    }

    // 执行对应的导入逻辑
    if (mode === 'merge') {
      const stats = await db.mergeImportData(data);
      console.log(`[Import] ✅ 合并导入成功:`, stats);
      return { success: true, mode: 'merge', stats };
    } else {
      await db.importAllData(data);
      console.log(`[Import] ✅ 覆盖导入成功`);
      return { success: true, mode: 'overwrite' };
    }

  } catch (error) {
    console.error('[Import] ❌ 导入失败:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('chat:newRoot', async () => {
  console.log('\n[Chat] 🌱 创建全新对话根节点...');
  const rootUuid = uuidv4();
  const rootText = '✨ 全新对话已开始。你可以随时从这里开启新的思路。';
  
  const rootData = {
    uuid: rootUuid,
    parent_uuid: null, // 🌟 关键：没有父节点，这是一个新的 Root
    branch: 'main',
    role: 'assistant',
    preview_text: rootText.substring(0, 50),
    full_text: rootText,
    timestamp: Date.now()
  };

  // 为新根节点生成 Embedding 并存入数据库
  const vector = await getEmbedding(rootText);
  const chunks = [{ 
    chunk_uuid: uuidv4(), 
    text_content: rootText, 
    chunk_index: 0, 
    vector 
  }];
  
  await db.insertMessageWithChunks(rootData, chunks);
  console.log(`[Chat] ✅ 新根节点已创建: ${rootUuid.substring(0, 8)}\n`);
  
  return rootData;
});

// ==========================================
// 🚀 App 生命周期
// ==========================================
app.whenReady().then(async () => {
  try {
    console.log('[App] 🚀 正在探测本地 Qwen Embedding 服务...');
    const testVector = await getEmbedding('dimension probe');
    const dim = testVector.length;
    console.log(`[App] ✅ 服务连接成功！探测到 Embedding 维度: ${dim}`);
    
    // 初始化双数据库 (SQLite + LanceDB)
    await db.initDB(dim);
    
    // 创建窗口
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    console.error('[App] ❌ 致命错误: 无法连接 Qwen Embedding 服务。');
    dialog.showErrorBox('Embedding 服务未就绪', '无法连接到本地 Qwen 服务。\n请确保已运行: python embedding-server/server.py');
    app.quit();
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
})