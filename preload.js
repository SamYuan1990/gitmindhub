// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  platform: process.platform,
  
  // 💬 核心对话 API
  newRoot: () => ipcRenderer.invoke('chat:newRoot'),
  sendMessage: (payload) => ipcRenderer.invoke('chat:message', payload),
  
  // 🗄️ 数据库读取 API
  getAllMessages: () => ipcRenderer.invoke('db:getAllMessages'),
  getContext: (targetUuid) => ipcRenderer.invoke('db:getContext', targetUuid),
  
  // 🔍 语义搜索 API
  searchChunks: (queryText, limit) => ipcRenderer.invoke('db:search', queryText, limit),

  // 📦 导入导出 API
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),

  // ⚙️ 设置 API (支持多 LLM Profile 配置)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  openSettingsFileLocation: () => ipcRenderer.invoke('settings:openFileLocation'),
})