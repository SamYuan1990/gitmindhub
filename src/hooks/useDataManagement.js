import { useState } from 'react'

export function useDataManagement(onRefresh) {
  const [actionStatus, setActionStatus] = useState('')

  const handleExport = async () => {
    setActionStatus('exporting')
    try {
      const result = await window.gitmindhub.exportData()
      if (result.success) {
        alert(`✅ 导出成功！\n文件已保存至:\n${result.path}`)
        setActionStatus('exported')
      } else {
        if (result.message !== '用户取消') alert(`❌ 导出失败: ${result.message}`)
      }
    } catch (e) {
      alert('导出过程发生异常')
    } finally {
      setTimeout(() => setActionStatus(''), 2000)
    }
  }

  const handleImport = async () => {
    setActionStatus('importing')
    try {
      const result = await window.gitmindhub.importData()
      
      if (result.success) {
        if (result.mode === 'merge') {
          const { messages_added, messages_skipped } = result.stats
          alert(
            `✅ 合并导入成功！\n\n` +
            `🆕 新增节点: ${messages_added} 个\n` +
            `⏭️ 跳过(已存在): ${messages_skipped} 个\n\n` +
            `正在刷新界面...`
          )
        } else {
          alert('✅ 覆盖导入成功！正在刷新界面...')
        }
        
        setActionStatus('imported')
        // 🌟 导入成功后，通知父组件刷新数据
        if (onRefresh) onRefresh()
      } else {
        if (result.message !== '用户取消') {
          alert(`❌ 导入失败: ${result.message}`)
        }
      }
    } catch (e) {
      alert('导入过程发生异常，请检查 JSON 文件格式')
    } finally {
      setTimeout(() => setActionStatus(''), 2000)
    }
  }

  return { actionStatus, handleImport, handleExport }
}
