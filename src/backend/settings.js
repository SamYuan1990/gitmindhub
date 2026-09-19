// src/backend/settings.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'gitmindhub_settings.json');

const DEFAULT_SETTINGS = {
  embeddingUrl: 'http://localhost:9080/embeddings',
  systemPrompt: 'You are a helpful assistant. You manage context like a Git version control system.',
  llmProfiles: [
    {
      id: 'default_deepseek',
      name: 'DeepSeek V4 Flash',
      provider: 'deepseek',
      modelId: 'deepseek-v4-flash',
      apiKey: '',
      isDefault: true
    }
  ]
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      let settings = JSON.parse(data);
      
      // 🌟 兼容旧版配置：如果存在旧的 apiKey 字段，自动迁移为 Profile
      if (settings.apiKey && !settings.llmProfiles) {
        settings.llmProfiles = [{
          id: 'migrated_default',
          name: 'Migrated Default',
          provider: settings.provider || 'deepseek',
          modelId: settings.modelId || 'deepseek-v4-flash',
          apiKey: settings.apiKey,
          isDefault: true
        }];
        delete settings.apiKey;
        delete settings.provider;
        delete settings.modelId;
        // 立即保存迁移后的结果
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
      }
      
      return { ...DEFAULT_SETTINGS, ...settings };
    }
  } catch (error) {
    console.error('[Settings] ❌ 读取配置失败:', error.message);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(newSettings) {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const finalSettings = { ...DEFAULT_SETTINGS, ...newSettings };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(finalSettings, null, 2), 'utf-8');
    return finalSettings;
  } catch (error) {
    console.error('[Settings] ❌ 保存配置失败:', error);
    throw error;
  }
}

// 🌟 新增：获取特定的 Profile
function getProfileById(profileId) {
  const settings = getSettings();
  return settings.llmProfiles.find(p => p.id === profileId);
}

// 🌟 新增：获取默认 Profile
function getDefaultProfile() {
  const settings = getSettings();
  return settings.llmProfiles.find(p => p.isDefault) || settings.llmProfiles[0];
}

module.exports = { getSettings, saveSettings, getProfileById, getDefaultProfile, SETTINGS_PATH };