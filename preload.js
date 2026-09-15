const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  platform: process.platform,
  // 聊天通信
  sendMessage: (message) => ipcRenderer.invoke('chat:message', message),
  // 新增：更新全局设置
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings)
})