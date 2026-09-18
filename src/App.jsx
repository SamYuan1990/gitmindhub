import React, { useState, useRef, useEffect, useMemo } from 'react'
import DagView from './DagView'
import SearchModal from './components/SearchModal'
import { useDataManagement } from './hooks/useDataManagement'

function App() {
  // ==========================================
  // 🧠 核心状态管理
  // ==========================================
  const [viewMode, setViewMode] = useState('dag') 
  const [messages, setMessages] = useState([])
  const [activeNodeId, setActiveNodeId] = useState(null)
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const [showSearch, setShowSearch] = useState(false)
  
  // 🌟 新增：设置弹窗状态
  const [showSettings, setShowSettings] = useState(false)

  const { actionStatus, handleImport, handleExport } = useDataManagement(() => {
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

  useEffect(() => {
    if (activeNodeId !== null && typeof activeNodeId !== 'string') {
      console.error('🚨 警告: activeNodeId 被设置为了非字符串类型!', activeNodeId)
      setActiveNodeId(null) 
    }
  }, [activeNodeId])

  // ==========================================
  // 🧬 核心逻辑：计算当前 Lineage
  // ==========================================
  const currentLineage = useMemo(() => {
    if (!activeNodeId || typeof activeNodeId !== 'string' || messages.length === 0) return []
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
    const parentUuid = activeNodeId 
    
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

  const handleNodeDoubleClick = (nodeUuid) => {
    if (typeof nodeUuid === 'string') {
      setActiveNodeId(nodeUuid)
      setViewMode('chat')
    }
  }

  const handleNodeClick = (nodeUuid) => {
    if (typeof nodeUuid === 'string') {
      setActiveNodeId(nodeUuid)
    }
  }

  const handleNewChat = () => {
    setActiveNodeId(null)
    setInput('')
    setViewMode('chat') 
  }

  const handleJumpToNode = (conversationUuid) => {
    if (typeof conversationUuid === 'string') {
      setActiveNodeId(conversationUuid)
      setViewMode('chat')
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

  const modalOverlay = { 
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
    zIndex: 100, backdropFilter: 'blur(4px)' 
  }
  
  const modalBox = { 
    background: '#ffffff', borderRadius: '12px', width: '500px', maxHeight: '80vh', 
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' 
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
          {activeNodeId && typeof activeNodeId === 'string' && (
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

          {/* 🌟 新增：设置按钮 */}
          <button onClick={() => setShowSettings(true)} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            ⚙️ 设置
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'chat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!activeNodeId && currentLineage.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '100px', color: '#9ca3af' }}>
                  <h2>🌱 开启全新对话</h2>
                  <p>在下方输入你的第一个问题，创建新的 Root 节点。</p>
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
            
            {/* 对话视图底部输入区 */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '12px', maxWidth: '900px', margin: '0 auto' }}>
                <textarea 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  placeholder={typeof activeNodeId === 'string' ? `在当前节点 (${activeNodeId.substring(0,8)}) 上追加对话...` : "输入第一条消息，创建新 Root..."} 
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none', height: '56px', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }} 
                  disabled={isLoading} 
                  autoFocus={!activeNodeId}
                />
                
                {/* 🌟 调整顺序：主操作“对话”在左，次操作“新建对话”在右 */}
                <button 
                  onClick={handleSend} 
                  disabled={isLoading || !input.trim()} 
                  style={{ 
                    padding: '0 24px', borderRadius: '8px', border: 'none', 
                    background: (isLoading || !input.trim()) ? '#9ca3af' : '#3b82f6', 
                    color: '#ffffff', fontWeight: '600', 
                    cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' 
                  }}
                >
                  💬 对话
                </button>

                <button 
                  onClick={handleNewChat} 
                  disabled={isLoading} 
                  style={{ 
                    padding: '0 20px', borderRadius: '8px', border: '1px solid #10b981', 
                    background: !activeNodeId ? '#d1fae5' : '#ecfdf5', 
                    color: '#065f46', fontWeight: '600', 
                    cursor: isLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' 
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='#d1fae5'}
                  onMouseLeave={e => e.currentTarget.style.background= !activeNodeId ? '#d1fae5' : '#ecfdf5'}
                >
                  ✨ 新建对话
                </button>
              </div>
            </div>
          </div>
        ) : (
          <DagView 
            messages={messages} 
            activeNodeId={activeNodeId} 
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        )}
      </main>

      {/* 语义查找 Modal */}
      <SearchModal 
        isOpen={showSearch} 
        onClose={() => setShowSearch(false)} 
        onJumpToNode={handleJumpToNode} 
      />

      {/* 🌟 新增：设置 Modal (占位) */}
      {showSettings && (
        <div style={modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ 应用设置
              </h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '30px 20px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🛠️</div>
              <h4 style={{ color: '#111827', marginBottom: '8px' }}>配置中心正在建设中...</h4>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                在这里，你未来将可以配置：<br/>
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>LLM 模型选择</code>、
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>API Key</code>、
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>System Prompt</code> 等。
              </p>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowSettings(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App