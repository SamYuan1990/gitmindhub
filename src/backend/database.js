const lancedb = require('@lancedb/lancedb');
const crypto = require('crypto');
const path = require('path');
const { app } = require('electron');

const DB_URI = process.env.NODE_ENV === 'development' 
  ? path.join(process.cwd(), 'gitmindhub_data') 
  : path.join(app.getPath('userData'), 'gitmindhub_data'); 

let db = null;
let table = null;

async function initDB(embeddingDim = 1024) {
  if (db && table) return table;

  console.log(`[Database] 初始化本地向量数据库 (维度: ${embeddingDim})...`);
  console.log(`[Database] 数据存储路径: ${DB_URI}`);
  
  db = await lancedb.connect(DB_URI);

  try {
    table = await db.openTable('context_chunks');
    console.log('[Database] ✅ 成功加载现有表: context_chunks');
  } catch (e) {
    console.log('[Database] 创建新表: context_chunks');
    table = await db.createTable('context_chunks', [
      { id: 'init_1', content: '初始化占位符', vector: new Array(embeddingDim).fill(0), metadata: JSON.stringify({ source: 'system' }) }
    ]);
    await table.delete("id = 'init_1'");
    console.log('[Database] ✅ 成功创建新表 (使用默认暴力搜索模式)');
  }

  return table;
}

function computeHash(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

async function addChunk(content, vector, metadata = {}) {
  await initDB();
  const id = computeHash(content);

  // 🚨 核心修复点：使用 query() 代替 search() 进行标量查询
  const existing = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (existing.length > 0) {
    console.log(`[Database] ⚠️ Chunk 已存在，跳过: ${id.substring(0, 8)}...`);
    return { success: false, message: 'Chunk already exists', id };
  }

  await table.add([{ id, content, vector, metadata: JSON.stringify(metadata) }]);
  console.log(`[Database] ✅ 成功添加 Chunk: ${id.substring(0, 8)}... (内容: "${content.substring(0, 20)}...")`);
  return { success: true, id };
}

async function searchChunks(queryVector, limit = 5) {
  await initDB();
  
  const totalRows = await table.countRows();
  console.log(`[Database] 🔍 开始搜索。当前表总行数: ${totalRows}`);
  
  if (totalRows === 0) {
    console.warn('[Database] ⚠️ 表是空的！无法搜索。');
    return [];
  }

  try {
    console.log(`[Database] 🔍 查询向量维度: ${queryVector.length}`);
    // 向量搜索依然使用 search()，这是正确的
    const results = await table.search(queryVector).limit(limit).toArray();
    console.log(`[Database] ✅ 向量搜索成功，返回 ${results.length} 条结果`);
    
    return results.map(row => ({
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      distance: row._distance 
    }));
  } catch (err) {
    console.error(`[Database] ❌ 向量搜索失败:`, err.message);
    throw err;
  }
}

module.exports = { initDB, addChunk, searchChunks, computeHash };