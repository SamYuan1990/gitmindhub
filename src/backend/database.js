// src/backend/database.js
const lancedb = require('@lancedb/lancedb');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const DB_DIR = process.env.NODE_ENV === 'development' 
  ? path.join(process.cwd(), 'gitmindhub_data') 
  : path.join(app.getPath('userData'), 'gitmindhub_data');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const SQLITE_PATH = path.join(DB_DIR, 'metadata.sqlite');
const LANCE_DIR = path.join(DB_DIR, 'lancedb');

let sqliteDb = null;
let lanceDb = null;
let lanceTable = null;

async function initDB(embeddingDim = 1024) {
  if (sqliteDb && lanceTable) return;

  sqliteDb = new Database(SQLITE_PATH);
  sqliteDb.pragma('journal_mode = WAL');
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

  // 🌟 平滑升级：为 messages 表增加模型元数据字段
  try { sqliteDb.exec(`ALTER TABLE messages ADD COLUMN llm_profile_id TEXT`); } catch (e) {}
  try { sqliteDb.exec(`ALTER TABLE messages ADD COLUMN model_provider TEXT`); } catch (e) {}
  try { sqliteDb.exec(`ALTER TABLE messages ADD COLUMN model_id TEXT`); } catch (e) {}

  console.log('[DB] ✅ SQLite 初始化/升级完成');

  lanceDb = await lancedb.connect(LANCE_DIR);
  try {
    lanceTable = await lanceDb.openTable('chunks_vector');
  } catch (e) {
    lanceTable = await lanceDb.createTable('chunks_vector', [
      { chunk_uuid: 'init_placeholder', vector: new Array(embeddingDim).fill(0) }
    ]);
    await lanceTable.delete("chunk_uuid = 'init_placeholder'");
  }
}

function getAllMessages() {
  if (!sqliteDb) return [];
  return sqliteDb.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
}

function getLineageContext(targetUuid) {
  const msgStmt = sqliteDb.prepare('SELECT * FROM messages WHERE uuid = ?');
  const chunkStmt = sqliteDb.prepare('SELECT text_content FROM chunks_meta WHERE conversation_uuid = ? ORDER BY chunk_index ASC');
  
  const lineage = [];
  let currentUuid = targetUuid;
  
  while (currentUuid) {
    const msg = msgStmt.get(currentUuid);
    if (!msg) break;
    lineage.unshift(msg);
    currentUuid = msg.parent_uuid;
  }
  
  const messages = [];
  for (const msg of lineage) {
    const chunks = chunkStmt.all(msg.uuid);
    const msgText = chunks.map(c => c.text_content).join('\n');
    messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msgText });
  }
  return messages;
}

// 🌟 修改：支持传入 modelInfo
function insertMessageWithChunks(message, chunksWithVectors, modelInfo = null) {
  const insertMsg = sqliteDb.prepare(`
    INSERT INTO messages (uuid, parent_uuid, branch, role, preview_text, full_text, timestamp, llm_profile_id, model_provider, model_id)
    VALUES (@uuid, @parent_uuid, @branch, @role, @preview_text, @full_text, @timestamp, @llm_profile_id, @model_provider, @model_id)
  `);
  
  const insertChunkMeta = sqliteDb.prepare(`
    INSERT INTO chunks_meta (chunk_uuid, conversation_uuid, chunk_index, text_content)
    VALUES (@chunk_uuid, @conversation_uuid, @chunk_index, @text_content)
  `);

  const transaction = sqliteDb.transaction(() => {
    insertMsg.run({
      ...message,
      llm_profile_id: modelInfo?.profileId || null,
      model_provider: modelInfo?.provider || null,
      model_id: modelInfo?.modelId || null
    });
    for (const chunk of chunksWithVectors) {
      insertChunkMeta.run({
        chunk_uuid: chunk.chunk_uuid,
        conversation_uuid: message.uuid,
        chunk_index: chunk.chunk_index,
        text_content: chunk.text_content
      });
    }
  });

  transaction(); 

  return lanceTable.add(chunksWithVectors.map(c => ({
    chunk_uuid: c.chunk_uuid,
    vector: c.vector
  })));
}

// ... (searchChunks, getMessageCount, mergeImportData, exportAllData, importAllData 保持原样，因为 SELECT * 会自动包含新字段) ...
function searchChunks(queryVector, limit = 5) {
  return lanceTable.search(queryVector).limit(limit).toArray().then(results => {
    const chunkStmt = sqliteDb.prepare('SELECT * FROM chunks_meta WHERE chunk_uuid = ?');
    return results.map(r => {
      const meta = chunkStmt.get(r.chunk_uuid);
      return { chunk_uuid: r.chunk_uuid, conversation_uuid: meta?.conversation_uuid || 'unknown', text_content: meta?.text_content || '', distance: r._distance };
    });
  });
}

function getMessageCount() {
  if (!sqliteDb) return 0;
  return sqliteDb.prepare('SELECT COUNT(*) as count FROM messages').get().count;
}

async function mergeImportData(data) {
  if (!data.messages || !data.chunks) throw new Error('无效的导入文件格式');
  const localMsgUuids = new Set(sqliteDb.prepare('SELECT uuid FROM messages').all().map(r => r.uuid));
  const localChunkUuids = new Set(sqliteDb.prepare('SELECT chunk_uuid FROM chunks_meta').all().map(r => r.chunk_uuid));
  const newMessages = data.messages.filter(m => !localMsgUuids.has(m.uuid));
  const newChunks = data.chunks.filter(c => !localChunkUuids.has(c.chunk_uuid));
  const importingMsgUuids = new Set(newMessages.map(m => m.uuid));

  const processedMessages = newMessages.map(m => {
    if (m.parent_uuid && !localMsgUuids.has(m.parent_uuid) && !importingMsgUuids.has(m.parent_uuid)) {
      return { ...m, parent_uuid: null };
    }
    return m;
  });

  const validChunkUuids = new Set();
  const processedChunks = newChunks.filter(c => {
    if (localMsgUuids.has(c.conversation_uuid) || importingMsgUuids.has(c.conversation_uuid)) {
      validChunkUuids.add(c.chunk_uuid);
      return true;
    }
    return false;
  });

  const insertMsg = sqliteDb.prepare(`
    INSERT OR IGNORE INTO messages (uuid, parent_uuid, branch, role, preview_text, full_text, timestamp, llm_profile_id, model_provider, model_id)
    VALUES (@uuid, @parent_uuid, @branch, @role, @preview_text, @full_text, @timestamp, @llm_profile_id, @model_provider, @model_id)
  `);
  
  const insertChunkMeta = sqliteDb.prepare(`
    INSERT OR IGNORE INTO chunks_meta (chunk_uuid, conversation_uuid, chunk_index, text_content)
    VALUES (@chunk_uuid, @conversation_uuid, @chunk_index, @text_content)
  `);

  sqliteDb.transaction(() => {
    for (const msg of processedMessages) insertMsg.run(msg);
    for (const chunk of processedChunks) insertChunkMeta.run(chunk);
  })();

  const vectorsToInsert = processedChunks.filter(c => c.vector && c.vector.length > 0 && validChunkUuids.has(c.chunk_uuid)).map(c => ({ chunk_uuid: c.chunk_uuid, vector: c.vector }));
  if (vectorsToInsert.length > 0) await lanceTable.add(vectorsToInsert);

  return { messages_added: processedMessages.length, chunks_added: processedChunks.length };
}

async function exportAllData() {
  const messages = sqliteDb.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
  const chunksMeta = sqliteDb.prepare('SELECT * FROM chunks_meta ORDER BY chunk_index ASC').all();
  const allVectors = await lanceTable.query().limit(100000).toArray();
  const vectorMap = new Map(allVectors.map(v => [v.chunk_uuid, v.vector]));
  const chunks = chunksMeta.map(c => ({ ...c, vector: vectorMap.get(c.chunk_uuid) || [] }));
  return { version: '1.1', exported_at: Date.now(), messages, chunks };
}

async function importAllData(data) {
  if (!data.messages || !data.chunks) throw new Error('无效的导入文件格式');
  sqliteDb.exec('DELETE FROM chunks_meta; DELETE FROM messages;');
  await lanceTable.delete('chunk_uuid IS NOT NULL');

  const insertMsg = sqliteDb.prepare(`
    INSERT INTO messages (uuid, parent_uuid, branch, role, preview_text, full_text, timestamp, llm_profile_id, model_provider, model_id)
    VALUES (@uuid, @parent_uuid, @branch, @role, @preview_text, @full_text, @timestamp, @llm_profile_id, @model_provider, @model_id)
  `);
  const insertChunkMeta = sqliteDb.prepare(`
    INSERT INTO chunks_meta (chunk_uuid, conversation_uuid, chunk_index, text_content)
    VALUES (@chunk_uuid, @conversation_uuid, @chunk_index, @text_content)
  `);

  sqliteDb.transaction(() => {
    for (const msg of data.messages) insertMsg.run(msg);
    for (const chunk of data.chunks) insertChunkMeta.run(chunk);
  })();

  const vectorsToInsert = data.chunks.filter(c => c.vector && c.vector.length > 0).map(c => ({ chunk_uuid: c.chunk_uuid, vector: c.vector }));
  if (vectorsToInsert.length > 0) await lanceTable.add(vectorsToInsert);
}

module.exports = { initDB, getAllMessages, getLineageContext, insertMessageWithChunks, searchChunks, exportAllData, importAllData, getMessageCount, mergeImportData };