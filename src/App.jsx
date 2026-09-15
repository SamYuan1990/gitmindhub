import React, { useState, useRef, useEffect, useMemo } from 'react'
import DagView from './DagView'

function App() {
  const [viewMode, setViewMode] = useState('chat')
  
  // 核心状态：带有 id, parentId, branch 的对话树
  const [messages, setMessages] = useState([
    { id: 'root', parentId: null, role: 'assistant', content: '你好！我是 GitMindHub。试着问我点什么，或者点击顶部的“导入”加载分支示例，体验 DAG 视图。', timestamp: new Date().toLocaleTimeString(), branch: 'main' }
  ])
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // 查找与设置状态
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({ model: 'mock-gpt-4', temperature: 0.7, systemPrompt: 'You are helpful.' })
  const [saveStatus, setSaveStatus] = useState('')
  const [actionStatus, setActionStatus] = useState('') // 用于导入/导出的提示

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

  // 查找逻辑：直接基于真实的 messages
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return messages.filter(msg => msg.content.toLowerCase().includes(q))
  }, [messages, searchQuery])

  // 导入逻辑
  const handleImport = async () => {
    setActionStatus('importing')
    try {
      const result = await window.gitmindhub.importData()
      if (result.success) {
        setMessages(result.data)
        setViewMode('dag') // 导入后自动切换到 DAG 视图查看分支效果
        setActionStatus('imported')
        setTimeout(() => setActionStatus(''), 2000)
      }
    } catch (e) {
      setActionStatus('')
    }
  }

  // 导出逻辑
  const handleExport = async () => {
    setActionStatus('exporting')
    try {
      const result = await window.gitmindhub.exportData(messages)
      if (result.success) {
        setActionStatus('exported')
        setTimeout(() => setActionStatus(''), 2000)
      }
    } catch (e) {
      setActionStatus('')
    }
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
  const modalBox = { background: '#ffffff', borderRadius: '12px', width: '500px', maxHeight: '80vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  const highlightText = (text, query) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? <mark key={i} style={{ background: '#fef08a', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> : part)
  }

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
          <button onClick={handleImport} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'} title="加载包含分支的示例数据">
            📥 导入 {actionStatus === 'importing' && '...'} {actionStatus === 'imported' && '✓'}
          </button>
          <button onClick={handleExport} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'} title="将当前对话树导出为 JSON">
            📤 导出 {actionStatus === 'exporting' && '...'} {actionStatus === 'exported' && '✓'}
          </button>
          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }}></div>
          <button onClick={() => setViewMode(viewMode === 'chat' ? 'dag' : 'chat')} style={{ ...navBtn, background: viewMode === 'dag' ? '#eff6ff' : '#fff', borderColor: viewMode === 'dag' ? '#3b82f6' : '#e5e7eb', color: viewMode === 'dag' ? '#2563eb' : '#374151', fontWeight: '600' }}>
            {viewMode === 'chat' ? '🕸️ DAG 视图' : '💬 对话视图'}
          </button>
          <button onClick={() => setShowSearch(true)} style={navBtn} onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>🔍 查找</button>
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
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '6px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.timestamp} {msg.branch !== 'main' && `| ${msg.branch}`}</div>
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

      {/* ================= 查找 Modal ================= */}
      {showSearch && (
        <div style={modalOverlay} onClick={() => setShowSearch(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🔍 查找上下文</h3>
              <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
            </div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="输入关键字..." autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {searchQuery && searchResults.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>未找到匹配的结果</p>}
              {searchResults.map(item => (
                <div key={item.id} style={{ padding: '12px', marginBottom: '8px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem', color: '#6b7280' }}>
                    <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{item.role}</span>
                    <span>{item.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>{highlightText(item.content, searchQuery)}</div>
                </div>
              ))}
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