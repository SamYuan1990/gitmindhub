const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('gitmindhub', {
  // 后续在这里暴露安全的 API 给渲染进程
  platform: process.platform
})
