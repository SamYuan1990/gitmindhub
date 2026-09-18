const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  platform: process.platform,
  
  newRoot: () => ipcRenderer.invoke('chat:newRoot'),
  // 🌟 核心对话 API (对应 main.js 的 'chat:message')
  sendMessage: (payload) => ipcRenderer.invoke('chat:message', payload),
  
  // 🌟 数据库读取 API
  getAllMessages: () => ipcRenderer.invoke('db:getAllMessages'),
  getContext: (targetUuid) => ipcRenderer.invoke('db:getContext', targetUuid),
  
  // 🌟 语义搜索 API
  searchChunks: (queryText, limit) => ipcRenderer.invoke('db:search', queryText, limit),
  
  // 🌟 设置与其他 (保留原有)
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // 📦 导入导出 API
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
})