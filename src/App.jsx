import React, { useState, useRef, useEffect, useMemo } from 'react'
import DagView from './DagView'
import SearchModal from './components/SearchModal'
import { useDataManagement } from './hooks/useDataManagement'

function App() {
  // ==========================================
  // 🧠 核心状态管理
  // ==========================================
  const [viewMode, setViewMode] = useState('chat')
  const [messages, setMessages] = useState([])
  const [activeNodeId, setActiveNodeId] = useState(null)
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const [showSearch, setShowSearch] = useState(false)

  // 🌟 使用自定义 Hook 管理导入导出
  const { actionStatus, handleImport, handleExport } = useDataManagement(() => {
    // 导入成功后的回调：刷新数据并重置 HEAD
    loadMessages()
    setActiveNodeId(null)
  })

  // ==========================================
  // 🔄 数据加载与初始化
  // ==========================================
  const loadMessages = async () => {
    const allMsgs = await window.gitmindhub.getAllMessages()
    setMessages(allMsgs)
    if (allMsgs.length > 0 && !activeNodeId) {
      setActiveNodeId(allMsgs[allMsgs.length - 1].uuid)
    }
  }

  useEffect(() => { loadMessages() }, [])

  useEffect(() => {
    if (viewMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeNodeId, viewMode])

  // ==========================================
  // 🧬 核心逻辑：计算当前 Lineage
  // ==========================================
  const currentLineage = useMemo(() => {
    if (!activeNodeId || messages.length === 0) return []
    const msgMap = new Map(messages.map(m => [m.uuid, m]))
    const lineage = []
    let currUuid = activeNodeId
    while (currUuid) {
      const msg = msgMap.get(currUuid)
      if (!msg) break
      lineage.unshift(msg)
      currUuid = msg.parent_uuid
    }
    return lineage
  }, [messages, activeNodeId])

  // ==========================================
  // 🛠️ 业务操作 Handlers
  // ==========================================
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const parentUuid = messages.length === 0 ? null : activeNodeId
    
    setIsLoading(true)
    try {
      const aiMsg = await window.gitmindhub.sendMessage({ parentUuid, userText: input.trim() })
      setActiveNodeId(aiMsg.uuid)
      setInput('')
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

  const handleNodeClick = (nodeUuid) => {
    setActiveNodeId(nodeUuid)
  }

  // 🌟 供 SearchModal 调用的跳转函数
  const handleJumpToNode = (conversationUuid) => {
    setActiveNodeId(conversationUuid)
    setViewMode('chat')
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
          <DagView 
            messages={messages} 
            activeNodeId={activeNodeId} 
            onNodeClick={handleNodeClick} 
          />
        )}
      </main>

      {/* 🌟 独立的搜索组件 */}
      <SearchModal 
        isOpen={showSearch} 
        onClose={() => setShowSearch(false)} 
        onJumpToNode={handleJumpToNode} 
      />
    </div>
  )
}

export default App