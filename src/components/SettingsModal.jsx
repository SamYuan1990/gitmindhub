// src/components/SettingsModal.jsx
import React, { useState, useEffect } from 'react'

export default function SettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    apiKey: '',
    embeddingUrl: '',
    systemPrompt: '',
    provider: 'deepseek',
    modelId: 'deepseek-v4-flash'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // 'success' | 'error' | ''

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    const current = await window.gitmindhub.getSettings()
    setSettings(current)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('')
    try {
      await window.gitmindhub.updateSettings(settings)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (error) {
      console.error('Save settings failed:', error)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenLocation = () => {
    window.gitmindhub.openSettingsFileLocation()
  }

  if (!isOpen) return null

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '6px', 
    border: '1px solid #d1d5db', fontSize: '0.9rem', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box'
  }

  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: '12px', width: '550px', maxHeight: '85vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>⚙️ 应用设置</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
        </div>
        
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* LLM 配置 */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>🤖 LLM 模型配置</h4>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>API Key</label>
              <input 
                type="password" 
                value={settings.apiKey} 
                onChange={e => setSettings({...settings, apiKey: e.target.value})}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx" 
                style={inputStyle} 
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>你的 API Key 将安全地保存在本地配置文件中。</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Provider</label>
                <input value={settings.provider} onChange={e => setSettings({...settings, provider: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Model ID</label>
                <input value={settings.modelId} onChange={e => setSettings({...settings, modelId: e.target.value})} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Embedding 配置 */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>🧠 Embedding 服务</h4>
            <label style={labelStyle}>API Endpoint URL</label>
            <input 
              value={settings.embeddingUrl} 
              onChange={e => setSettings({...settings, embeddingUrl: e.target.value})}
              placeholder="http://localhost:9080/embeddings" 
              style={inputStyle} 
            />
          </div>

          {/* System Prompt */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>📝 System Prompt</h4>
            <textarea 
              value={settings.systemPrompt} 
              onChange={e => setSettings({...settings, systemPrompt: e.target.value})}
              rows={4}
              style={{...inputStyle, resize: 'vertical'}}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
          <button onClick={handleOpenLocation} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', fontSize: '0.85rem' }}>
            📂 打开配置文件目录
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {saveStatus === 'success' && <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>✅ 保存成功并已生效!</span>}
            {saveStatus === 'error' && <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600' }}>❌ 保存失败</span>}
            
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>
              取消
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '600', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}
            >
              {isSaving ? '保存中...' : '💾 保存设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}