// src/components/SettingsModal.jsx
import React, { useState, useEffect } from 'react'

export default function SettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    embeddingConfig: { provider: 'local', url: '', apiKey: '', model: '' },
    systemPrompt: '',
    llmProfiles: []
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
    // 确保数据结构完整，防止旧配置导致报错
    setSettings({
      embeddingConfig: current.embeddingConfig || { provider: 'local', url: '', apiKey: '', model: '' },
      systemPrompt: current.systemPrompt || '',
      llmProfiles: current.llmProfiles || []
    })
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

  // ==========================================
  // 🤖 LLM Profiles 管理
  // ==========================================
  const addProfile = () => {
    const newId = `profile_${Date.now()}`
    setSettings({
      ...settings,
      llmProfiles: [...settings.llmProfiles, { 
        id: newId, name: 'New Model', provider: 'openai', modelId: 'gpt-4o-mini', apiKey: '', isDefault: false 
      }]
    })
  }

  const updateProfile = (index, field, value) => {
    const newProfiles = [...settings.llmProfiles]
    newProfiles[index] = { ...newProfiles[index], [field]: value }
    setSettings({ ...settings, llmProfiles: newProfiles })
  }

  const removeProfile = (index) => {
    const newProfiles = settings.llmProfiles.filter((_, i) => i !== index)
    setSettings({ ...settings, llmProfiles: newProfiles })
  }

  const setDefault = (index) => {
    const newProfiles = settings.llmProfiles.map((p, i) => ({ ...p, isDefault: i === index }))
    setSettings({ ...settings, llmProfiles: newProfiles })
  }

  // ==========================================
  // 🧠 Embedding 配置管理
  // ==========================================
  const getDefaultEmbeddingConfig = (provider) => {
    switch (provider) {
      case 'ollama': return { url: 'http://localhost:11434/api/embeddings', model: 'nomic-embed-text', apiKey: '' }
      case 'siliconflow': return { url: 'https://api.siliconflow.cn/v1/embeddings', model: 'BAAI/bge-m3', apiKey: '' }
      case 'modelscope': return { url: 'https://api-inference.modelscope.cn/v1/embeddings', model: 'AI-ModelScope/bge-large-zh-v1.5', apiKey: '' }
      default: return { url: 'http://localhost:9080/embeddings', model: 'Qwen/Qwen3-Embedding-0.6B', apiKey: '' }
    }
  }

  const handleEmbeddingProviderChange = (e) => {
    const newProvider = e.target.value
    const defaults = getDefaultEmbeddingConfig(newProvider)
    setSettings({
      ...settings,
      embeddingConfig: {
        ...settings.embeddingConfig,
        provider: newProvider,
        url: defaults.url,
        model: defaults.model,
        apiKey: defaults.apiKey
      }
    })
  }

  const updateEmbeddingConfig = (field, value) => {
    setSettings({
      ...settings,
      embeddingConfig: { ...settings.embeddingConfig, [field]: value }
    })
  }

  if (!isOpen) return null

  // ==========================================
  // 🎨 样式常量
  // ==========================================
  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: '6px', 
    border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box'
  }

  const labelStyle = { 
    display: 'block', marginBottom: '4px', fontSize: '0.75rem', 
    fontWeight: '600', color: '#4b5563' 
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: '12px', width: '650px', maxHeight: '85vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>⚙️ 应用设置</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
        </div>
        
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Embedding 服务配置 */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>🧠 Embedding 服务配置</h4>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>服务提供商</label>
              <select 
                value={settings.embeddingConfig.provider} 
                onChange={handleEmbeddingProviderChange}
                style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
              >
                <option value="local">本地自定义服务 (Local Python)</option>
                <option value="ollama">本地 Ollama</option>
                <option value="siliconflow">硅基流动 (SiliconFlow)</option>
                <option value="modelscope">魔搭 (ModelScope)</option>
              </select>
            </div>

            {(settings.embeddingConfig.provider === 'siliconflow' || settings.embeddingConfig.provider === 'modelscope') && (
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>API Key</label>
                <input 
                  type="password" 
                  value={settings.embeddingConfig.apiKey} 
                  onChange={e => updateEmbeddingConfig('apiKey', e.target.value)} 
                  placeholder="请输入你的 API Key" 
                  style={inputStyle} 
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>API Endpoint URL</label>
                <input 
                  value={settings.embeddingConfig.url} 
                  onChange={e => updateEmbeddingConfig('url', e.target.value)} 
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Model Name</label>
                <input 
                  value={settings.embeddingConfig.model} 
                  onChange={e => updateEmbeddingConfig('model', e.target.value)} 
                  placeholder="例如: nomic-embed-text" 
                  style={inputStyle} 
                />
              </div>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
              {settings.embeddingConfig.provider === 'ollama' ? '💡 Ollama 默认使用 "prompt" 字段发送文本，无需 API Key。' : 
               settings.embeddingConfig.provider === 'local' ? '💡 确保你的本地 Python Embedding 服务正在运行。' :
               '💡 使用 OpenAI 兼容的 /v1/embeddings 接口格式。'}
            </p>
          </div>

          {/* 2. System Prompt */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>📝 全局 System Prompt</h4>
            <textarea 
              value={settings.systemPrompt} 
              onChange={e => setSettings({...settings, systemPrompt: e.target.value})}
              rows={3}
              style={{...inputStyle, resize: 'vertical'}}
            />
          </div>

          {/* 3. LLM 模型配置 (Profiles) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>🤖 LLM 模型配置</h4>
              <button onClick={addProfile} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>+ 添加新模型</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {settings.llmProfiles.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '0.85rem', border: '1px dashed #d1d5db', borderRadius: '8px' }}>
                  暂无模型配置，请点击上方“添加新模型”按钮。
                </div>
              )}
              
              {settings.llmProfiles.map((profile, index) => (
                <div key={profile.id} style={{ padding: '16px', border: `2px solid ${profile.isDefault ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '8px', background: profile.isDefault ? '#eff6ff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#111827' }}>
                      {profile.name} {profile.isDefault && <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: '500' }}>(默认)</span>}
                    </span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {!profile.isDefault && (
                        <button onClick={() => setDefault(index)} style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>设为默认</button>
                      )}
                      <button onClick={() => removeProfile(index)} style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>删除</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={labelStyle}>显示名称</label>
                      <input value={profile.name} onChange={e => updateProfile(index, 'name', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Provider (如 deepseek, anthropic)</label>
                      <input value={profile.provider} onChange={e => updateProfile(index, 'provider', e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Model ID (如 deepseek-v4-flash)</label>
                      <input value={profile.modelId} onChange={e => updateProfile(index, 'modelId', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>API Key</label>
                      <input type="password" value={profile.apiKey} onChange={e => updateProfile(index, 'apiKey', e.target.value)} placeholder="sk-..." style={inputStyle} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
          <button onClick={() => window.gitmindhub.openSettingsFileLocation()} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', fontSize: '0.85rem' }}>
            📂 打开配置目录
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