// src/components/SettingsModal.jsx
import React, { useState, useEffect } from 'react'

export default function SettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({ embeddingUrl: '', systemPrompt: '', llmProfiles: [] })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => { if (isOpen) loadSettings() }, [isOpen])

  const loadSettings = async () => {
    const current = await window.gitmindhub.getSettings()
    setSettings(current)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.gitmindhub.updateSettings(settings)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (error) { setSaveStatus('error') } 
    finally { setIsSaving(false) }
  }

  const addProfile = () => {
    const newId = `profile_${Date.now()}`
    setSettings({
      ...settings,
      llmProfiles: [...settings.llmProfiles, { id: newId, name: 'New Model', provider: 'openai', modelId: 'gpt-4o-mini', apiKey: '', isDefault: false }]
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

  if (!isOpen) return null
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: '600', color: '#4b5563' }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⚙️ 应用设置</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 全局设置 */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>🌍 全局配置</h4>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Embedding API URL</label>
              <input value={settings.embeddingUrl} onChange={e => setSettings({...settings, embeddingUrl: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>System Prompt</label>
              <textarea value={settings.systemPrompt} onChange={e => setSettings({...settings, systemPrompt: e.target.value})} rows={3} style={{...inputStyle, resize: 'vertical'}} />
            </div>
          </div>

          {/* LLM Profiles */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>🤖 LLM 模型配置</h4>
              <button onClick={addProfile} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46', fontSize: '0.8rem', cursor: 'pointer' }}>+ 添加新模型</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {settings.llmProfiles.map((profile, index) => (
                <div key={profile.id} style={{ padding: '16px', border: `2px solid ${profile.isDefault ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '8px', background: profile.isDefault ? '#eff6ff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                      {profile.name} {profile.isDefault && <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>(默认)</span>}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!profile.isDefault && <button onClick={() => setDefault(index)} style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>设为默认</button>}
                      <button onClick={() => removeProfile(index)} style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div><label style={labelStyle}>显示名称</label><input value={profile.name} onChange={e => updateProfile(index, 'name', e.target.value)} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Provider (如 deepseek, anthropic)</label><input value={profile.provider} onChange={e => updateProfile(index, 'provider', e.target.value)} style={inputStyle} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div><label style={labelStyle}>Model ID (如 deepseek-v4-flash)</label><input value={profile.modelId} onChange={e => updateProfile(index, 'modelId', e.target.value)} style={inputStyle} /></div>
                    <div><label style={labelStyle}>API Key</label><input type="password" value={profile.apiKey} onChange={e => updateProfile(index, 'apiKey', e.target.value)} placeholder="sk-..." style={inputStyle} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
          <button onClick={() => window.gitmindhub.openSettingsFileLocation()} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>📂 打开配置目录</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {saveStatus === 'success' && <span style={{ color: '#10b981', fontSize: '0.85rem' }}>✅ 保存成功!</span>}
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>取消</button>
            <button onClick={handleSave} disabled={isSaving} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>{isSaving ? '保存中...' : '💾 保存设置'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}