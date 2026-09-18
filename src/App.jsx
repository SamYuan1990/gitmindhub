import React, { useState, useRef, useEffect, useMemo } from 'react'
import DagView from './DagView'

function App() {
  // ==========================================
  // 🧠 核心状态管理
  // ==========================================
  const [viewMode, setViewMode] = useState('chat')
  
  // 🌟 从数据库拉取的全量消息树 (用于渲染 DAG)
  const [messages, setMessages] = useState([])
  
  // 🌟 当前 HEAD 指针 (当前活跃的节点 UUID，决定 Chat 视图显示哪条链路)
  const [activeNodeId, setActiveNodeId] = useState(null)
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // 语义搜索状态
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  // 导入/导出状态
  const [actionStatus, setActionStatus] = useState('')

  // ==========================================
  // 🔄 数据加载与初始化
  // ==========================================
  const loadMessages = async () => {
    const allMsgs = await window.gitmindhub.getAllMessages()
    setMessages(allMsgs)
    
    // 如果是首次加载且没有 activeNodeId，默认选中最后一个节点 (最新的 HEAD)
    if (allMsgs.length > 0 && !activeNodeId) {
      setActiveNodeId(allMsgs[allMsgs.length - 1].uuid)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  // 自动滚动到最新消息
  useEffect(() => {
    if (viewMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeNodeId, viewMode])

  // ==========================================
  // 🧬 核心逻辑：计算当前 Lineage (祖先链路)
  // ==========================================
  const currentLineage = useMemo(() => {
    if (!activeNodeId || messages.length === 0) return []
    
    const msgMap = new Map(messages.map(m => [m.uuid, m]))
    const lineage = []
    let currUuid = activeNodeId
    
    // 沿着 parent_uuid 向上回溯，直到 root
    while (currUuid) {
      const msg = msgMap.get(currUuid)
      if (!msg) break
      lineage.unshift(msg) // 插入头部，保证从 root 到 active 的顺序
      currUuid = msg.parent_uuid
    }
    return lineage
  }, [messages, activeNodeId])

  // ==========================================
  // 🛠️ 业务操作 Handlers
  // ==========================================

  // 1. 发送新消息 (在当前 HEAD 上 Commit & Push)
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    // 如果是第一条消息，parentUuid 为 null
    const parentUuid = messages.length === 0 ? null : activeNodeId
    
    setIsLoading(true)
    try {
      // 调用后端，后端会保存 user msg 和 mock ai msg，并返回 ai msg 的数据
      const aiMsg = await window.gitmindhub.sendMessage({
        parentUuid,
        userText: input.trim()
      })
      
      // 将 HEAD 指针移动到最新的 AI 回复节点
      setActiveNodeId(aiMsg.uuid)
      setInput('')
      
      // 重新拉取全量数据，刷新 DAG 和 Chat
      await loadMessages()
    } catch (error) {
      console.error('Send failed:', error)
      alert('发送失败，请检查后端日志或 Embedding 服务状态')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault()
      handleSend() 
    }
  }

  // 2. DAG 节点点击 (Git Checkout)
  const handleNodeClick = (nodeUuid) => {
    setActiveNodeId(nodeUuid)
  }

  // 3. 语义搜索 (RAG)
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
      }
    } catch (e) { 
      console.error(e) 
    } finally { 
      setIsSearching(false) 
    }
  }

  // 点击搜索结果，直接 Checkout 到该节点并跳转
  const handleJumpToNode = (conversationUuid) => {
    setActiveNodeId(conversationUuid)
    setShowSearch(false)
    setViewMode('chat')
  }

  // 4. 📦 导出逻辑
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

  // 5. 📦 导入逻辑 (带破坏性警告)
  const handleImport = async () => {
    // ⚠️ 危险操作确认
    const confirmed = window.confirm(
      '⚠️ 警告：导入操作将【完全覆盖】当前的本地对话和知识库数据！\n\n' +
      '此操作不可逆，建议先点击“导出”备份当前数据。\n\n' +
      '确定要继续吗？'
    )
    
    if (!confirmed) return

    setActionStatus('importing')
    try {
      const result = await window.gitmindhub.importData()
      if (result.success) {
        alert('✅ 导入成功！正在刷新界面...')
        setActionStatus('imported')
        
        // 🌟 关键：重新拉取数据并重置 HEAD 指针
        await loadMessages()
        setActiveNodeId(null) // 让 loadMessages 里的逻辑自动选中最新节点
      } else {
        if (result.message !== '用户取消') alert(`❌ 导入失败: ${result.message}`)
      }
    } catch (e) {
      alert('导入过程发生异常，请检查 JSON 文件格式')
    } finally {
      setTimeout(() => setActionStatus(''), 2000)
    }
  }

  // ==========================================
  // 🎨 样式常量
  // ==========================================
  const navBtn = { 
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', 
    background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: '0.85rem', 
    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' 
  }

  // ==========================================
  // 🖥️ 渲染 (Render)
  // ==========================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', color: '#111827' }}>
      
      {/* 顶部导航栏 */}
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🌳</span>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>GitMindHub</h1>
          {/* 🌟 显示当前 HEAD 状态 */}
          {activeNodeId && (
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#f3f4f6', borderRadius: '10px', color: '#4b5563', fontFamily: 'monospace' }}>
              HEAD: {activeNodeId.substring(0, 8)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleImport} style={navBtn} disabled={actionStatus === 'importing'} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            📥 导入 {actionStatus === 'importing' && '...'} {actionStatus === 'imported' && '✓'}
          </button>
          <button onClick={handleExport} style={navBtn} disabled={actionStatus === 'exporting'} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            📤 导出 {actionStatus === 'exporting' && '...'} {actionStatus === 'exported' && '✓'}
          </button>
          
          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }}></div>
          
          <button onClick={() => setViewMode(viewMode === 'chat' ? 'dag' : 'chat')} style={{ ...navBtn, background: viewMode === 'dag' ? '#eff6ff' : '#fff', borderColor: viewMode === 'dag' ? '#3b82f6' : '#e5e7eb', color: viewMode === 'dag' ? '#2563eb' : '#374151', fontWeight: '600' }}>
            {viewMode === 'chat' ? '🕸️ DAG 视图' : '💬 对话视图'}
          </button>
          
          <button onClick={() => setShowSearch(true)} style={{...navBtn, background: '#f0fdf4', borderColor: '#10b981', color: '#065f46', fontWeight: '600'}} onMouseEnter={e => e.currentTarget.style.background='#dcfce7'} onMouseLeave={e => e.currentTarget.style.background='#f0fdf4'}>
            🧠 语义查找
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'chat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 🌟 只渲染 currentLineage (当前分支的历史) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {currentLineage.length === 0 && messages.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '100px', color: '#9ca3af' }}>
                  <h2>🌱 开始你的第一次 Commit</h2>
                  <p>在下方输入框发送消息，创建 Root 节点。</p>
                </div>
              )}
              
              {currentLineage.map((msg) => (
                <div key={msg.uuid} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%', padding: '12px 16px', borderRadius: '12px', background: msg.role === 'user' ? '#3b82f6' : '#ffffff', color: msg.role === 'user' ? '#ffffff' : '#1f2937', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '4px', fontFamily: 'monospace' }}>
                    {msg.role} | {msg.uuid.substring(0, 8)}
                  </div>
                  {msg.full_text || msg.preview_text}
                </div>
              ))}
              {isLoading && <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', color: '#6b7280' }}>🤔 AI 正在思考...</div>}
              <div ref={messagesEndRef} />
            </div>
            
            {/* 输入区 */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '12px', maxWidth: '900px', margin: '0 auto' }}>
                <textarea 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  placeholder={activeNodeId ? `在当前节点 (${activeNodeId.substring(0,8)}) 上继续对话...` : "输入第一条消息..."} 
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none', height: '56px', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }} 
                  disabled={isLoading} 
                />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} style={{ padding: '0 24px', borderRadius: '8px', border: 'none', background: (isLoading || !input.trim()) ? '#9ca3af' : '#3b82f6', color: '#ffffff', fontWeight: '600', cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer' }}>
                  Commit & Push
                </button>
              </div>
            </div>
          </div>
        ) : (
          // 🌟 传入 activeNodeId 和 onNodeClick
          <DagView 
            messages={messages} 
            activeNodeId={activeNodeId} 
            onNodeClick={handleNodeClick} 
          />
        )}
      </main>

      {/* ================= 🧠 语义查找 Modal ================= */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={() => setShowSearch(false)}>
          <div style={{ background: '#ffffff', borderRadius: '12px', width: '600px', maxHeight: '80vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
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

              {/* 结果展示区 */}
              <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                {searchResults.length === 0 && !isSearching && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔎</div>
                    <p>输入关键字进行语义搜索。</p>
                  </div>
                )}
                
                {searchResults.map((r) => (
                  <div key={r.chunk_uuid} onClick={() => handleJumpToNode(r.conversation_uuid)} style={{ padding: '14px', marginBottom: '10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor='#3b82f6'} onMouseLeave={e => e.currentTarget.style.borderColor='#e5e7eb'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace' }}>Chunk: {r.chunk_uuid.substring(0, 12)}...</span>
                      <span style={{ color: '#3b82f6', fontWeight: '700', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        Distance: {r.distance.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#111827' }}>{r.text_content}</div>
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#9ca3af' }}>
                      💡 点击跳转到关联的对话节点: <code>{r.conversation_uuid.substring(0, 8)}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App