const lancedb = require('@lancedb/lancedb');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// 📂 数据存储根目录
const DB_DIR = process.env.NODE_ENV === 'development' 
  ? path.join(process.cwd(), 'gitmindhub_data') 
  : path.join(app.getPath('userData'), 'gitmindhub_data');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const SQLITE_PATH = path.join(DB_DIR, 'metadata.sqlite');
const LANCE_DIR = path.join(DB_DIR, 'lancedb');

let sqliteDb = null;
let lanceDb = null;
let lanceTable = null;

// ==========================================
// 🚀 初始化
// ==========================================
async function initDB(embeddingDim = 1024) {
  if (sqliteDb && lanceTable) return;

  console.log(`[DB] 📂 数据目录: ${DB_DIR}`);

  // 1. 初始化 SQLite (关系型数据)
  sqliteDb = new Database(SQLITE_PATH);
  sqliteDb.pragma('journal_mode = WAL'); // 提升并发性能
  sqliteDb.pragma('foreign_keys = ON');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      uuid TEXT PRIMARY KEY,
      parent_uuid TEXT,
      branch TEXT DEFAULT 'main',
      role TEXT,
      preview_text TEXT,
      full_text TEXT,
      timestamp INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS chunks_meta (
      chunk_uuid TEXT PRIMARY KEY,
      conversation_uuid TEXT,
      chunk_index INTEGER,
      text_content TEXT,
      FOREIGN KEY(conversation_uuid) REFERENCES messages(uuid) ON DELETE CASCADE
    );
  `);
  console.log('[DB] ✅ SQLite 初始化完成');

  // 2. 初始化 LanceDB (向量数据)
  lanceDb = await lancedb.connect(LANCE_DIR);
  try {
    lanceTable = await lanceDb.openTable('chunks_vector');
    console.log('[DB] ✅ LanceDB 加载现有表');
  } catch (e) {
    console.log('[DB] 🛠️ LanceDB 创建新表');
    // 创建一个占位符然后删除，以初始化表结构
    lanceTable = await lanceDb.createTable('chunks_vector', [
      { chunk_uuid: 'init_placeholder', vector: new Array(embeddingDim).fill(0) }
    ]);
    await lanceTable.delete("chunk_uuid = 'init_placeholder'");
  }
}

// ==========================================
// 📝 核心操作
// ==========================================

// 1. 获取所有消息 (用于前端渲染 DAG)
function getAllMessages() {
  if (!sqliteDb) return [];
  const stmt = sqliteDb.prepare('SELECT * FROM messages ORDER BY timestamp ASC');
  return stmt.all();
}

// 2. 获取某个节点向上的完整上下文 (用于发送给 LLM)
function getLineageContext(targetUuid) {
  const msgStmt = sqliteDb.prepare('SELECT * FROM messages WHERE uuid = ?');
  const chunkStmt = sqliteDb.prepare('SELECT text_content FROM chunks_meta WHERE conversation_uuid = ? ORDER BY chunk_index ASC');
  
  const lineage = [];
  let currentUuid = targetUuid;
  
  // 递归向上查找 parent_uuid，直到 root
  while (currentUuid) {
    const msg = msgStmt.get(currentUuid);
    if (!msg) break;
    lineage.unshift(msg); // 插入头部，保证从 root 到 target 的顺序
    currentUuid = msg.parent_uuid;
  }
  
  // 拼装完整文本上下文
  let fullContext = '';
  for (const msg of lineage) {
    const chunks = chunkStmt.all(msg.uuid);
    const msgText = chunks.map(c => c.text_content).join('\n');
    fullContext += `[${msg.role}]: ${msgText}\n\n`;
  }
  
  return fullContext;
}

// 3. 保存新消息及其 Chunks (事务操作，保证一致性)
function insertMessageWithChunks(message, chunksWithVectors) {
  const insertMsg = sqliteDb.prepare(`
    INSERT INTO messages (uuid, parent_uuid, branch, role, preview_text, full_text, timestamp)
    VALUES (@uuid, @parent_uuid, @branch, @role, @preview_text, @full_text, @timestamp)
  `);
  
  const insertChunkMeta = sqliteDb.prepare(`
    INSERT INTO chunks_meta (chunk_uuid, conversation_uuid, chunk_index, text_content)
    VALUES (@chunk_uuid, @conversation_uuid, @chunk_index, @text_content)
  `);

  const transaction = sqliteDb.transaction(() => {
    insertMsg.run(message);
    for (const chunk of chunksWithVectors) {
      insertChunkMeta.run({
        chunk_uuid: chunk.chunk_uuid,
        conversation_uuid: message.uuid,
        chunk_index: chunk.chunk_index,
        text_content: chunk.text_content
      });
    }
  });

  transaction(); // 执行 SQLite 事务

  // 异步插入 LanceDB 向量
  return lanceTable.add(chunksWithVectors.map(c => ({
    chunk_uuid: c.chunk_uuid,
    vector: c.vector
  })));
}

// 4. 向量搜索
async function searchChunks(queryVector, limit = 5) {
  const results = await lanceTable.search(queryVector).limit(limit).toArray();
  
  // 拿到 chunk_uuid 后，去 SQLite 查原文
  const chunkStmt = sqliteDb.prepare('SELECT * FROM chunks_meta WHERE chunk_uuid = ?');
  
  return results.map(r => {
    const meta = chunkStmt.get(r.chunk_uuid);
    return {
      chunk_uuid: r.chunk_uuid,
      conversation_uuid: meta?.conversation_uuid || 'unknown',
      text_content: meta?.text_content || '',
      distance: r._distance
    };
  });
}

// ==========================================
// 📦 导入导出功能
// ==========================================

// 辅助方法：获取本地消息总数（用于判断是否需要询问合并策略）
function getMessageCount() {
  if (!sqliteDb) return 0;
  return sqliteDb.prepare('SELECT COUNT(*) as count FROM messages').get().count;
}

// 🌟 核心新增：智能合并导入 (Merge)
async function mergeImportData(data) {
  if (!data.messages || !data.chunks) {
    throw new Error('无效的导入文件格式：缺少 messages 或 chunks 字段');
  }

  console.log('[DB] 🧩 开始智能合并导入...');

  // 1. 获取本地现有的所有 UUID 集合 (用于 O(1) 快速查重)
  const localMsgUuids = new Set(sqliteDb.prepare('SELECT uuid FROM messages').all().map(r => r.uuid));
  const localChunkUuids = new Set(sqliteDb.prepare('SELECT chunk_uuid FROM chunks_meta').all().map(r => r.chunk_uuid));

  // 2. 过滤出本地不存在的“新”数据
  const newMessages = data.messages.filter(m => !localMsgUuids.has(m.uuid));
  const newChunks = data.chunks.filter(c => !localChunkUuids.has(c.chunk_uuid));
  
  // 构建本次即将导入的 Message UUID 集合 (用于校验外键)
  const importingMsgUuids = new Set(newMessages.map(m => m.uuid));

  // 3. 处理外键依赖：修复悬空的 parent_uuid
  const processedMessages = newMessages.map(m => {
    // 如果父节点既不在本地，也不在本次导入列表中，则截断树枝，使其成为新的根节点
    if (m.parent_uuid && !localMsgUuids.has(m.parent_uuid) && !importingMsgUuids.has(m.parent_uuid)) {
      console.warn(`[Merge] ⚠️ 消息 ${m.uuid.substring(0,8)} 的父节点不存在，已截断为根节点。`);
      return { ...m, parent_uuid: null };
    }
    return m;
  });

  // 4. 处理外键依赖：丢弃孤儿 Chunk
  const validChunkUuids = new Set();
  const processedChunks = newChunks.filter(c => {
    // 只有当关联的 Message 在本地存在，或者在本次导入列表中时，才保留该 Chunk
    if (localMsgUuids.has(c.conversation_uuid) || importingMsgUuids.has(c.conversation_uuid)) {
      validChunkUuids.add(c.chunk_uuid);
      return true;
    }
    console.warn(`[Merge] ⚠️ 丢弃孤儿 Chunk ${c.chunk_uuid.substring(0,8)}，关联的 Message 不存在。`);
    return false;
  });

  // 5. 执行 SQLite 事务插入 (使用 INSERT OR IGNORE 作为双重保险)
  const insertMsg = sqliteDb.prepare(`
    INSERT OR IGNORE INTO messages (uuid, parent_uuid, branch, role, preview_text, full_text, timestamp)
    VALUES (@uuid, @parent_uuid, @branch, @role, @preview_text, @full_text, @timestamp)
  `);
  
  const insertChunkMeta = sqliteDb.prepare(`
    INSERT OR IGNORE INTO chunks_meta (chunk_uuid, conversation_uuid, chunk_index, text_content)
    VALUES (@chunk_uuid, @conversation_uuid, @chunk_index, @text_content)
  `);

  const transaction = sqliteDb.transaction(() => {
    for (const msg of processedMessages) insertMsg.run(msg);
    for (const chunk of processedChunks) {
      insertChunkMeta.run({
        chunk_uuid: chunk.chunk_uuid,
        conversation_uuid: chunk.conversation_uuid,
        chunk_index: chunk.chunk_index,
        text_content: chunk.text_content
      });
    }
  });

  transaction(); 
  console.log(`[DB] ✅ SQLite 合并完成: 新增 ${processedMessages.length} 条消息, ${processedChunks.length} 个 Chunks`);

  // 6. 恢复 LanceDB 向量数据 (只插入有效的 chunk 向量)
  const vectorsToInsert = processedChunks
    .filter(c => c.vector && c.vector.length > 0 && validChunkUuids.has(c.chunk_uuid))
    .map(c => ({ chunk_uuid: c.chunk_uuid, vector: c.vector }));

  if (vectorsToInsert.length > 0) {
    await lanceTable.add(vectorsToInsert);
    console.log(`[DB] ✅ LanceDB 向量合并完成: ${vectorsToInsert.length} 条`);
  }

  // 返回合并统计信息
  return {
    messages_added: processedMessages.length,
    chunks_added: processedChunks.length,
    messages_skipped: data.messages.length - processedMessages.length,
    chunks_skipped: data.chunks.length - processedChunks.length
  };
}

async function exportAllData() {
  console.log('[DB] 📦 开始导出数据...');
  
  // 1. 导出 SQLite 中的关系数据
  const messages = sqliteDb.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
  const chunksMeta = sqliteDb.prepare('SELECT * FROM chunks_meta ORDER BY chunk_index ASC').all();
  
  // 2. 导出 LanceDB 中的向量数据
  // 使用 query() 获取所有行（包含 vector 列），限制 100000 条防止内存溢出
  const allVectors = await lanceTable.query().limit(100000).toArray();
  const vectorMap = new Map(allVectors.map(v => [v.chunk_uuid, v.vector]));

  // 3. 组装数据：将向量与 chunk 元数据合并
  const chunks = chunksMeta.map(c => ({
    chunk_uuid: c.chunk_uuid,
    conversation_uuid: c.conversation_uuid,
    chunk_index: c.chunk_index,
    text_content: c.text_content,
    vector: vectorMap.get(c.chunk_uuid) || [] // 如果找不到向量，给个空数组兜底
  }));

  console.log(`[DB] ✅ 导出完成: ${messages.length} 条消息, ${chunks.length} 个 Chunks`);
  
  return {
    version: '1.0',
    exported_at: Date.now(),
    messages,
    chunks
  };
}

async function importAllData(data) {
  if (!data.messages || !data.chunks) {
    throw new Error('无效的导入文件格式：缺少 messages 或 chunks 字段');
  }

  console.log('[DB] 📥 开始导入数据 (全量覆盖模式)...');

  // 1. 清空 SQLite (注意顺序：先删子表，再删主表，避免外键冲突)
  sqliteDb.exec('DELETE FROM chunks_meta; DELETE FROM messages;');
  
  // 2. 清空 LanceDB (删除所有行)
  await lanceTable.delete('chunk_uuid IS NOT NULL');

  // 3. 开启 SQLite 事务，批量写入
  const insertMsg = sqliteDb.prepare(`
    INSERT INTO messages (uuid, parent_uuid, branch, role, preview_text, full_text, timestamp)
    VALUES (@uuid, @parent_uuid, @branch, @role, @preview_text, @full_text, @timestamp)
  `);
  
  const insertChunkMeta = sqliteDb.prepare(`
    INSERT INTO chunks_meta (chunk_uuid, conversation_uuid, chunk_index, text_content)
    VALUES (@chunk_uuid, @conversation_uuid, @chunk_index, @text_content)
  `);

  const transaction = sqliteDb.transaction(() => {
    for (const msg of data.messages) {
      insertMsg.run(msg);
    }
    for (const chunk of data.chunks) {
      insertChunkMeta.run({
        chunk_uuid: chunk.chunk_uuid,
        conversation_uuid: chunk.conversation_uuid,
        chunk_index: chunk.chunk_index,
        text_content: chunk.text_content
      });
    }
  });

  transaction(); // 执行 SQLite 写入
  console.log('[DB] ✅ SQLite 数据恢复完成');

  // 4. 恢复 LanceDB 向量数据
  if (data.chunks.length > 0) {
    const vectorsToInsert = data.chunks
      .filter(c => c.vector && c.vector.length > 0) // 过滤掉没有向量的脏数据
      .map(c => ({ chunk_uuid: c.chunk_uuid, vector: c.vector }));
      
    if (vectorsToInsert.length > 0) {
      await lanceTable.add(vectorsToInsert);
      console.log(`[DB] ✅ LanceDB 向量恢复完成: ${vectorsToInsert.length} 条`);
    }
  }
}

module.exports = { 
  initDB, 
  getAllMessages, 
  getLineageContext, 
  insertMessageWithChunks, 
  searchChunks,
  exportAllData,    // 🆕
  importAllData,     // 🆕
  getMessageCount,  // 🆕
  mergeImportData   // 🆕
};