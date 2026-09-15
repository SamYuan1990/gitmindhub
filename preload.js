const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  platform: process.platform,
  // 暴露给前端的异步通信方法
  sendMessage: (message) => ipcRenderer.invoke('chat:message', message)
})