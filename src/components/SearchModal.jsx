import React, { useState } from 'react'

export default function SearchModal({ isOpen, onClose, onJumpToNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  if (!isOpen) return null

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSemanticSearch()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: '12px', width: '600px', maxHeight: '80vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🧠 本地知识库语义查找 
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '10px', fontWeight: 'normal' }}>Powered by Qwen</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
        </div>
        
        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入自然语言查询 (例如: '如何管理上下文')..." 
              style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none' }}
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

          <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
            {searchResults.length === 0 && !isSearching && (
              <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔎</div>
                <p>输入关键字进行语义搜索。</p>
              </div>
            )}
            
            {searchResults.map((r) => (
              <div 
                key={r.chunk_uuid} 
                onClick={() => { onJumpToNode(r.conversation_uuid); onClose(); }} 
                style={{ padding: '14px', marginBottom: '10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s' }} 
                onMouseEnter={e => e.currentTarget.style.borderColor='#3b82f6'} 
                onMouseLeave={e => e.currentTarget.style.borderColor='#e5e7eb'}
              >
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
  )
}
