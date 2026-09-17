import React, { useState, useRef, useEffect } from 'react'
import DagView from './DagView'

function App() {
  const [viewMode, setViewMode] = useState('chat')
  
  // 核心对话状态
  const [messages, setMessages] = useState([
    { id: 'root', parentId: null, role: 'assistant', content: '你好！我是 GitMindHub。试着问我点什么，或者点击顶部的“语义查找”体验基于 Qwen 的本地 RAG。', timestamp: new Date().toLocaleTimeString(), branch: 'main' }
  ])
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // 查找 (语义搜索) 状态
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  // 设置状态
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({ model: 'mock-gpt-4', temperature: 0.7, systemPrompt: 'You are helpful.' })
  const [saveStatus, setSaveStatus] = useState('')
  
  // 导入/导出/同步状态
  const [actionStatus, setActionStatus] = useState('')
  const [syncStatus, setSyncStatus] = useState('')

  useEffect(() => {
    if (viewMode === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, viewMode])

  // ================= 业务逻辑 =================

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsgContent = input.trim()
    const newId = `msg_${Date.now()}`
    const lastMsg = messages[messages.length - 1]
    
    const userMsg = { id: newId, parentId: lastMsg.id, role: 'user', content: userMsgContent, timestamp: new Date().toLocaleTimeString(), branch: 'main' }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const response = await window.gitmindhub.sendMessage(userMsgContent)
      const aiMsg = { id: `ai_${Date.now()}`, parentId: newId, role: 'assistant', content: response.content, timestamp: response.timestamp, branch: 'main' }
      setMessages(prev => [...prev, aiMsg])
    } catch (error) {
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, parentId: newId, role: 'assistant', content: '❌ Error: 无法连接到后端。', timestamp: new Date().toLocaleTimeString(), branch: 'main' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

    const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchResults([])
    try {
      const res = await window.gitmindhub.searchChunks(searchQuery, 5)
      if (res.success) {
        setSearchResults(res.results)
      } else {
        console.error('Search failed:', res.error)
        alert(`搜索失败: ${res.error}\n\n请检查终端日志，或尝试删除 gitmindhub_data 文件夹重启应用。`)
      }
    } catch (e) {
      console.error('Search exception:', e)
    } finally {
      setIsSearching(false)
    }
  }

  // 🆕 优化：同步当前对话到知识库
  const handleSyncToKnowledgeBase = async () => {
    setSyncStatus('syncing')
    let successCount = 0
    let skipCount = 0
    
    // 放宽条件：只要不是 root 且内容不为空
    const validMessages = messages.filter(m => m.id !== 'root' && m.content.trim().length > 0)
    
    if (validMessages.length === 0) {
      setSyncStatus('')
      alert('当前没有可同步的对话内容，请先在聊天框发几条消息吧！')
      return
    }

    for (const msg of validMessages) {
      const res = await window.gitmindhub.addChunk(msg.content, { 
        role: msg.role, 
        branch: msg.branch, 
        timestamp: msg.timestamp 
      })
      if (res.success) {
        successCount++
      } else {
        skipCount++ // 通常是因为 Hash 冲突（内容已存在）
      }
    }
    
    setSyncStatus('synced')
    setTimeout(() => setSyncStatus(''), 2000)
    alert(`同步完成！\n✅ 新增: ${successCount} 个段落\n⏭️ 跳过(已存在): ${skipCount} 个段落`)
  }

  // 🆕 新增：一键注入测试数据（方便立刻测试搜索）
  const handleInjectTestData = async () => {
    console.log('[Frontend] 🚀 ================= 开始注入测试数据 =================');
    setSyncStatus('syncing')
    const testTexts = [
      "GitMindHub 是一个支持 Git 风格上下文管理的 AI 对话工具，核心亮点是 DAG 可视化。",
      "LanceDB 是一个完全本地化、无服务器的向量数据库，底层使用 Lance 列式存储格式。",
      "段落级别的 RAG 切片可以有效保留上下文的语义完整性，避免句子被截断。",
      "主键使用内容的 SHA-256 Hash 可以完美避免重复存储相同的知识块，节省空间。",
      "React Flow 是一个非常强大的 React 库，用于快速构建节点连线图和 DAG 结构。"
    ]
    let count = 0
    for (const text of testTexts) {
      console.log(`[Frontend] 📤 发送 IPC 请求 (addChunk): ${text.substring(0, 20)}...`);
      const res = await window.gitmindhub.addChunk(text, { source: 'test_data', timestamp: new Date().toISOString() })
      console.log(`[Frontend] 📥 收到 IPC 响应:`, res);
      if (res.success) count++
    }
    setSyncStatus('synced')
    setTimeout(() => setSyncStatus(''), 2000)
    console.log(`[Frontend] 🏁 注入完成，成功: ${count} 条`);
    alert(`✅ 成功注入 ${count} 条测试数据到本地知识库！`)
  }

  const handleImport = async () => {
    setActionStatus('importing')
    const result = await window.gitmindhub.importData()
    if (result.success) { setMessages(result.data); setViewMode('dag'); setActionStatus('imported'); setTimeout(() => setActionStatus(''), 2000) }
  }
  const handleExport = async () => {
    setActionStatus('exporting')
    const result = await window.gitmindhub.exportData(messages)
    if (result.success) { setActionStatus('exported'); setTimeout(() => setActionStatus(''), 2000) }
  }
  const handleSaveSettings = async () => {
    setSaveStatus('saving')
    await window.gitmindhub.updateSettings(settings)
    setSaveStatus('saved')
    setTimeout(() => { setSaveStatus(''); setShowSettings(false) }, 1000)
  }

  // ================= 样式常量 =================
  const navBtn = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }
  const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }
  const modalBox = { background: '#ffffff', borderRadius: '12px', width: '600px', maxHeight: '80vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  // ================= 渲染 =================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', color: '#111827' }}>
      
      {/* 顶部导航栏 */}
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🌳</span>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>GitMindHub</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleImport} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            📥 导入 {actionStatus === 'importing' && '...'} {actionStatus === 'imported' && '✓'}
          </button>
          <button onClick={handleExport} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            📤 导出 {actionStatus === 'exporting' && '...'} {actionStatus === 'exported' && '✓'}
          </button>
          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }}></div>
          
          <button onClick={() => setViewMode(viewMode === 'chat' ? 'dag' : 'chat')} style={{ ...navBtn, background: viewMode === 'dag' ? '#eff6ff' : '#fff', borderColor: viewMode === 'dag' ? '#3b82f6' : '#e5e7eb', color: viewMode === 'dag' ? '#2563eb' : '#374151', fontWeight: '600' }}>
            {viewMode === 'chat' ? '🕸️ DAG' : '💬 对话'}
          </button>
          
          <button onClick={() => setShowSearch(true)} style={{...navBtn, background: '#f0fdf4', borderColor: '#10b981', color: '#065f46', fontWeight: '600'}} onMouseEnter={e => e.currentTarget.style.background='#dcfce7'} onMouseLeave={e => e.currentTarget.style.background='#f0fdf4'}>
            🧠 语义查找
          </button>
          
          <button onClick={() => setShowSettings(true)} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>⚙️ 设置</button>
        </div>
      </header>

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'chat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%', padding: '12px 16px', borderRadius: '12px', background: msg.role === 'user' ? '#3b82f6' : '#ffffff', color: msg.role === 'user' ? '#ffffff' : '#1f2937', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {msg.content}
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '6px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.timestamp}</div>
                </div>
              ))}
              {isLoading && <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', color: '#6b7280' }}>🤔 AI 正在思考...</div>}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '12px', maxWidth: '900px', margin: '0 auto' }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入消息..." style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none', height: '56px', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }} disabled={isLoading} />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} style={{ padding: '0 24px', borderRadius: '8px', border: 'none', background: (isLoading || !input.trim()) ? '#9ca3af' : '#3b82f6', color: '#ffffff', fontWeight: '600', cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer' }}>发送</button>
              </div>
            </div>
          </div>
        ) : (
          <DagView messages={messages} />
        )}
      </main>

      {/* ================= 🧠 语义查找 Modal ================= */}
      {showSearch && (
        <div style={modalOverlay} onClick={() => setShowSearch(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 本地知识库语义查找 
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '10px', fontWeight: 'normal' }}>Powered by Qwen</span>
              </h3>
              <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* 搜索区 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="输入自然语言查询 (例如: '如何管理上下文' 或 '本地数据库')..." 
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSemanticSearch() }}
                  autoFocus
                />
                <button 
                  onClick={handleSemanticSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '600', cursor: 'pointer', minWidth: '80px' }}
                >
                  {isSearching ? '检索中...' : '🔍 搜索'}
                </button>
              </div>

              {/* 辅助操作区 */}
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #d1d5db' }}>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>💡 需先将内容存入知识库才能被搜到。</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handleInjectTestData}
                    disabled={syncStatus === 'syncing'}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #8b5cf6', background: '#f5f3ff', color: '#5b21b6', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    🧪 注入测试数据
                  </button>
                  <button 
                    onClick={handleSyncToKnowledgeBase}
                    disabled={syncStatus === 'syncing'}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #10b981', background: syncStatus === 'synced' ? '#10b981' : '#ecfdf5', color: syncStatus === 'synced' ? '#fff' : '#065f46', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {syncStatus === 'syncing' ? '同步中...' : syncStatus === 'synced' ? '✓ 已同步' : '📥 同步当前对话'}
                  </button>
                </div>
              </div>

              {/* 结果展示区 */}
              <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                {searchResults.length === 0 && !isSearching && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔎</div>
                    <p>输入关键字进行语义搜索，或先点击“注入测试数据”。</p>
                  </div>
                )}
                
                {searchResults.map((r, idx) => (
                  <div key={r.id} style={{ padding: '14px', marginBottom: '10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace' }}>Hash: {r.id.substring(0, 16)}...</span>
                      <span style={{ color: '#3b82f6', fontWeight: '700', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        Distance: {r.distance.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#111827' }}>{r.content}</div>
                    {r.metadata && r.metadata.branch && (
                      <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#9ca3af' }}>
                        来源分支: {r.metadata.branch} | 角色: {r.metadata.role}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 设置 Modal ================= */}
      {showSettings && (
        <div style={modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⚙️ 应用设置</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>AI 模型</label>
                <select value={settings.model} onChange={e => setSettings({...settings, model: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                  <option value="mock-gpt-4">Mock GPT-4</option>
                  <option value="mock-gpt-3.5">Mock GPT-3.5</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
                  <span>Temperature</span><span style={{ color: '#3b82f6' }}>{settings.temperature}</span>
                </label>
                <input type="range" min="0" max="1" step="0.1" value={settings.temperature} onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowSettings(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveSettings} disabled={saveStatus === 'saving'} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: saveStatus === 'saved' ? '#10b981' : '#3b82f6', color: '#fff', fontWeight: '600', cursor: 'pointer', minWidth: '80px' }}>
                {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 已保存' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App