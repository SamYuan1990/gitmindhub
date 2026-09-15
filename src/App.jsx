import React, { useState, useRef, useEffect } from 'react'

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是 GitMindHub 的 Mock AI。试着问我点什么吧。' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      // 调用 preload.js 暴露的后端 API
      const response = await window.gitmindhub.sendMessage(userMsg.content)
      setMessages(prev => [...prev, response])
    } catch (error) {
      console.error('Failed to get response:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Error: 无法连接到后端。' }])
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
      {/* Header */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#ffffff' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>🌳 GitMindHub</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
          Platform: {window.gitmindhub?.platform || 'unknown'} | Status: <span style={{color: '#10b981'}}>Mock Backend Connected</span>
        </p>
      </header>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '75%',
            padding: '12px 16px',
            borderRadius: '12px',
            background: msg.role === 'user' ? '#3b82f6' : '#ffffff',
            color: msg.role === 'user' ? '#ffffff' : '#1f2937',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5'
          }}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', color: '#6b7280', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            🤔 AI 正在思考...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '24px', borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
        <div style={{ display: 'flex', gap: '12px', maxWidth: '800px', margin: '0 auto' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              resize: 'none',
              height: '56px',
              fontFamily: 'inherit',
              fontSize: '1rem',
              outline: 'none'
            }}
            disabled={isLoading}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '0 24px',
              borderRadius: '8px',
              border: 'none',
              background: (isLoading || !input.trim()) ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}

export default App