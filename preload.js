const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  platform: process.platform,
  sendMessage: (message) => ipcRenderer.invoke('chat:message', message),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  
  // 🆕 数据库 API
  addChunk: (content, metadata) => ipcRenderer.invoke('db:addChunk', content, metadata),
  searchChunks: (queryText, limit) => ipcRenderer.invoke('db:search', queryText, limit)
})