const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  platform: process.platform,
  sendMessage: (message) => ipcRenderer.invoke('chat:message', message),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  // 新增：导入导出
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import')
})