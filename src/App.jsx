// src/App.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react'
import DagView from './DagView'
import SearchModal from './components/SearchModal'
import SettingsModal from './components/SettingsModal'
import { useDataManagement } from './hooks/useDataManagement'

function App() {
  const [viewMode, setViewMode] = useState('dag') 
  const [messages, setMessages] = useState([])
  const [activeNodeId, setActiveNodeId] = useState(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // 🌟 新增：LLM Profiles 状态
  const [profiles, setProfiles] = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState('')

  const { actionStatus, handleImport, handleExport } = useDataManagement(() => {
    loadMessages()
    setActiveNodeId(null)
  })

  // 🌟 加载 Profiles
  const loadProfiles = async () => {
    const settings = await window.gitmindhub.getSettings()
    const p = settings.llmProfiles || []
    setProfiles(p)
    const def = p.find(x => x.isDefault) || p[0]
    if (def && !selectedProfileId) setSelectedProfileId(def.id)
  }

  const loadMessages = async () => {
    const allMsgs = await window.gitmindhub.getAllMessages()
    setMessages(allMsgs)
    if (allMsgs.length > 0 && !activeNodeId) setActiveNodeId(allMsgs[allMsgs.length - 1].uuid)
  }

  useEffect(() => { loadMessages(); loadProfiles() }, [])
  useEffect(() => { if (viewMode === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [activeNodeId, viewMode])

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    try {
      // 🌟 传递 selectedProfileId
      const aiMsg = await window.gitmindhub.sendMessage({ 
        parentUuid: activeNodeId, 
        userText: input.trim(),
        llmProfileId: selectedProfileId 
      })
      setActiveNodeId(aiMsg.uuid)
      setInput('')
      await loadMessages()
    } catch (error) {
      alert(`发送失败: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const handleNodeDoubleClick = (nodeUuid) => { if (typeof nodeUuid === 'string') { setActiveNodeId(nodeUuid); setViewMode('chat') } }
  const handleNodeClick = (nodeUuid) => { if (typeof nodeUuid === 'string') setActiveNodeId(nodeUuid) }
  const handleNewChat = () => { setActiveNodeId(null); setInput(''); setViewMode('chat') }
  const handleJumpToNode = (conversationUuid) => { if (typeof conversationUuid === 'string') { setActiveNodeId(conversationUuid); setViewMode('chat') } }

  const navBtn = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f9fafb', color: '#111827' }}>
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🌳</span>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>GitMindHub</h1>
          {activeNodeId && <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#f3f4f6', borderRadius: '10px', fontFamily: 'monospace' }}>HEAD: {activeNodeId.substring(0, 8)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleImport} style={navBtn}>📥 导入</button>
          <button onClick={handleExport} style={navBtn}>📤 导出</button>
          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }}></div>
          <button onClick={() => setViewMode(viewMode === 'chat' ? 'dag' : 'chat')} style={{ ...navBtn, fontWeight: '600' }}>
            {viewMode === 'chat' ? '🕸️ DAG 视图' : '💬 对话视图'}
          </button>
          <button onClick={() => setShowSearch(true)} style={{ ...navBtn, background: '#f0fdf4', borderColor: '#10b981', color: '#065f46', fontWeight: '600' }}>🧠 语义查找</button>
          <button onClick={() => { setShowSettings(true); loadProfiles() }} style={navBtn}>⚙️ 设置</button>
        </div>
      </header>

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
                <div key={msg.uuid} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%', padding: '12px 16px', borderRadius: '12px', background: msg.role === 'user' ? '#3b82f6' : '#ffffff', color: msg.role === 'user' ? '#ffffff' : '#1f2937', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '4px', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{msg.role} | {msg.uuid.substring(0, 8)}</span>
                    {/* 🌟 在对话气泡上也显示模型 */}
                    {msg.role === 'assistant' && msg.model_provider && (
                      <span style={{ background: 'rgba(0,0,0,0.1)', padding: '0 4px', borderRadius: '4px' }}>
                        {msg.model_provider}/{msg.model_id?.split('-')[0]}
                      </span>
                    )}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{msg.full_text || msg.preview_text}</div>
                </div>
              ))}
              {isLoading && <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', color: '#6b7280' }}>🤔 AI 正在思考...</div>}
              <div ref={messagesEndRef} />
            </div>
            
            <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                {/* 🌟 新增：模型选择器 */}
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>使用模型:</span>
                  <select 
                    value={selectedProfileId} 
                    onChange={e => setSelectedProfileId(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none', background: '#f9fafb' }}
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入消息..." style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none', height: '56px', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }} disabled={isLoading} />
                  <button onClick={handleSend} disabled={isLoading || !input.trim()} style={{ padding: '0 24px', borderRadius: '8px', border: 'none', background: (isLoading || !input.trim()) ? '#9ca3af' : '#3b82f6', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}>💬 对话</button>
                  <button onClick={handleNewChat} disabled={isLoading} style={{ padding: '0 20px', borderRadius: '8px', border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46', fontWeight: '600', cursor: 'pointer' }}>✨ 新建</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <DagView messages={messages} activeNodeId={activeNodeId} onNodeClick={handleNodeClick} onNodeDoubleClick={handleNodeDoubleClick} />
        )}
      </main>

      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} onJumpToNode={handleJumpToNode} />
      <SettingsModal isOpen={showSettings} onClose={() => { setShowSettings(false); loadProfiles() }} />
    </div>
  )
}

export default App